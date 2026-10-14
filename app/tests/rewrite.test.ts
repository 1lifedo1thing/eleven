import "./fixtures/isolate";

import { expect, test } from "bun:test";

import { codeFrom, codeSoFar, type RewriteRequest, rewritePrompt } from "../src/engine/rewrite";

const REQUEST: RewriteRequest = {
  language: "Rust",
  agent: { id: "test", name: "Test agent", description: "", version: "1", iconUrl: null, distribution: { kind: "command", command: "true", args: [] } },
  native: null,
  projectId: "abc",
  binary: { path: "/bin/ls", name: "ls", arch: "arm64" },
  fn: { name: "print_usage", addr: "0x100004088" },
  pseudocode: "void print_usage(void) {\n  puts(\"usage: ls\");\n}",
  callers: ["main"],
  callees: ["_puts"],
  notes: ["Prints help and exits"],
};

test("the rewrite prompt carries the function's context, not just its pseudocode", () => {
  const prompt = rewritePrompt(REQUEST);
  expect(prompt).toContain("idiomatic Rust");
  expect(prompt).toContain("print_usage (at 0x100004088)");
  expect(prompt).toContain("ls (arm64), at /bin/ls");
  expect(prompt).toContain("Called by: main");
  expect(prompt).toContain("Calls: _puts");
  expect(prompt).toContain("Note from the user: Prints help and exits");
  expect(prompt).toContain("```rust");
  expect(prompt).toContain('puts("usage: ls");');
  expect(prompt).toContain("Only read");
});

test("long caller lists are capped", () => {
  const callers = Array.from({ length: 55 }, (_, ix) => `fn_${ix}`);
  expect(rewritePrompt({ ...REQUEST, callers })).toContain("and 15 more");
});

test("the code comes out of the reply's fenced block", () => {
  expect(codeFrom("Here it is:\n```rust\nfn print_usage() {\n    println!(\"usage: ls\");\n}\n```\nDone.")).toBe('fn print_usage() {\n    println!("usage: ls");\n}');
  expect(codeFrom("```c#\nclass A {}\n```")).toBe("class A {}");
  expect(codeFrom("fn bare() {}\n")).toBe("fn bare() {}");
});

test("with an earlier rewrite, the prompt translates it instead of reading around again", () => {
  const prompt = rewritePrompt({ ...REQUEST, language: "Go" }, { language: "Rust", code: "fn print_usage() {}" });
  expect(prompt).toContain("You already rewrote it in Rust");
  expect(prompt).toContain("```rust\nfn print_usage() {}\n```");
  expect(prompt).not.toContain("Read whatever helps");
  expect(prompt).toContain("```go code block");
});

test("code so far streams from the moment the fence opens", () => {
  expect(codeSoFar("Let me look at the callers first.")).toBeNull();
  expect(codeSoFar("```rust\nfn main() {\n    let x")).toBe("fn main() {\n    let x");
  expect(codeSoFar("```rust\nfn main() {}\n```\nDone")).toBe("fn main() {}\n");
});

test("a ``` inside a doc comment doesn't end the code", () => {
  const reply = "```rust\n/// Example:\n/// ```\n/// add(1, 2)\n/// ```\nfn add(a: i32, b: i32) -> i32 {\n    a + b\n}\n```";
  expect(codeFrom(reply)).toBe("/// Example:\n/// ```\n/// add(1, 2)\n/// ```\nfn add(a: i32, b: i32) -> i32 {\n    a + b\n}");
});
