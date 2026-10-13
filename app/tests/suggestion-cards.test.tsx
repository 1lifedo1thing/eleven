import "./fixtures/isolate";
import { afterAll, beforeAll, expect, test } from "bun:test";
import type { ReactElement } from "react";

import { type Chat, useChat } from "../src/chat/useChat";
import type { Author } from "../src/engine/edits";
import { propose } from "../src/engine/history";
import { DARK, ThemeContext } from "../src/theme";
import { SETTLED_FOR_MS } from "../src/workbench/Suggestions";
import { WorkbenchView } from "../src/workbench/Workbench";
import { NO_GPU, SAMPLE_PROGRAM } from "./fixtures/sampleProgram";
import { Screen } from "./harness";

const ID = SAMPLE_PROGRAM.id;
const AGENT: Author = { kind: "agent", agent: "Claude", chat: null };

let live: Chat | null = null;

function SampleBench(): ReactElement {
  const chat = useChat(null, () => {});
  live = chat;
  return (
    <ThemeContext.Provider value={{ p: DARK, appearance: "Dark", setAppearance: () => {} }}>
      <WorkbenchView program={SAMPLE_PROGRAM} problem={null} since={null} code gpu={NO_GPU} chat={chat} onBack={() => {}} onOpen={() => {}} />
    </ThemeContext.Provider>
  );
}

let screen: Screen;

beforeAll(async () => {
  screen = new Screen().render(<SampleBench />);
  await screen.until(() => screen.labelled("entry") !== null, 20_000);
  live?.thread.note("The agent is looking at entry.");
  await screen.until(() => screen.text().includes("The agent is looking at entry."), 10_000);
}, 60_000);

afterAll(() => screen.unmount());

test("suggestions: a decided card has a Dismiss button that hides it", async () => {
  propose(ID, "patches", "0x100000960", "1f 20 03 d5", AGENT, "First suggestion");
  await screen.until(() => screen.text().includes("First suggestion"), 10_000);
  expect(screen.labelled("Dismiss")).toBeNull();
  screen.click("Accept");
  await screen.until(() => screen.labelled("Dismiss") !== null, 5_000);
  screen.clickLabel("Dismiss");
  await screen.until(() => !screen.text().includes("First suggestion"), 5_000);
}, 60_000);

test("suggestions: a decided card hides itself, one still waiting stays", async () => {
  propose(ID, "patches", "0x100000964", "1f 20 03 d5", AGENT, "Second suggestion");
  await screen.until(() => screen.text().includes("Second suggestion"), 10_000);
  screen.click("Decline");
  await screen.until(() => screen.text().includes("Declined"), 5_000);
  propose(ID, "patches", "0x100000968", "1f 20 03 d5", AGENT, "Third suggestion");
  await screen.until(() => screen.text().includes("Third suggestion"), 10_000);
  screen.ui.renderer.nativeSimulateMouseMove(5, 5);
  await screen.until(() => !screen.text().includes("Second suggestion"), SETTLED_FOR_MS + 4_000);
  expect(screen.text()).toContain("Third suggestion");
}, 60_000);
