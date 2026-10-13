use std::collections::HashMap;
use std::path::PathBuf;
use std::str::FromStr;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use agent_client_protocol::schema::ProtocolVersion;
use agent_client_protocol::schema::v1::{
    ContentBlock, EnvVariable, InitializeRequest, McpServer, McpServerStdio, NewSessionRequest,
    PermissionOptionKind, PromptRequest, RequestPermissionOutcome, RequestPermissionRequest,
    RequestPermissionResponse, SelectedPermissionOutcome, SessionNotification, SessionUpdate,
    TextContent, ToolCallStatus,
};
use agent_client_protocol::{AcpAgent, Agent, ConnectionTo};
use tokio::sync::oneshot;

/// An agent Eleven can launch over ACP.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AgentSpec {
    pub id: &'static str,
    pub name: &'static str,
    pub command: &'static str,
}

pub const AGENTS: &[AgentSpec] = &[
    AgentSpec {
        id: "claude",
        name: "Claude Code",
        command: "npx -y @agentclientprotocol/claude-agent-acp@latest",
    },
    AgentSpec {
        id: "codex",
        name: "Codex",
        command: "npx -y @agentclientprotocol/codex-acp@latest",
    },
    AgentSpec {
        id: "gemini",
        name: "Gemini CLI",
        command: "gemini --experimental-acp",
    },
    AgentSpec {
        id: "aster",
        name: "Aster",
        command: "aster acp",
    },
];

/// An MCP server handed to the agent for the whole session.
#[derive(Debug, Clone)]
pub struct McpTool {
    pub name: String,
    pub command: PathBuf,
    pub args: Vec<String>,
    pub env: Vec<(String, String)>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StepStatus {
    Running,
    Done,
    Failed,
}

#[derive(Debug, Clone)]
pub struct PermissionChoice {
    pub id: String,
    pub label: String,
}

#[derive(Debug, Clone)]
pub enum AgentEvent {
    Connected {
        agent: String,
    },
    Text(String),
    Thought(String),
    StepStarted {
        id: String,
        title: String,
        input: Option<serde_json::Value>,
    },
    StepUpdated {
        id: String,
        status: StepStatus,
        title: Option<String>,
        input: Option<serde_json::Value>,
    },
    Permission {
        request: u64,
        title: String,
        choices: Vec<PermissionChoice>,
    },
    TurnEnded,
    Failed(String),
}

enum Command {
    Prompt(String),
}

type Pending = Arc<Mutex<HashMap<u64, oneshot::Sender<Option<String>>>>>;

/// A running agent process. Dropping it shuts the agent down.
pub struct AgentSession {
    commands: tokio::sync::mpsc::UnboundedSender<Command>,
    pending: Pending,
    _runtime: Arc<tokio::runtime::Runtime>,
}

impl AgentSession {
    pub fn start(
        spec: &AgentSpec,
        cwd: PathBuf,
        tools: Vec<McpTool>,
        events: async_channel::Sender<AgentEvent>,
    ) -> std::io::Result<Self> {
        let runtime = Arc::new(
            tokio::runtime::Builder::new_multi_thread()
                .worker_threads(2)
                .thread_name("eleven-acp")
                .enable_all()
                .build()?,
        );
        let (commands, receiver) = tokio::sync::mpsc::unbounded_channel();
        let pending: Pending = Arc::default();
        runtime.spawn(run(
            spec.clone(),
            cwd,
            tools,
            events,
            receiver,
            pending.clone(),
        ));
        Ok(Self {
            commands,
            pending,
            _runtime: runtime,
        })
    }

    pub fn prompt(&self, text: String) {
        let _ = self.commands.send(Command::Prompt(text));
    }

