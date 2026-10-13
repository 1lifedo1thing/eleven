import "./fixtures/isolate";
import { expect, test } from "bun:test";

import { DEFAULT_DOCKS, loadDocks, placeTool, saveDocks } from "../src/workbench/dockOrder";
import type { Pane, Tab } from "../src/workbench/model";
import { initialState, moveTool, reveal, showing, toggleTool, type UiState } from "../src/workbench/state";

const fn: Tab = { kind: "fn", id: "a", addr: "0x1", view: "pseudo", preview: false };
const start = (): UiState => initialState([{ tabs: [fn], active: 0 } satisfies Pane]);
const titles = (s: UiState): readonly string[] => s.panes.flatMap((pane) => pane.tabs.map((tab) => (tab.kind === "tool" ? tab.tool : tab.kind)));

test("docks: the right panel opens on the agent and the bottom panel starts closed", () => {
  const s = start();
  expect(s.docks).toEqual(DEFAULT_DOCKS);
  expect(showing(s, "agent")).toBe(true);
  expect(showing(s, "refs")).toBe(false);
  expect(showing(reveal(s, "terminal"), "terminal")).toBe(true);
});

test("docks: a tool moved to the bottom panel leaves the right one and shows there", () => {
  const s = moveTool(start(), "inspector", "bottom");
  expect(s.docks.right).toEqual(["agent"]);
  expect(s.docks.bottom.at(-1)).toBe("inspector");
  expect(s.bottomOpen && s.bottom === "inspector").toBe(true);
  expect(s.right).toBe("agent");
});

test("docks: moving the showing tool away shows the next one left in that dock", () => {
  const s = moveTool(reveal(start(), "inspector"), "inspector", "bottom");
  expect(s.right).toBe("agent");
});

test("docks: a tool opened as an editor tab leaves both docks, and moving it back closes the tab", () => {
  const tabbed = moveTool(start(), "terminal", null);
  expect(tabbed.docks.bottom).not.toContain("terminal");
  expect(titles(tabbed)).toEqual(["fn", "terminal"]);
  expect(showing(tabbed, "terminal")).toBe(true);
  const back = moveTool(tabbed, "terminal", "right");
  expect(titles(back)).toEqual(["fn"]);
  expect(back.docks.right).toEqual(["agent", "inspector", "terminal"]);
  expect(back.rightOpen && back.right === "terminal").toBe(true);
});

test("docks: toggling a tool in an editor tab closes the tab, and toggling again reopens it", () => {
  const tabbed = moveTool(start(), "find", null);
  const closed = toggleTool(tabbed, "find");
  expect(titles(closed)).toEqual(["fn"]);
  expect(titles(toggleTool(closed, "find"))).toEqual(["fn", "find"]);
});

test("docks: emptying the right panel closes it", () => {
  const s = moveTool(moveTool(start(), "agent", "bottom"), "inspector", "bottom");
  expect(s.docks.right).toEqual([]);
  expect(s.rightOpen).toBe(false);
});

test("docks: the arrangement saves and loads, never listing a tool twice", () => {
  saveDocks(placeTool(DEFAULT_DOCKS, "terminal", "right"));
  expect(loadDocks()).toEqual({ right: ["agent", "inspector", "terminal"], bottom: ["refs", "find", "debug", "patches"] });
});
