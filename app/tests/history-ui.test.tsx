import "./fixtures/isolate";
import { afterAll, beforeAll, expect, test } from "bun:test";
import type { ReactElement } from "react";

import { useChat } from "../src/chat/useChat";
import type { Author } from "../src/engine/edits";
import { propose } from "../src/engine/history";
import { loadProject, updateProject } from "../src/engine/project";
import { DARK, ThemeContext } from "../src/theme";
import { WorkbenchView } from "../src/workbench/Workbench";
import { NO_GPU, SAMPLE_PROGRAM } from "./fixtures/sampleProgram";
import { Screen } from "./harness";

const ID = SAMPLE_PROGRAM.id;
const CLAUDE: Author = { kind: "agent", agent: "Claude", chat: "chat-1" };

function SampleBench(): ReactElement {
  const chat = useChat(null, () => {});
  return (
    <ThemeContext.Provider value={{ p: DARK, appearance: "Dark", setAppearance: () => {} }}>
      <WorkbenchView program={SAMPLE_PROGRAM} problem={null} since={null} code gpu={NO_GPU} chat={chat} onBack={() => {}} onOpen={() => {}} />
    </ThemeContext.Provider>
  );
}

let screen: Screen;

beforeAll(async () => {
  screen = new Screen().render(<SampleBench />);
  await screen.until(() => screen.text().includes("History"));
}, 60_000);

afterAll(() => screen.unmount());

test("history: opening the workbench logs nothing, and an agent's rename shows with Undo", async () => {
  expect(loadProject(ID).edits).toEqual([]);
  updateProject(ID, (project) => ({ ...project, names: new Map(project.names).set("0x1000016d8", "print_usage") }), CLAUDE);
  screen.click("History");
  await screen.until(() => screen.text().includes("Renamed FUN_1000016d8 to print_usage"));
  expect(screen.texts()).toContain("Claude");
  screen.click("Undo");
  await screen.until(() => screen.text().includes("Redo"));
  expect(loadProject(ID).names.has("0x1000016d8")).toBe(false);
}, 60_000);

test("changes: an agent's patch waits with a count until accepted", async () => {
  propose(ID, "patches", "0x100000960", "1f 20 03 d5", CLAUDE, "Skips the first instruction");
  await screen.until(() => screen.texts().includes("Changes 1"));
  screen.click("Changes 1");
  await screen.until(() => screen.text().includes("Skips the first instruction"));
  expect(loadProject(ID).patches).toEqual([]);
  screen.click("Accept");
  await screen.until(() => screen.texts().includes("Changes"));
  expect(loadProject(ID).patches).toEqual([{ addr: "0x100000960", bytes: "1f 20 03 d5" }]);
}, 60_000);
