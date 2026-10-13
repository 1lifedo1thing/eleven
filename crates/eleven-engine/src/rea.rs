use std::path::{Path, PathBuf};
use std::process::Stdio;

use rmcp::model::{CallToolRequestParams, CallToolResult};
use rmcp::service::RunningService;
use rmcp::transport::TokioChildProcess;
use rmcp::{RoleClient, ServiceExt};
use serde::Deserialize;
use serde_json::{Map, Value, json};
use tokio::process::Command;

use crate::{CodeView, EngineError, Procedure, ProcedureKind, Result, Target};

const PROVIDER: &str = "ghidra";

/// How to start REA's MCP server: a `rea` binary, or `node` with REA's entry script.
#[derive(Debug, Clone)]
pub struct ReaLaunch {
    pub program: PathBuf,
    pub args: Vec<String>,
}

impl ReaLaunch {
    pub fn from_path(path: PathBuf) -> Self {
        let is_script = path
            .extension()
            .is_some_and(|ext| ext == "mjs" || ext == "js");
        if is_script {
            Self {
                program: "node".into(),
                args: vec![path.to_string_lossy().into_owned(), "mcp".into()],
            }
        } else {
            Self {
                program: path,
                args: vec!["mcp".into()],
            }
        }
    }
}

pub(crate) struct Session {
    client: RunningService<RoleClient, ()>,
}

impl Session {
    pub(crate) async fn start(launch: &ReaLaunch) -> Result<Self> {
        let mut command = Command::new(&launch.program);
        command.args(&launch.args);
        let (transport, _) = TokioChildProcess::builder(command)
            .stderr(Stdio::null())
            .spawn()
            .map_err(EngineError::ReaUnavailable)?;
        let client =
            ().serve(transport)
                .await
                .map_err(|err| EngineError::Protocol(err.to_string()))?;
        Ok(Self { client })
    }

    pub(crate) async fn open_binary(&self, path: &Path) -> Result<Target> {
        #[derive(Deserialize)]
        struct Opened {
            sha256: String,
            format: String,
            architecture: String,
        }
        let reply = self
            .call(
                "open_binary",
                json!({ "path": path, "provider_id": PROVIDER }),
            )
            .await?;
        let opened: Opened = parse(reply.get("result").cloned().unwrap_or(reply))?;
        Ok(Target {
            path: path.to_path_buf(),
            sha256: opened.sha256,
            format: opened.format,
            architecture: opened.architecture,
        })
    }

    pub(crate) async fn procedures(&self) -> Result<Vec<Procedure>> {
        let reply = self.call("list_procedures", json!({})).await?;
        parse_procedures(normalized(reply)?)
    }

    pub(crate) async fn code(&self, address: &str, view: CodeView) -> Result<String> {
        let tool = match view {
            CodeView::Pseudocode => "procedure_pseudo_code",
            CodeView::Assembly => "procedure_assembly",
        };
        let reply = self.call(tool, json!({ "procedure": address })).await?;
        match normalized(reply)? {
            Value::String(code) => Ok(code.trim_matches('\n').to_string()),
            Value::Null => Ok(String::new()),
            other => Err(EngineError::Protocol(format!("{tool} returned {other}"))),
        }
    }

    async fn call(&self, tool: &'static str, arguments: Value) -> Result<Value> {
        let Value::Object(arguments) = arguments else {
            unreachable!("tool arguments are always built as JSON objects")
        };
        let result = self
            .client
            .call_tool(CallToolRequestParams::new(tool).with_arguments(arguments))
            .await
            .map_err(|err| EngineError::Protocol(err.to_string()))?;
        if result.is_error == Some(true) {
            return Err(tool_error(&result));
        }
        result
            .structured_content
            .ok_or_else(|| EngineError::Protocol(format!("{tool} returned no structured content")))
    }
}

fn normalized(mut reply: Value) -> Result<Value> {
    reply
        .get_mut("normalized_result")
        .map(Value::take)
        .ok_or_else(|| EngineError::Protocol("reply has no normalized_result".into()))
}

fn parse<T: for<'de> Deserialize<'de>>(value: Value) -> Result<T> {
    serde_json::from_value(value).map_err(|err| EngineError::Protocol(err.to_string()))
}

pub(crate) fn parse_procedures(value: Value) -> Result<Vec<Procedure>> {
    #[derive(Deserialize)]
    struct Entry {
        address: String,
        value: String,
        procedure: Facts,
    }
    #[derive(Deserialize)]
    struct Facts {
        external: bool,
        thunk: bool,
    }
    let entries: Vec<Entry> = parse(value)?;
    Ok(entries
        .into_iter()
        .map(|entry| Procedure {
            kind: match (entry.procedure.external, entry.procedure.thunk) {
                (true, _) => ProcedureKind::External,
                (false, true) => ProcedureKind::Thunk,
                (false, false) => ProcedureKind::Function,
            },
            address: entry.address,
            name: entry.value,
        })
        .collect())
}

pub(crate) fn tool_error(result: &CallToolResult) -> EngineError {
    #[derive(Deserialize)]
    struct Envelope {
        error: Detail,
    }
    #[derive(Deserialize)]
    struct Detail {
        message: String,
        #[serde(default)]
        remediation: Option<Map<String, Value>>,
        #[serde(default)]
        details: Option<Value>,
    }
    let text = result
        .content
        .iter()
        .find_map(|block| block.as_text())
        .map(|text| text.text.as_str())
        .unwrap_or_default();
    let Ok(Envelope { error }) = serde_json::from_str::<Envelope>(text) else {
        return EngineError::Rea {
            message: text.to_string(),
            action: String::new(),
        };
    };
    let issue = error
        .details
        .as_ref()
        .and_then(|details| details.pointer("/issues/0/message"))
        .and_then(Value::as_str);
    EngineError::Rea {
        message: issue.map_or(error.message, str::to_string),
        action: error
            .remediation
            .and_then(|remediation| remediation.get("action").cloned())
            .and_then(|action| action.as_str().map(str::to_string))
            .unwrap_or_default(),
    }
}

#[cfg(test)]
#[path = "rea_tests.rs"]
mod tests;
