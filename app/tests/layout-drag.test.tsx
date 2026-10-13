import "./fixtures/isolate";
import { afterAll, beforeAll, expect, test } from "bun:test";
import type { ReactElement } from "react";

import { useChat } from "../src/chat/useChat";
import { openMenuEntries } from "../src/components/ContextMenu";
import { DARK, ThemeContext } from "../src/theme";
import { WorkbenchView } from "../src/workbench/Workbench";
import { NO_GPU, SAMPLE_PROGRAM } from "./fixtures/sampleProgram";
import { Screen } from "./harness";

function SampleBench(): ReactElement {
  const chat = useChat(null, () => {});
  return (
    <ThemeContext.Provider value={{ p: DARK, appearance: "Dark", setAppearance: () => {} }}>
      <WorkbenchView program={SAMPLE_PROGRAM} problem={null} since={null} code gpu={NO_GPU} chat={chat} onBack={() => {}} onOpen={() => {}} />
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

type Json = { readonly id?: number; readonly customProps?: Record<string, unknown>; readonly children?: readonly Json[] };

function labelledAll(label: string, role: string | null = null, node: unknown = screen.ui.renderer.toJSON(), found: number[] = []): number[] {
  if (typeof node !== "object" || node === null) return found;
  const json: Json = node;
  const props = json.customProps;
  if (props?.["aria-label"] === label && (role === null || props.role === role) && typeof json.id === "number") found.push(json.id);
  for (const child of json.children ?? []) labelledAll(label, role, child, found);
  return found;
}

function boxOf(label: string): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } {
  const id = labelledAll(label, "tab")[0];
  const box = id === undefined ? null : screen.ui.renderer.getElementBounds(id);
  if (!box) throw new Error(`nothing labelled "${label}" on screen`);
  return box;
}

function dockOrder(): readonly string[] {
  const tabs = ["References", "Find", "Debugger", "Patches", "Terminal"];
  return [...tabs].sort((a, b) => boxOf(a).x - boxOf(b).x);
}

test("layout: dragging a dock tab moves it, and a short press just switches to it", async () => {
  await screen.until(() => screen.labelled("entry") !== null, 20_000);
  screen.click("Find");
  await screen.until(() => screen.labelled("Terminal") !== null && screen.labelled("References") !== null, 5_000);
  expect(dockOrder()).toEqual(["References", "Find", "Debugger", "Patches", "Terminal"]);
  const from = boxOf("Terminal");
  const onto = boxOf("References");
  const y = from.y + from.height / 2;
  screen.ui.renderer.nativeSimulateMouseDown(from.x + from.width / 2, y);
  settle();
  screen.ui.renderer.nativeSimulateMouseMove(from.x + from.width / 2 - 20, y, 0);
  settle();
  screen.ui.renderer.nativeSimulateMouseMove(onto.x + 4, y, 0);
  settle();
  screen.ui.renderer.nativeSimulateMouseUp(onto.x + 4, y);
  settle();
  await screen.until(() => dockOrder()[0] === "Terminal", 5_000);
  expect(dockOrder()).toEqual(["Terminal", "References", "Find", "Debugger", "Patches"]);
  const patches = boxOf("Patches");
  screen.ui.renderer.nativeSimulateClick(patches.x + patches.width / 2, patches.y + patches.height / 2);
  settle();
  await screen.until(() => screen.text().includes("No patches yet"), 5_000);
  expect(dockOrder()).toEqual(["Terminal", "References", "Find", "Debugger", "Patches"]);
}, 60_000);

test("layout: split down stacks a pane under the current one, and closing it folds back", async () => {
  const tab = labelledAll("entry", "tab")[0];
  if (tab === undefined) throw new Error("no entry tab");
  const box = screen.ui.renderer.getElementBounds(tab);
  if (!box) throw new Error("entry tab has no box");
  screen.ui.renderer.nativeSimulateClick(box.x + box.width / 2, box.y + box.height / 2, 2);
  settle();
  await screen.until(() => openMenuEntries().some((entry) => entry.kind === "action" && entry.label === "Split down"), 5_000);
  screen.clickLabel("Split down");
  await screen.until(() => labelledAll("Editor").length === 2, 5_000);
  const regions = labelledAll("Editor").map((id) => screen.ui.renderer.getElementBounds(id)).filter((b) => b !== null);
  expect(regions.length).toBe(2);
  const [top, bottom] = regions;
  expect(top && bottom && Math.abs(top.x - bottom.x) < 2 && bottom.y > top.y).toBe(true);
}, 60_000);

function rightClick(id: number): void {
  const box = screen.ui.renderer.getElementBounds(id);
  if (!box) throw new Error(`element ${id} has no box`);
  screen.ui.renderer.nativeSimulateClick(box.x + box.width / 2, box.y + box.height / 2, 2);
  settle();
}

function menuHas(label: string): boolean {
  return openMenuEntries().some((entry) => entry.kind === "action" && entry.label === label);
}

test("layout: a dock tool moves to the right panel, then out into an editor tab, from its menu", async () => {
  const terminal = labelledAll("Terminal", "tab")[0];
  if (terminal === undefined) throw new Error("no Terminal tab in the dock");
  rightClick(terminal);
  await screen.until(() => menuHas("Move to the right panel"), 5_000);
  screen.clickLabel("Move to the right panel");
  await screen.until(() => labelledAll("Terminal", "tab").length === 0 && screen.labelled("Back to the agent") !== null, 5_000);
  const toggle = screen.labelled("Back to the agent");
  if (toggle === null) throw new Error("no Terminal toggle in the right panel");
  rightClick(toggle);
  await screen.until(() => menuHas("Open as an editor tab"), 5_000);
  screen.clickLabel("Open as an editor tab");
  await screen.until(() => labelledAll("Terminal", "tab").length === 1 && screen.labelled("Back to the agent") === null, 5_000);
}, 60_000);
