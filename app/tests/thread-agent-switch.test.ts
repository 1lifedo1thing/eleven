import { expect, test } from "bun:test";

import type { SessionOption } from "../src/agents/events";
import { EMPTY_THREAD, threadReducer } from "../src/chat/thread";

const model: SessionOption = { id: "model", name: "Model", category: "model", current: "flash", choices: [{ value: "flash", name: "Deepseek Flash Medium", description: null }], legacyMode: false };

test("thread: switching agents drops the old agent's model, mode and commands", () => {
  const ready = threadReducer(threadReducer(EMPTY_THREAD, { type: "event", event: { kind: "connected", agent: "DeepSeek" }, at: 0 }), { type: "event", event: { kind: "options", options: [model] }, at: 0 });
  expect(ready.options).toEqual([model]);
  const switched = threadReducer(ready, { type: "switchAgent" });
  expect(switched.options).toEqual([]);
  expect(switched.commands).toEqual([]);
  expect(switched.agent).toEqual({ kind: "idle" });
});
