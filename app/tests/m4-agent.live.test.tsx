import { afterAll, beforeAll, test } from "bun:test";
import type { ReactElement } from "react";

import { adoptLoginShell } from "../src/agents/detect";
import { startAppBridge, useLiveChat } from "../src/bridge/live";
import { type Chat, useChat } from "../src/chat/useChat";
import { prepareTarget } from "../src/engine/target";
import { adoptToolchain } from "../src/engine/toolchain";
import { Screen } from "./harness";

const LS = prepareTarget("/bin/ls");
let screen: Screen;
let chat: Chat | null = null;

function Live(): ReactElement {
  const live = useChat(LS, () => {});
  useLiveChat(live);
  chat = live;
  const tabs = live.thread.state.tabs.map((tab) => tab.procedure).join(",");
  return <div>{`ready=${live.thread.state.agent.kind} tabs=${tabs} messages=${live.thread.state.messages.length}`}</div>;
}

beforeAll(async () => {
  await adoptLoginShell();
  adoptToolchain();
  startAppBridge();
  screen = new Screen().render(<Live />);
});

afterAll(() => screen.unmount());

test("M4 gate: a real agent moves the user's view with Eleven's tool", async () => {
  await screen.until(() => screen.text().includes("ready=ready"), 120_000);
  chat?.thread.send("Without reading any code first, call the eleven server's open_function tool with function FUN_1000016d8 so I can see it. Then reply with one word: done.");
  await screen.until(() => screen.text().includes("FUN_1000016d8"), 240_000);
}, 400_000);
