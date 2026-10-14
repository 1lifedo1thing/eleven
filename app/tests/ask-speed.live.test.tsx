import { afterAll, beforeAll, expect, test } from "bun:test";
import type { ReactElement } from "react";

import { adoptLoginShell } from "../src/agents/detect";
import { type Chat, useChat } from "../src/chat/useChat";
import { knownModels } from "../src/agents/models";
import { askPrompt, type Quote } from "../src/engine/ask";
import { askQuietly } from "../src/engine/rewrite";
import { prepareTarget } from "../src/engine/target";
import { adoptToolchain } from "../src/engine/toolchain";
import { askWarm, type QuickAsk, warmAsk } from "../src/engine/warm";
import { Screen } from "./harness";

const LS = prepareTarget("/bin/ls");
const CODE = ["undefined8 entry(void)", "", "{", "  iVar7 = _isatty(1);", "  if (iVar7 == 0) {", "    DAT_10000c0d0 = 1;", "  }", "  return 0;", "}"];
const QUOTE: Quote = { about: "entry in ls, its decompiled pseudocode", from: 4, to: 7, lines: CODE.slice(3, 7), code: CODE, fence: "c" };
const PROMPT = askPrompt(QUOTE, [], "What does this do?");

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

async function timed(run: (onText: () => void) => Promise<string>): Promise<{ readonly first: number; readonly total: number; readonly reply: string }> {
  const start = Date.now();
  let first = 0;
  const reply = await run(() => {
    first ||= Date.now() - start;
  });
  return { first, total: Date.now() - start, reply };
}

test("a warm agent with no tool servers answers much sooner than a fresh one with tools", async () => {
  await screen.until(() => chat !== null, 10_000);
  const live = chat;
  if (!live) throw new Error("no chat");
  const agent = live.agents.selected;
  const req: QuickAsk = { agent, native: live.agents.installed.get(agent.id)?.command ?? null, projectId: "speed", binary: { path: LS.path }, tune: { model: null, fast: false } };
  const cold = await timed((onText) => askQuietly(req, PROMPT, ({ reply }) => reply && onText()));
  warmAsk(req);
  await new Promise((resolve) => setTimeout(resolve, 15_000));
  const warm = await timed((onText) => askWarm(req, PROMPT, ({ reply }) => reply && onText()));
  console.log(`${agent.name}: fresh with tools first text ${cold.first} ms, done ${cold.total} ms; warm without tools first text ${warm.first} ms, done ${warm.total} ms`);
  const small = knownModels(agent.id).find((choice) => /haiku|mini|flash/i.test(`${choice.value} ${choice.name}`));
  if (small) {
    const quick = { ...req, tune: { model: small.value, fast: false } };
    warmAsk(quick);
    await new Promise((resolve) => setTimeout(resolve, 15_000));
    const fastest = await timed((onText) => askWarm(quick, PROMPT, ({ reply }) => reply && onText()));
    console.log(`${agent.name} with ${small.name}: first text ${fastest.first} ms, done ${fastest.total} ms`);
  }
  expect(warm.reply).toContain("isatty");
  expect(warm.first).toBeLessThan(cold.first);
}, 240_000);
