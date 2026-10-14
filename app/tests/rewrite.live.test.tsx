import { afterAll, beforeAll, expect, test } from "bun:test";
import type { ReactElement } from "react";

import { adoptLoginShell } from "../src/agents/detect";
import { type Chat, useChat } from "../src/chat/useChat";
import { rewrite } from "../src/engine/rewrite";
import { prepareTarget } from "../src/engine/target";
import { adoptToolchain } from "../src/engine/toolchain";
import { Screen } from "./harness";

const LS = prepareTarget("/bin/ls");
let screen: Screen;
let chat: Chat | null = null;

function Live(): ReactElement {
  chat = useChat(LS, () => {});
  return <div>{`agent=${chat.agents.selected.name}`}</div>;
}

beforeAll(async () => {
  await adoptLoginShell();
  adoptToolchain();
  screen = new Screen().render(<Live />);
});

afterAll(() => screen.unmount());

test("a real agent rewrites quietly, streams as it writes, then translates and caches", async () => {
  await screen.until(() => chat !== null, 10_000);
  const live = chat;
  if (!live) throw new Error("no chat");
  const agent = live.agents.selected;
  const base = {
    agent,
    native: live.agents.installed.get(agent.id)?.command ?? null,
    projectId: `live-${Date.now()}`,
    binary: { path: LS.path, name: "ls", arch: "arm64" },
    fn: { name: "add_sizes", addr: "0x100000700" },
    pseudocode: "long add_sizes(long *sizes, int count) {\n  long total = 0;\n  for (int i = 0; i < count; i++) total += sizes[i];\n  return total;\n}",
    callers: ["main"],
    callees: [],
    notes: [],
  } as const;
  const steps: string[] = [];
  let streamed = 0;
  let started = Date.now();
  const python = await rewrite({ ...base, language: "Python" }, ({ step, code }) => {
    if (step && steps.at(-1) !== step) steps.push(step);
    if (code !== null) streamed += 1;
  });
  const first = Date.now() - started;
  started = Date.now();
  const rust = await rewrite({ ...base, language: "Rust" });
  const second = Date.now() - started;
  started = Date.now();
  const again = await rewrite({ ...base, language: "Rust" });
  const cached = Date.now() - started;
  console.log({ first, second, cached, steps, streamed });
  console.log(rust);
  expect(python).toContain("def ");
  expect(rust).toContain("fn ");
  expect(again).toBe(rust);
  expect(streamed).toBeGreaterThan(1);
  expect(cached).toBeLessThan(200);
}, 400_000);
