use std::path::PathBuf;

use eleven_acp::{AGENTS, AgentEvent, AgentSession, McpTool, PermissionChoice, StepStatus};
use eleven_engine::{CodeView, Engine, Procedure, ProcedureKind, ReaLaunch, Target};
use gpui_kit::component::input::{InputEvent, InputState};
use gpui_kit::*;

use crate::Open;
use crate::theme::{self, Appearance};
use crate::workbench::Workbench;

pub(crate) struct Step {
    pub id: String,
    pub tool: String,
    pub title: String,
    pub status: StepStatus,
}

pub(crate) enum Message {
    User(String),
    Agent { text: String, steps: Vec<Step> },
    Permission {
        request: u64,
        title: String,
        choices: Vec<PermissionChoice>,
        answer: Option<String>,
    },
    Note(String),
}

pub(crate) struct CanvasTab {
    pub procedure: String,
    pub view: CodeView,
    pub code: Option<String>,
}

pub struct Home {
    pub(crate) engine: Engine,
    rea: ReaLaunch,
    pub(crate) agent_ix: usize,
    pub(crate) picker_open: bool,
    session: Option<AgentSession>,
    pub(crate) connected: Option<String>,
    pub(crate) busy: bool,
    pub(crate) target: Option<PathBuf>,
    pub(crate) opened: Option<Target>,
    pub(crate) messages: Vec<Message>,
    pub(crate) canvas: Vec<CanvasTab>,
    pub(crate) canvas_open: bool,
    pub(crate) active: usize,
    pub(crate) input: Entity<InputState>,
    pub(crate) reply: Entity<InputState>,
    pub(crate) focus: FocusHandle,
    _subscriptions: Vec<Subscription>,
}

impl Home {
    pub fn new(
        engine: Engine,
        rea: ReaLaunch,
        target: Option<PathBuf>,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) -> Self {
        let input = cx.new(|cx| {
            InputState::new(window, cx)
                .placeholder("Ask anything, or drop an app, binary, shader or model here")
        });
        let reply = cx.new(|cx| InputState::new(window, cx).placeholder("Ask a follow-up"));
        let on_enter = |this: &mut Self, state: &Entity<InputState>, event: &InputEvent, window: &mut Window, cx: &mut Context<Self>| {
            if let InputEvent::PressEnter { .. } = event {
                this.send_from(state.clone(), window, cx);
            }
        };
        let _subscriptions = vec![
            cx.subscribe_in(&input, window, on_enter),
            cx.subscribe_in(&reply, window, on_enter),
            cx.observe_window_appearance(window, |_, window, cx| {
                let choice = cx.global::<theme::Theme>().choice;
                if choice == Appearance::System {
                    theme::apply(choice, window, cx);
                }
            }),
        ];
        Self {
            engine,
            rea,
            agent_ix: 0,
            picker_open: false,
            session: None,
            connected: None,
            busy: false,
            target,
            opened: None,
            messages: Vec::new(),
            canvas: Vec::new(),
            canvas_open: true,
            active: 0,
            input,
            reply,
            focus: cx.focus_handle(),
            _subscriptions,
        }
    }

    pub(crate) fn send_from(
        &mut self,
        state: Entity<InputState>,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let text = state.read(cx).value().trim().to_string();
        if text.is_empty() || self.busy {
            return;
        }
        state.update(cx, |input, cx| input.set_value("", window, cx));
        self.send(text, window, cx);
    }

    pub(crate) fn send(&mut self, text: String, window: &mut Window, cx: &mut Context<Self>) {
        if self.busy {
            return;
        }
        if self.session.is_none() {
            self.start_agent(window, cx);
        }
        let first = self.messages.iter().all(|m| !matches!(m, Message::User(_)));
        let prompt = match (&self.target, first) {
            (Some(path), true) => format!(
                "You are working inside Eleven, a reverse-engineering app. The user opened {}. \
                 Use the rea MCP tools: call open_binary with that path and provider_id \"ghidra\" first. \
                 When you study a function, read it with procedure_pseudo_code so it appears in Eleven's code panel. \
                 Answer plainly and briefly.\n\n{text}",
                path.display()
            ),
            _ => text.clone(),
        };
        self.messages.push(Message::User(text));
        self.busy = true;
        self.picker_open = false;
        if let Some(session) = &self.session {
            session.prompt(prompt);
        }
        cx.notify();
    }

