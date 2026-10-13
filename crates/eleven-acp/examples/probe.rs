//! `cargo run -p eleven-acp --example probe -- <agent-id> <binary>` runs one turn with REA attached.

use std::path::PathBuf;

use eleven_acp::{AGENTS, AgentEvent, AgentSession, McpTool};

fn main() {
    let mut args = std::env::args().skip(1);
    let id = args.next().unwrap_or_else(|| "claude".into());
    let binary = PathBuf::from(args.next().expect("binary path"));
    let rea = std::env::var("ELEVEN_REA").expect("set ELEVEN_REA");
    let spec = AGENTS.iter().find(|a| a.id == id).expect("known agent");
    let env = ["GHIDRA_INSTALL_DIR", "JAVA_HOME", "PATH"]
        .into_iter()
        .filter_map(|k| std::env::var(k).ok().map(|v| (k.to_string(), v)))
        .collect();
    let (tx, rx) = async_channel::unbounded();
    let session = AgentSession::start(
        spec,
        binary.parent().expect("dir").to_path_buf(),
        vec![McpTool {
            name: "rea".into(),
            command: "node".into(),
            args: vec![rea, "mcp".into()],
            env,
        }],
        tx,
    )
    .expect("start");
    session.prompt(format!(
        "Use the rea tools: open_binary {} with provider_id \"ghidra\", then read the pseudocode of its entry function and tell me in two sentences what the program does.",
        binary.display()
    ));
    while let Ok(event) = rx.recv_blocking() {
        match event {
            AgentEvent::Text(t) => print!("{t}"),
            AgentEvent::Permission {
                request,
                title,
                choices,
            } => {
                println!("\n[permission] {title} -> {}", choices[0].label);
                session.answer(request, Some(choices[0].id.clone()));
            }
            AgentEvent::TurnEnded => {
                println!("\n[turn ended]");
                break;
            }
            AgentEvent::Failed(e) => {
                println!("\n[failed] {e}");
                break;
            }
            other => println!("\n[{other:?}]"),
        }
    }
}
