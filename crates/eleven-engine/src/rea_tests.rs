use rmcp::model::{CallToolResult, ContentBlock};
use serde_json::json;

use super::*;

#[test]
fn procedures_keep_kind_from_ghidra_facts() {
    let listed = json!([
        {"address": "EXTERNAL:0x1", "value": "/usr/lib/libSystem.B.dylib::_puts",
         "procedure": {"external": true, "thunk": false, "thunk_target": null}},
        {"address": "0x100000460", "value": "entry",
         "procedure": {"external": false, "thunk": false, "thunk_target": null}},
        {"address": "0x10000050c", "value": "_puts",
         "procedure": {"external": false, "thunk": true, "thunk_target": "EXTERNAL:0x1"}}
    ]);

    let procedures = parse_procedures(listed).expect("REA's procedure list parses");

    assert_eq!(
        procedures,
        vec![
            Procedure {
                address: "EXTERNAL:0x1".into(),
                name: "/usr/lib/libSystem.B.dylib::_puts".into(),
                kind: ProcedureKind::External,
            },
            Procedure {
                address: "0x100000460".into(),
                name: "entry".into(),
                kind: ProcedureKind::Function,
            },
            Procedure {
                address: "0x10000050c".into(),
                name: "_puts".into(),
                kind: ProcedureKind::Thunk,
            },
        ]
    );
}

#[test]
fn tool_errors_surface_the_specific_issue_and_next_step() {
    let body = json!({"error": {
        "code": "invalid_request",
        "message": "Analysis input is invalid. Check the arguments and try again.",
        "remediation": {"action": "Correct the listed arguments and retry."},
        "details": {"issues": [{"message": "Unknown Ghidra procedure name or address: nope"}]}
    }});
    let result = CallToolResult::error(vec![ContentBlock::text(body.to_string())]);

    let error = tool_error(&result);

    assert_eq!(
        error.to_string(),
        "Unknown Ghidra procedure name or address: nope Correct the listed arguments and retry."
    );
}