    fn start_agent(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        let spec = &AGENTS[self.agent_ix];
        let env = ["GHIDRA_INSTALL_DIR", "JAVA_HOME", "PATH", "HOME"]
            .into_iter()
            .filter_map(|key| std::env::var(key).ok().map(|value| (key.to_string(), value)))
            .collect();
        let tools = vec![McpTool {
            name: "rea".into(),
            command: self.rea.program.clone(),
            args: self.rea.args.clone(),
            env,
        }];
        let cwd = self
            .target
            .as_ref()
            .and_then(|path| path.parent().map(PathBuf::from))
            .or_else(dirs::home_dir)
            .unwrap_or_else(|| PathBuf::from("/"));
        let (sender, receiver) = async_channel::unbounded();
        match AgentSession::start(spec, cwd, tools, sender) {
            Ok(session) => self.session = Some(session),
            Err(err) => {
                self.messages
                    .push(Message::Note(format!("Couldn't start {}: {err}", spec.name)));
                return;
            }
        }
        cx.spawn_in(window, async move |this, cx| {
            while let Ok(event) = receiver.recv().await {
                if this
                    .update_in(cx, |this, window, cx| this.on_event(event, window, cx))
                    .is_err()
                {
                    break;
                }
            }
        })
        .detach();
    }

    fn on_event(&mut self, event: AgentEvent, window: &mut Window, cx: &mut Context<Self>) {
        match event {
            AgentEvent::Connected { agent } => self.connected = Some(agent),
            AgentEvent::Text(chunk) => self.agent_message().0.push_str(&chunk),
            AgentEvent::Thought(_) => {}
            AgentEvent::StepStarted { id, title, input } => {
                let (tool, label) = describe(&title, input.as_ref());
                self.agent_message().1.push(Step {
                    id,
                    tool,
                    title: label,
                    status: StepStatus::Running,
                });
                self.follow(input, window, cx);
            }
            AgentEvent::StepUpdated {
                id,
                status,
                title,
                input,
            } => {
                let (_, steps) = self.agent_message();
                if let Some(step) = steps.iter_mut().find(|step| step.id == id) {
                    step.status = status;
                    let tool = title.unwrap_or_else(|| step.tool.clone());
                    if input.is_some() || tool != step.tool {
                        (step.tool, step.title) = describe(&tool, input.as_ref());
                    }
                }
                self.follow(input, window, cx);
            }
            AgentEvent::Permission {
                request,
                title,
                choices,
            } => self.messages.push(Message::Permission {
                request,
                title: describe(&title, None).1.to_lowercase(),
                choices,
                answer: None,
            }),
            AgentEvent::TurnEnded => self.busy = false,
            AgentEvent::Failed(reason) => {
                self.busy = false;
                self.session = None;
                self.messages.push(Message::Note(reason));
            }
        }
        cx.notify();
    }

    fn agent_message(&mut self) -> (&mut String, &mut Vec<Step>) {
        if !matches!(self.messages.last(), Some(Message::Agent { .. })) {
            self.messages.push(Message::Agent {
                text: String::new(),
                steps: Vec::new(),
            });
        }
        match self.messages.last_mut() {
            Some(Message::Agent { text, steps }) => (text, steps),
            _ => unreachable!("an agent message was just pushed"),
        }
    }

    /// Opens whatever function the agent is reading in the canvas.
    fn follow(
        &mut self,
        input: Option<serde_json::Value>,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let Some(procedure) = input
            .as_ref()
            .and_then(|input| input.get("procedure"))
            .and_then(serde_json::Value::as_str)
            .map(str::to_string)
        else {
            return;
        };
        self.canvas_open = true;
        match self.canvas.iter().position(|tab| tab.procedure == procedure) {
            Some(ix) => self.active = ix,
            None => {
                self.canvas.push(CanvasTab {
                    procedure,
                    view: CodeView::Pseudocode,
                    code: None,
                });
                self.active = self.canvas.len() - 1;
                self.load(self.active, window, cx);
            }
        }
    }

    fn load(&mut self, ix: usize, window: &mut Window, cx: &mut Context<Self>) {
        let (Some(path), Some(tab)) = (self.target.clone(), self.canvas.get(ix)) else {
            return;
        };
        let procedure = Procedure {
            address: tab.procedure.clone(),
            name: tab.procedure.clone(),
            kind: ProcedureKind::Function,
        };
        let view = tab.view;
        let engine = self.engine.clone();
        let opened = self.opened.clone();
        cx.spawn_in(window, async move |this, cx| {
            let result = async {
                let target = match opened {
                    Some(target) => target,
                    None => engine.open(path).await?,
                };
                let code = engine.code(target.clone(), procedure, view).await?;
                Ok::<_, eleven_engine::EngineError>((target, code))
            }
            .await;
            this.update(cx, |this, cx| {
                let code = match result {
                    Ok((target, code)) => {
                        this.opened = Some(target);
                        code
                    }
                    Err(err) => format!("// {err}"),
                };
                if let Some(tab) = this.canvas.get_mut(ix) {
                    tab.code = Some(code);
                }
                cx.notify();
            })
        })
        .detach();
    }

