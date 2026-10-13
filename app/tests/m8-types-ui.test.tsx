import "./fixtures/isolate";
import { afterAll, beforeAll, expect, test } from "bun:test";
import type { ReactElement } from "react";

import { openMenuEntries, type MenuEntry } from "../src/components/ContextMenu";
import { useChat } from "../src/chat/useChat";
import type { CodeType } from "../src/engine/codeTypes";
import { loadProject } from "../src/engine/project";
import { DARK, ThemeContext } from "../src/theme";
import type { Program } from "../src/workbench/model";
import { WorkbenchView } from "../src/workbench/Workbench";
import { NO_GPU, SAMPLE_PROGRAM } from "./fixtures/sampleProgram";
import { Screen } from "./harness";

const retyped: (readonly [string, CodeType | null])[] = [];

const PROGRAM: Program = {
  ...SAMPLE_PROGRAM,
  id: "types-ui",
  retype: (addr, next) => {
    retyped.push([addr, next]);
    return Promise.resolve();
  },
};

function SampleBench(): ReactElement {
  const chat = useChat(null, () => {});
  return (
    <ThemeContext.Provider value={{ p: DARK, appearance: "Dark", setAppearance: () => {} }}>
      <WorkbenchView program={PROGRAM} problem={null} since={null} code gpu={NO_GPU} chat={chat} onBack={() => {}} onOpen={() => {}} />
    </ThemeContext.Provider>
  );
}

let screen: Screen;

beforeAll(() => {
  screen = new Screen().render(<SampleBench />);
}, 60_000);

afterAll(() => screen.unmount());

function settle(): void {
  screen.ui.renderer.dispatchNativeEvents();
  screen.ui.renderer.flush();
}

function rightClickText(text: string): void {
  const element = screen.ui.renderer.findByText(text);
  if (!element) throw new Error(`no "${text}" on screen`);
  screen.ui.renderer.scrollIntoView(element.id);
  settle();
  const box = screen.ui.renderer.getElementBounds(element.id);
  if (!box) throw new Error(`"${text}" has no box`);
  screen.ui.renderer.nativeSimulateClick(box.x + box.width / 2, box.y + box.height / 2, 2);
  settle();
}

function changeType(): readonly MenuEntry[] {
  const menu = openMenuEntries().find((entry) => entry.kind === "submenu" && entry.label === "Change type");
  return menu?.kind === "submenu" ? menu.items : [];
}

function pick(label: string): void {
  const entry = changeType().find((item) => item.kind === "action" && item.label === label);
  if (entry?.kind !== "action") throw new Error(`no ${label} in Change type`);
  expect(entry.unavailable ?? null).toBeNull();
  entry.run();
  settle();
}

test("types: nothing in Change type is left for later", async () => {
  await screen.until(() => screen.labelled("function entry") !== null, 20_000);
  screen.clickLabel("function entry");
  await screen.until(() => screen.labelled("Listing view") !== null, 10_000);
  screen.clickLabel("Listing view");
  await screen.until(() => screen.text().includes("0x640"), 10_000);
  rightClickText("0x640");
  await screen.until(() => changeType().length > 0, 5_000);
  const labels = changeType().flatMap((item) => (item.kind === "action" ? [item.label] : []));
  expect(labels).toEqual(["Code", "Procedure", "Data", "C string", "Undefined", "Hexadecimal", "Decimal", "Character", "Offset", "Address"]);
  expect(changeType().some((item) => item.kind === "action" && item.unavailable === "Coming soon")).toBe(false);
}, 60_000);

test("types: Decimal shows the number in decimal and Undo puts it back", async () => {
  pick("Decimal");
  await screen.until(() => screen.text().includes("1600"), 5_000);
  expect(loadProject("types-ui").formats.get("0x100000980")).toBe("decimal");
  screen.click("Undo");
  await screen.until(() => screen.text().includes("0x640") && !screen.text().includes("1600"), 5_000);
}, 60_000);

test("types: Data asks the engine for a byte, then a word, and undo reads it as code again", async () => {
  rightClickText("0x640");
  await screen.until(() => changeType().length > 0, 5_000);
  pick("Data");
  await screen.until(() => retyped.length === 1, 5_000);
  expect(retyped[0]).toEqual(["0x100000980", "byte"]);
  rightClickText("0x640");
  await screen.until(() => changeType().length > 0, 5_000);
  pick("Data");
  await screen.until(() => retyped.length === 2, 5_000);
  expect(retyped[1]).toEqual(["0x100000980", "word"]);
  screen.click("Undo");
  await screen.until(() => retyped.length === 3, 5_000);
  expect(retyped[2]).toEqual(["0x100000980", "byte"]);
}, 60_000);

test("types: Procedure adds the function to the list", async () => {
  rightClickText("0x640");
  await screen.until(() => changeType().length > 0, 5_000);
  pick("Procedure");
  await screen.until(() => screen.labelled("function FUN_100000980") !== null, 5_000);
  expect(retyped.at(-1)).toEqual(["0x100000980", "procedure"]);
}, 60_000);