    /// Answers a permission request; `None` declines it.
    pub fn answer(&self, request: u64, choice: Option<String>) {
        if let Some(reply) = self.pending.lock().expect("pending lock").remove(&request) {
            let _ = reply.send(choice);
        }
    }
}

async fn run(
    spec: AgentSpec,
    cwd: PathBuf,
    tools: Vec<McpTool>,
    events: async_channel::Sender<AgentEvent>,
    mut commands: tokio::sync::mpsc::UnboundedReceiver<Command>,
    pending: Pending,
) {
    let agent = match AcpAgent::from_str(spec.command) {
        Ok(agent) => agent,
        Err(err) => {
            let _ = events
                .send(AgentEvent::Failed(format!(
                    "Couldn't start {}. Check it's installed. ({err})",
                    spec.name
                )))
                .await;
            return;
        }
    };
    let next_request = Arc::new(AtomicU64::new(1));
    let note_events = events.clone();
    let ask_events = events.clone();
    let session_events = events.clone();
    let result = agent_client_protocol::Client
        .builder()
        .on_receive_notification(
            async move |notification: SessionNotification, _cx| {
                if let Some(event) = translate(notification.update) {
                    let _ = note_events.send(event).await;
                }
                Ok(())
            },
            agent_client_protocol::on_receive_notification!(),
        )
        .on_receive_request(
            async move |request: RequestPermissionRequest, responder, _connection| {
                let tool = request.tool_call.fields.title.clone().unwrap_or_default();
                if is_read_only(&tool) {
                    let allow = request
                        .options
                        .iter()
                        .find(|option| option.kind == PermissionOptionKind::AllowAlways)
                        .or_else(|| {
                            request
                                .options
                                .iter()
                                .find(|option| option.kind == PermissionOptionKind::AllowOnce)
                        });
                    if let Some(option) = allow {
                        return responder.respond(RequestPermissionResponse::new(
                            RequestPermissionOutcome::Selected(SelectedPermissionOutcome::new(
                                option.option_id.clone(),
                            )),
                        ));
                    }
                }
                let id = next_request.fetch_add(1, Ordering::Relaxed);
                let (reply, answer) = oneshot::channel();
                pending.lock().expect("pending lock").insert(id, reply);
                let _ = ask_events
                    .send(AgentEvent::Permission {
                        request: id,
                        title: request
                            .tool_call
                            .fields
                            .title
                            .clone()
                            .unwrap_or_else(|| "Use a tool".into()),
                        choices: request
                            .options
                            .iter()
                            .map(|option| PermissionChoice {
                                id: option.option_id.to_string(),
                                label: option.name.clone(),
                            })
                            .collect(),
                    })
                    .await;
                let outcome = match answer.await.ok().flatten() {
                    Some(choice) => {
                        RequestPermissionOutcome::Selected(SelectedPermissionOutcome::new(choice))
                    }
                    None => RequestPermissionOutcome::Cancelled,
                };
                responder.respond(RequestPermissionResponse::new(outcome))
            },
            agent_client_protocol::on_receive_request!(),
        )
        .connect_with(agent, |connection: ConnectionTo<Agent>| async move {
            let init = connection
                .send_request(InitializeRequest::new(ProtocolVersion::V1))
                .block_task()
                .await?;
            let agent_name = init
                .agent_info
                .map(|info| info.name)
                .unwrap_or_else(|| spec.name.to_string());
            let servers = tools
                .into_iter()
                .map(|tool| {
                    let mut server = McpServerStdio::new(tool.name, tool.command);
                    server.args = tool.args;
                    server.env = tool
                        .env
                        .into_iter()
                        .map(|(name, value)| EnvVariable::new(name, value))
                        .collect();
                    McpServer::Stdio(server)
                })
                .collect();
            let session = connection
                .send_request(NewSessionRequest::new(cwd).mcp_servers(servers))
                .block_task()
                .await?;
            let _ = session_events
                .send(AgentEvent::Connected { agent: agent_name })
                .await;
            while let Some(Command::Prompt(text)) = commands.recv().await {
                let turn = connection
                    .send_request(PromptRequest::new(
                        session.session_id.clone(),
                        vec![ContentBlock::Text(TextContent::new(text))],
                    ))
                    .block_task()
                    .await;
                let event = match turn {
                    Ok(_) => AgentEvent::TurnEnded,
                    Err(err) => AgentEvent::Failed(format!("The agent stopped: {err}")),
                };
                let _ = session_events.send(event).await;
            }
            Ok(())
        })
        .await;
    if let Err(err) = result {
        let _ = events
            .send(AgentEvent::Failed(format!(
                "{} disconnected. Try again, or pick another agent. ({err})",
                spec.name
            )))
            .await;
    }
}

fn translate(update: SessionUpdate) -> Option<AgentEvent> {
    let text = |content: ContentBlock| match content {
        ContentBlock::Text(text) => Some(text.text),
        _ => None,
    };
    match update {
        SessionUpdate::AgentMessageChunk(chunk) => text(chunk.content).map(AgentEvent::Text),
        SessionUpdate::AgentThoughtChunk(chunk) => text(chunk.content).map(AgentEvent::Thought),
        SessionUpdate::ToolCall(call) => Some(AgentEvent::StepStarted {
            id: call.tool_call_id.to_string(),
            title: call.title,
            input: call.raw_input,
        }),
        SessionUpdate::ToolCallUpdate(update) => Some(AgentEvent::StepUpdated {
            id: update.tool_call_id.to_string(),
            status: match update.fields.status {
                Some(ToolCallStatus::Completed) => StepStatus::Done,
                Some(ToolCallStatus::Failed) => StepStatus::Failed,
                _ => StepStatus::Running,
            },
            title: update.fields.title,
            input: update.fields.raw_input,
        }),
        _ => None,
    }
}

const READ_ONLY_REA: &[&str] = &[
    "open_binary",
    "close_binary",
    "binary_overview",
    "binary_session",
    "list_",
    "procedure_",
    "read_",
    "search_",
    "inspect_",
    "xrefs",
    "get_",
    "find_",
    "analyze_",
    "demangle_",
    "address_",
    "current_",
    "resolve_",
    "compare_",
    "build_call_path",
];

/// REA tools that only read the target are allowed without asking; anything that writes,
/// runs or captures still goes to the user.
fn is_read_only(tool: &str) -> bool {
    tool.strip_prefix("mcp__rea__")
        .or_else(|| tool.strip_prefix("rea__"))
        .is_some_and(|name| READ_ONLY_REA.iter().any(|prefix| name.starts_with(prefix)))
}