    pub(crate) fn select_tab(&mut self, ix: usize, cx: &mut Context<Self>) {
        self.active = ix;
        cx.notify();
    }

    pub(crate) fn answer(
        &mut self,
        index: usize,
        choice: Option<PermissionChoice>,
        cx: &mut Context<Self>,
    ) {
        if let Some(Message::Permission {
            request, answer, ..
        }) = self.messages.get_mut(index)
        {
            if let Some(session) = &self.session {
                session.answer(*request, choice.as_ref().map(|c| c.id.clone()));
            }
            *answer = Some(choice.map_or_else(|| "Not allowed".into(), |c| c.label));
        }
        cx.notify();
    }

    pub(crate) fn pick_agent(&mut self, ix: usize, cx: &mut Context<Self>) {
        self.picker_open = false;
        if ix == self.agent_ix || self.busy {
            cx.notify();
            return;
        }
        self.agent_ix = ix;
        self.session = None;
        self.connected = None;
        if !self.messages.is_empty() {
            self.messages.push(Message::Note(format!(
                "Switched to {}. Your next message starts a fresh session.",
                AGENTS[ix].name
            )));
        }
        cx.notify();
    }

    pub(crate) fn new_thread(&mut self, cx: &mut Context<Self>) {
        self.session = None;
        self.connected = None;
        self.busy = false;
        self.messages.clear();
        self.canvas.clear();
        cx.notify();
    }

    pub(crate) fn set_target(&mut self, path: PathBuf, cx: &mut Context<Self>) {
        self.target = Some(path);
        self.opened = None;
        self.session = None;
        self.canvas.clear();
        cx.notify();
    }

    pub(crate) fn prompt_open(&mut self, _: &Open, window: &mut Window, cx: &mut Context<Self>) {
        let picked = cx.prompt_for_paths(PathPromptOptions {
            files: true,
            directories: true,
            multiple: false,
            prompt: Some("Open an app or binary".into()),
        });
        cx.spawn_in(window, async move |this, cx| {
            let path = picked.await.ok()?.ok()??.into_iter().next()?;
            this.update(cx, |this, cx| this.set_target(path, cx)).ok()
        })
        .detach();
    }

    pub(crate) fn open_workbench(&mut self, cx: &mut Context<Self>) {
        let engine = self.engine.clone();
        let target = self.target.clone();
        let options = WindowOptions {
            window_bounds: Some(WindowBounds::centered(size(px(1440.), px(900.)), cx)),
            titlebar: Some(crate::titlebar()),
            ..Default::default()
        };
        let _ = gpui_kit::open_window(options, cx, |window, cx| {
            cx.new(|cx| Workbench::new(engine, target, window, cx))
        });
    }

    pub(crate) fn thread_title(&self) -> Option<String> {
        self.messages.iter().find_map(|m| match m {
            Message::User(text) => Some(text.clone()),
            _ => None,
        })
    }
}

/// Turns a raw tool name and its input into the step label the user reads.
pub(crate) fn describe(tool: &str, input: Option<&serde_json::Value>) -> (String, String) {
    let name = tool
        .trim_start_matches("mcp__rea__")
        .trim_start_matches("rea__")
        .to_string();
    let arg = |key: &str| {
        input
            .and_then(|input| input.get(key))
            .and_then(serde_json::Value::as_str)
            .map(str::to_string)
    };
    let with = |label: &str, key: &str| match arg(key) {
        Some(value) => format!("{label} · {value}"),
        None => label.to_string(),
    };
    let label = match name.as_str() {
        "procedure_pseudo_code" => with("Read pseudocode", "procedure"),
        "procedure_assembly" => with("Read assembly", "procedure"),
        "procedure_callers" => with("Found who calls", "procedure"),
        "procedure_callees" => with("Found what it calls", "procedure"),
        "procedure_info" => with("Read function details", "procedure"),
        "open_binary" => "Opened the file".into(),
        "binary_overview" => "Read the overview".into(),
        "list_procedures" => "Listed functions".into(),
        "list_strings" => "Listed strings".into(),
        "search_strings" => with("Searched strings", "pattern"),
        "search_procedures" => with("Searched functions", "pattern"),
        "ToolSearch" => "Looked up its tools".into(),
        other => {
            let mut label = other.replace('_', " ");
            if let Some(first) = label.get_mut(0..1) {
                first.make_ascii_uppercase();
            }
            label
        }
    };
    (tool.to_string(), label)
}
