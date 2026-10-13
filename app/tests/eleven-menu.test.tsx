import "./fixtures/isolate";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { type ReactElement, useState } from "react";

import { useChat } from "../src/chat/useChat";
import { useCommand } from "../src/lib/shortcuts";
import { type Appearance, DARK, ThemeContext } from "../src/theme";
import { WorkbenchView } from "../src/workbench/Workbench";
import { NO_GPU, SAMPLE_PROGRAM } from "./fixtures/sampleProgram";
import { Screen } from "./harness";

const ran: string[] = [];
let appearance: Appearance = "Dark";

function SampleBench(): ReactElement {
  const chat = useChat(null, () => {});
  const [theme, setTheme] = useState<Appearance>("Dark");
  useCommand("settings", () => ran.push("settings"));
  return (
    <ThemeContext.Provider value={{ p: DARK, appearance: theme, setAppearance: (next) => { appearance = next; setTheme(next); } }}>
      <WorkbenchView program={SAMPLE_PROGRAM} problem={null} since={null} code gpu={NO_GPU} chat={chat} onBack={() => {}} onOpen={() => {}} />
    </ThemeContext.Provider>
  );
}

let screen: Screen;

beforeAll(() => {
  screen = new Screen().render(<SampleBench />);
}, 60_000);

afterAll(() => screen.unmount());

async function openSub(label: string, row: string): Promise<void> {
  if (screen.labelled(row) !== null) return;
  if (screen.labelled("Settings") === null || screen.labelled("Appearance") === null) screen.clickLabel("Eleven menu");
  await screen.until(() => screen.labelled(label) !== null, 5_000);
  screen.clickLabel(label);
  await screen.until(() => screen.labelled(row) !== null, 5_000);
}

test("eleven menu: a submenu row runs instead of closing the menu", async () => {
  await screen.until(() => screen.labelled("Eleven menu") !== null, 20_000);
  await openSub("Appearance", "Light");
  screen.clickLabel("Light");
  await screen.until(() => appearance === "Light", 5_000);
  expect(appearance).toBe("Light");
}, 60_000);

test("eleven menu: a submenu row still runs when the release comes a moment after the press", async () => {
  await openSub("Appearance", "Dark");
  await screen.pressLabel("Dark");
  await screen.until(() => appearance === "Dark", 5_000);
  expect(appearance).toBe("Dark");
}, 60_000);

test("eleven menu: a top-level row runs its command", async () => {
  if (screen.labelled("Appearance") === null) screen.clickLabel("Eleven menu");
  await screen.until(() => screen.labelled("Appearance") !== null, 5_000);
  screen.click("Settings");
  await screen.until(() => ran.includes("settings"), 5_000);
  expect(screen.labelled("Appearance")).toBeNull();
}, 60_000);

test("eleven menu: a click outside closes it", async () => {
  screen.clickLabel("Eleven menu");
  await screen.until(() => screen.labelled("Appearance") !== null, 5_000);
  screen.clickLabel("entry");
  await screen.until(() => screen.labelled("Appearance") === null, 5_000);
}, 60_000);
