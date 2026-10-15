import { expect, test } from "bun:test";

import { askButtons, noteFor } from "../src/notify/moments";

const chat = { id: "c1", title: "Find the key exchange", project: "Signal" };

test("notify: a finished turn shows the chat and the first line of the answer", () => {
  const note = noteFor({ kind: "agentDone", chat, agent: "Claude Code", answer: "## Summary\n\nRenamed 14 crypto helpers in libsignal.\nMore detail below." });
  expect(note).toEqual({ tag: "done:c1", title: "Find the key exchange", body: "Claude Code: Renamed 14 crypto helpers in libsignal.", actions: [] });
});

test("notify: an empty answer still says who finished, and an untitled chat falls back to the project", () => {
  const note = noteFor({ kind: "agentDone", chat: { ...chat, title: "" }, agent: "Codex", answer: "" });
  expect(note.title).toBe("Signal");
  expect(note.body).toBe("Codex finished.");
});

test("notify: long answers stop at a sentence", () => {
  const answer = `${"The handshake derives the root key from both identity keys. ".repeat(4)}`;
  const body = noteFor({ kind: "agentDone", chat, agent: "Claude Code", answer }).body;
  expect(body.length).toBeLessThan(180);
  expect(body.endsWith(".")).toBe(true);
});

test("notify: a permission request offers one way to allow and one way to refuse", () => {
  const choices = [
    { id: "always", label: "Always allow", allows: true },
    { id: "once", label: "Allow", allows: true },
    { id: "no", label: "Reject", allows: false },
  ];
  expect(askButtons(choices).map((choice) => choice.id)).toEqual(["always", "no"]);
  const note = noteFor({ kind: "agentNeedsYou", chat, agent: "Claude Code", ask: 3, tool: "Run xcrun lldb", input: {}, choices });
  expect(note.tag).toBe("ask:c1:3");
  expect(note.title).toBe("Claude Code needs your OK");
  expect(note.body).toBe("Run xcrun lldb in Signal");
  expect(note.actions).toEqual([{ id: "always", label: "Always allow" }, { id: "no", label: "Reject" }]);
});

test("notify: a shell command reads as its description, never the raw command", () => {
  const tool = "cd /Users/chizi/Library/Caches/eleven/ipa/8e49/Payload/Game.app; f=Data/Managed/Metadata/global-metadata.dat; for x in *; do echo $x; done";
  const asked = { kind: "agentNeedsYou", chat, agent: "Claude Code", ask: 4, choices: [] } as const;
  expect(noteFor({ ...asked, tool, input: { command: tool, description: "Check the IL2CPP metadata file" } }).body).toBe("Check the IL2CPP metadata file in Signal");
  expect(noteFor({ ...asked, tool, input: { command: tool } }).body).toBe("Run a command in Signal");
  expect(noteFor({ ...asked, tool, input: { command: ["bash", "-lc", tool] } }).body).toBe("Run a command in Signal");
  expect(noteFor({ ...asked, tool, input: undefined }).body).toBe("Run a command in Signal");
});

test("notify: a slow open says which engine finished and how much it found", () => {
  const note = noteFor({ kind: "opened", project: "p1", name: "Telegram", engine: "Ghidra", functions: 48211 });
  expect(note).toEqual({ tag: "opened:p1", title: "Telegram is ready", body: "Ghidra finished reading 48,211 functions.", actions: [] });
});
