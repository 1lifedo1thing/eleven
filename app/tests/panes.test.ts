import { expect, test } from "bun:test";

import type { Pane, Tab } from "../src/workbench/model";
import { rowOf } from "../src/workbench/paneTree";
import { closePane, initialState, moveTab, openSplit, resizePanes, split, type UiState } from "../src/workbench/state";

const fn = (id: string, addr: string): Tab => ({ kind: "fn", id, addr, view: "pseudo", preview: false });
const pane = (tabs: readonly Tab[]): Pane => ({ tabs, active: 0 });
const addrs = (s: UiState): readonly (readonly string[])[] => s.panes.map((p) => p.tabs.map((t) => (t.kind === "fn" ? t.addr : t.kind)));
const weights = (s: UiState): readonly number[] => (s.tree.kind === "split" ? s.tree.weights : [1]);

test("splitting halves the pane and copies its tab to the right", () => {
  const s = split(initialState([pane([fn("a", "0x1"), fn("b", "0x2")])]), 0);
  expect(addrs(s)).toEqual([["0x1", "0x2"], ["0x1"]]);
  expect(weights(s)).toEqual([1, 1]);
  expect(s.focus).toBe(1);
});

test("panes split as many times as you like", () => {
  let s = initialState([pane([fn("a", "0x1")])]);
  for (let n = 0; n < 7; n += 1) s = split(s, s.panes.length - 1);
  expect(s.panes.length).toBe(8);
  expect(weights(s).reduce((a, b) => a + b, 0)).toBeCloseTo(2);
});

test("splitting the middle pane puts the new one next to it", () => {
  const s = split(initialState([pane([fn("a", "0x1")]), pane([fn("b", "0x2")]), pane([fn("c", "0x3")])]), 1);
  expect(addrs(s)).toEqual([["0x1"], ["0x2"], ["0x2"], ["0x3"]]);
  expect(s.focus).toBe(2);
});

test("closing a pane gives its width to the neighbour", () => {
  const three = [pane([fn("a", "0x1")]), pane([fn("b", "0x2")]), pane([fn("c", "0x3")])];
  const s = closePane(initialState(three, rowOf(3, [2, 1, 1])), 1);
  expect(addrs(s)).toEqual([["0x1"], ["0x3"]]);
  expect(weights(s)).toEqual([3, 1]);
  expect(closePane(initialState([pane([fn("a", "0x1")])]), 0).panes.length).toBe(1);
});

test("moving a tab right makes a new pane, and moving the last tab closes its pane", () => {
  const start = initialState([pane([fn("a", "0x1"), fn("b", "0x2")])]);
  const moved = moveTab(start, 0, 1, 1);
  expect(addrs(moved)).toEqual([["0x1"], ["0x2"]]);
  expect(moved.focus).toBe(1);
  const back = moveTab(moved, 1, 0, -1);
  expect(addrs(back)).toEqual([["0x1", "0x2"]]);
  expect(back.focus).toBe(0);
  expect(weights(back)).toEqual([1]);
});

test("a lone tab can't be moved into a new pane of its own", () => {
  const s = initialState([pane([fn("a", "0x1")])]);
  expect(moveTab(s, 0, 0, 1)).toBe(s);
});

test("moving a tab onto a pane that has it just shows it there", () => {
  const s = moveTab(initialState([pane([fn("a", "0x1"), fn("b", "0x2")]), pane([fn("c", "0x3"), fn("d", "0x2")])]), 0, 1, 1);
  expect(addrs(s)).toEqual([["0x1"], ["0x3", "0x2"]]);
  expect(s.panes[1]?.active).toBe(1);
});

test("open in split uses the next pane over, and makes one when there is only one", () => {
  const one = openSplit(initialState([pane([fn("a", "0x1")])]), { kind: "fn", addr: "0x9" });
  expect(addrs(one)).toEqual([["0x1"], ["0x9"]]);
  const three = openSplit({ ...initialState([pane([fn("a", "0x1")]), pane([fn("b", "0x2")]), pane([fn("c", "0x3")])]), focus: 2 }, { kind: "fn", addr: "0x9" });
  expect(addrs(three)).toEqual([["0x1"], ["0x2", "0x9"], ["0x3"]]);
});

test("resizing changes only the two panes beside the divider", () => {
  const s = resizePanes(initialState([pane([fn("a", "0x1")]), pane([fn("b", "0x2")]), pane([fn("c", "0x3")])]), [], 1, [0.4, 1.6]);
  expect(weights(s)).toEqual([1, 0.4, 1.6]);
});

test("splitting down stacks a new pane under the focused one, inside the row", () => {
  const s = split(split(initialState([pane([fn("a", "0x1")])]), 0), 1, "bottom");
  expect(addrs(s)).toEqual([["0x1"], ["0x1"], ["0x1"]]);
  expect(s.tree).toEqual({ kind: "split", dir: "row", weights: [1, 1], children: [{ kind: "pane", pane: 0 }, { kind: "split", dir: "column", weights: [1, 1], children: [{ kind: "pane", pane: 1 }, { kind: "pane", pane: 2 }] }] });
  expect(s.focus).toBe(2);
});

test("closing a stacked pane folds its column back into the row", () => {
  const s = split(split(initialState([pane([fn("a", "0x1")])]), 0), 1, "bottom");
  const closed = closePane(s, 2);
  expect(closed.tree).toEqual({ kind: "split", dir: "row", weights: [1, 1], children: [{ kind: "pane", pane: 0 }, { kind: "pane", pane: 1 }] });
  expect(closePane(closed, 0).tree).toEqual({ kind: "pane", pane: 0 });
});

test("closing a pane before a stack renumbers the panes after it", () => {
  const s = split(split(initialState([pane([fn("a", "0x1")])]), 0), 1, "bottom");
  expect(closePane(s, 0).tree).toEqual({ kind: "split", dir: "column", weights: [1, 1], children: [{ kind: "pane", pane: 0 }, { kind: "pane", pane: 1 }] });
});

test("a divider inside a stack resizes only that stack", () => {
  const s = split(split(initialState([pane([fn("a", "0x1")])]), 0), 1, "bottom");
  const sized = resizePanes(s, [1], 0, [1.5, 0.5]);
  expect(sized.tree.kind === "split" && sized.tree.children[1]).toEqual({ kind: "split", dir: "column", weights: [1.5, 0.5], children: [{ kind: "pane", pane: 1 }, { kind: "pane", pane: 2 }] });
});

test("a function opened from graph view opens in graph view in the pane beside it", () => {
  const graph: Tab = { kind: "fn", id: "a", addr: "0x1", view: "graph", preview: false };
  const s = openSplit(initialState([pane([graph])]), { kind: "fn", addr: "0x2" });
  const opened = s.panes[1]?.tabs[0];
  expect(opened?.kind === "fn" && opened.view).toBe("graph");
});
