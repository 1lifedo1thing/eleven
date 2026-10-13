import { afterAll, beforeAll, test } from "bun:test";
import { join } from "node:path";
import type { ReactElement } from "react";

import { adoptLoginShell } from "../src/agents/detect";
import { startAppBridge, useLiveChat } from "../src/bridge/live";
import { type Chat, useChat } from "../src/chat/useChat";
import { prepareTarget } from "../src/engine/target";
import { adoptToolchain } from "../src/engine/toolchain";
import { Screen } from "./harness";

const APP = prepareTarget(join(import.meta.dir, "fixtures", "PhotoFilter.app"));
let screen: Screen;
let chat: Chat | null = null;

function Live(): ReactElement {
  const live = useChat(APP, () => {});
  useLiveChat(live);
  chat = live;
  const reply = live.thread.state.messages.flatMap((m) => (m.kind === "agent" ? m.blocks.flatMap((b) => (b.kind === "text" ? [b.text] : [])) : [])).join(" ");
  return <div>{`ready=${live.thread.state.agent.kind} reply=${reply}`}</div>;
}

beforeAll(async () => {
  await adoptLoginShell();
  adoptToolchain();
  startAppBridge();
  screen = new Screen().render(<Live />);
}, 30_000);

afterAll(() => screen.unmount());

test("M6 gate: the agent reads the GPU recording and names a real fix", async () => {
  await screen.until(() => screen.text().includes("ready=ready"), 120_000);
  chat?.thread.send("Call the eleven server's gpu_profile tool, then tell me in one sentence the single most useful change to make this app faster. Don't read the binary.");
  await screen.until(() => /in flight|addCompletedHandler|waitUntilCompleted|wait(s|ing)? (for|on) (each|every)/i.test(screen.text()) && screen.text().includes("ready=ready"), 240_000);
}, 400_000);
