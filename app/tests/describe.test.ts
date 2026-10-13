import { expect, test } from "bun:test";

import { toolLabel } from "../src/agents/describe";

test("a shell command reads as its description", () => {
  const input = { command: "python3 -c \"\nimport onnx\nm.producer_name\n\"", description: "Parse ONNX graph, metadata and weights" };
  expect(toolLabel("python3 -c \"\nimport onnx\nm.producer_name", input)).toEqual({ label: "Parse ONNX graph, metadata and weights", detail: null });
});

test("a shell command without a description shows its first line", () => {
  expect(toolLabel("cd /tmp && ls", { command: "cd /tmp && ls\npwd" })).toEqual({ label: "Run a command", detail: "cd /tmp && ls" });
});

test("a command sent only as the title stays as written, first line only", () => {
  expect(toolLabel("strings -n 3 hey_hermes.onnx | sort\nhead", undefined)).toEqual({ label: "strings -n 3 hey_hermes.onnx | sort", detail: null });
});

test("tool ids still read as words", () => {
  expect(toolLabel("mcp__eleven__set_view", {})).toEqual({ label: "Set view", detail: null });
  expect(toolLabel("procedure_pseudo_code", { procedure: "FUN_1" })).toEqual({ label: "Read pseudocode", detail: "FUN_1" });
});
