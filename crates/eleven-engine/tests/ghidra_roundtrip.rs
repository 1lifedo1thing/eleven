//! Runs real REA and Ghidra. Needs `ELEVEN_REA`, `GHIDRA_INSTALL_DIR` and a C compiler:
//! `ELEVEN_REA=/path/to/rea.mjs cargo test -p eleven-engine -- --ignored`

use std::path::PathBuf;
use std::process::Command;
use std::time::Instant;

use eleven_engine::{CodeView, Engine, EngineConfig, ProcedureKind, ReaLaunch};

const FIXTURE: &str = r#"
#include <stdio.h>
int main(int argc, char **argv) {
  puts(argc > 1 ? "valid" : "usage: check <key>");
  return argc > 1 ? 0 : 2;
}
"#;

#[test]
#[ignore = "needs REA, Ghidra and a C compiler"]
fn second_open_reads_from_cache_without_ghidra() {
    let rea = PathBuf::from(std::env::var_os("ELEVEN_REA").expect("set ELEVEN_REA"));
    let work = tempfile::tempdir().expect("temp dir");
    let source = work.path().join("check.c");
    let binary = work.path().join("check");
    std::fs::write(&source, FIXTURE).expect("write fixture");
    let built = Command::new("cc")
        .arg("-O1")
        .arg("-o")
        .arg(&binary)
        .arg(&source)
        .status()
        .expect("run cc");
    assert!(built.success(), "fixture builds");

    let engine = Engine::new(EngineConfig {
        rea: ReaLaunch::from_path(rea),
        cache_dir: work.path().join("cache"),
    })
    .expect("engine starts");
    let runtime = engine_runtime();

    let target = runtime.block_on(engine.open(binary.clone())).expect("open");
    let procedures = runtime
        .block_on(engine.procedures(target.clone()))
        .expect("procedures");
    let entry = procedures
        .iter()
        .find(|procedure| procedure.kind == ProcedureKind::Function)
        .expect("a local function")
        .clone();
    let pseudocode = runtime
        .block_on(engine.code(target.clone(), entry.clone(), CodeView::Pseudocode))
        .expect("pseudocode");
    assert!(
        pseudocode.contains("_puts"),
        "pseudocode calls puts:\n{pseudocode}"
    );

    let fresh = Engine::new(EngineConfig {
        rea: ReaLaunch::from_path("/nonexistent/rea".into()),
        cache_dir: work.path().join("cache"),
    })
    .expect("engine starts");
    let started = Instant::now();
    let cached = runtime
        .block_on(fresh.procedures(target.clone()))
        .expect("cached procedures");
    let cached_code = runtime
        .block_on(fresh.code(target, entry, CodeView::Pseudocode))
        .expect("cached pseudocode");

    assert_eq!((cached, cached_code), (procedures, pseudocode));
    assert!(
        started.elapsed().as_millis() < 500,
        "cache answers without Ghidra"
    );
}

fn engine_runtime() -> tokio::runtime::Runtime {
    tokio::runtime::Builder::new_current_thread()
        .build()
        .expect("test runtime")
}
