import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ReactElement, useState } from "react";

import type { Chat } from "../src/chat/useChat";
import type { Target } from "../src/engine/target";

process.env.ELEVEN_SUPPORT = mkdtempSync(join(tmpdir(), "eleven-window-"));

const { saveThread, loadThread } = await import("../src/chat/history");
const { useChat } = await import("../src/chat/useChat");
const { projectId, rememberProject } = await import("../src/engine/project");
const { prepareTarget } = await import("../src/engine/target");
const { Screen } = await import("./harness");

const ls = prepareTarget("/bin/ls");
const cat = prepareTarget("/bin/cat");

function seed(id: string, target: Target | null): void {
  saveThread({ id, title: id, target: target?.original ?? null, project: target ? projectId(target) : null, messages: [{ kind: "user", text: id, at: 1 }], updatedAt: 1 });
}

seed("ls-chat", ls);
seed("cat-chat", cat);
seed("lobby-chat", null);

let chat: Chat | null = null;

function Probe(): ReactElement {
  const [target, setTarget] = useState<Target | null>(null);
  chat = useChat(target, setTarget);
  return <div>{`project ${chat.project ?? "none"}`}</div>;
}

function live(): Chat {
  if (!chat) throw new Error("The chat hasn't rendered.");
  return chat;
}

const savedIds = (): readonly string[] => live().saved.map((summary) => summary.id);

const screen = new Screen().render(<Probe />);

test("window: with no file open, only chats without a project are listed", async () => {
  await screen.until(() => chat !== null, 5_000);
  expect(live().project).toBeNull();
  expect(savedIds()).toEqual(["lobby-chat"]);
});

test("window: opening a chat moves the window into its project and lists only that project's chats", async () => {
  live().openThread("ls-chat");
  await screen.until(() => live().project === projectId(ls), 10_000);
  expect(live().target?.path).toBe(ls.path);
  expect(savedIds()).toEqual(["ls-chat"]);
  expect(live().thread.id).toBe("ls-chat");
  expect(live().tabs).toHaveLength(1);
});

test("window: a chat from another project swaps the whole window, leaving the old tabs behind", async () => {
  live().newTab();
  await screen.until(() => live().tabs.length === 2, 5_000);
  live().openThread("cat-chat");
  await screen.until(() => live().project === projectId(cat), 10_000);
  expect(live().tabs.map((tab) => tab.id)).toEqual(["cat-chat"]);
  expect(savedIds()).toEqual(["cat-chat"]);
});

test("window: the project list holds every project opened, and opening one starts a fresh chat there", async () => {
  await screen.until(() => live().projects.length === 2, 5_000);
  const lsProject = live().projects.find((entry) => entry.id === projectId(ls));
  if (!lsProject) throw new Error("ls isn't in the project list.");
  expect(live().openProject(lsProject)?.path).toBe(ls.path);
  await screen.until(() => live().project === projectId(ls), 10_000);
  expect(live().thread.id).not.toBe("cat-chat");
  expect(live().thread.state.messages).toHaveLength(0);
  expect(loadThread("cat-chat")?.project).toBe(projectId(cat));
});

test("window: a chat never leaves the project it joined, even when its file is detached", async () => {
  live().openThread("ls-chat");
  await screen.until(() => live().thread.id === "ls-chat", 10_000);
  live().detach();
  await screen.until(() => live().project === null, 10_000);
  expect(live().thread.id).not.toBe("ls-chat");
  expect(loadThread("ls-chat")?.project).toBe(projectId(ls));
});

test("window: chats stay listed after the binary changes in place, as long as it's the same file you picked", async () => {
  const patched = join(process.env.ELEVEN_SUPPORT ?? "", "ls-patched");
  writeFileSync(patched, Buffer.concat([readFileSync(ls.path), Buffer.from("patched")]));
  const before = rememberProject({ ...ls, path: patched }, 1);
  saveThread({ id: "before-patch", title: "before-patch", target: ls.original, project: before, messages: [{ kind: "user", text: "hi", at: 1 }], updatedAt: 2 });
  live().openThread("ls-chat");
  await screen.until(() => live().project === projectId(ls) && live().saved.length === 2, 10_000);
  expect([...savedIds()].sort()).toEqual(["before-patch", "ls-chat"]);
  live().openThread("before-patch");
  await screen.until(() => live().thread.id === "before-patch", 10_000);
  expect(live().project).toBe(projectId(ls));
});
