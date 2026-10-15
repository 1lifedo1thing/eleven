import "./fixtures/isolate";
import { expect, test } from "bun:test";
import { join } from "node:path";

import type { AgentEvent } from "../src/agents/events";
import { rememberPick, savedPicks } from "../src/agents/picks";
import type { AgentEntry } from "../src/agents/registry";
import { AgentSession } from "../src/agents/session";

const FAKE: AgentEntry = { id: "fake-agent", name: "Fake", description: "", version: "1", iconUrl: null, distribution: { kind: "command", command: process.execPath, args: [] } };

async function reply(picks: boolean): Promise<string> {
  let text = "";
  const done = Promise.withResolvers<void>();
  const sink = (event: AgentEvent): void => {
    if (event.kind === "text") text += event.text;
    if (event.kind === "turnEnded" || event.kind === "failed") done.resolve();
  };
  const session = new AgentSession(FAKE, { path: process.execPath, args: [join(import.meta.dir, "fixtures", "fakeAgent.ts")] }, import.meta.dir, sink, "chat", null, null, false);
  if (picks) session.restore(savedPicks(FAKE.id));
  await session.prompt("hi");
  await done.promise;
  session.stop();
  return text;
}

test("the model and effort you picked come back in the next session, model first, and unknown values are skipped", async () => {
  expect(await reply(true)).toBe("model=default effort=medium");
  rememberPick(FAKE.id, "effort", "high");
  rememberPick(FAKE.id, "model", "opus");
  rememberPick(FAKE.id, "speed", "fast");
  expect(savedPicks(FAKE.id)).toEqual({ effort: "high", model: "opus", speed: "fast" });
  expect(await reply(true)).toBe("model=opus effort=high");
  expect(await reply(false)).toBe("model=default effort=medium");
  rememberPick(FAKE.id, "model", "gone-model");
  expect(await reply(true)).toBe("model=default effort=high");
}, 30_000);
