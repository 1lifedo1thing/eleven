import { expect, test } from "bun:test";

import { instructionBytes, linkedMatch } from "../src/workbench/CodeLines";
import { DEFAULT_DOCKS, moveDockTab } from "../src/workbench/dockOrder";
const DOCK_TABS = DEFAULT_DOCKS.bottom;
import type { Pane, Tab } from "../src/workbench/model";
import { besidePseudo, initialState } from "../src/workbench/state";
import { placeIn, segmentOf } from "../src/workbench/where";

test("dragging a dock tab moves it before another, or to the end", () => {
  expect(moveDockTab(DOCK_TABS, "terminal", "refs")).toEqual(["terminal", "refs", "find", "debug", "patches"]);
  expect(moveDockTab(DOCK_TABS, "refs", null)).toEqual(["find", "debug", "patches", "terminal", "refs"]);
});

test("the bytes column reads each instruction's bytes up to the next one", () => {
  const rows = [{ addr: "0x1000", bytes: "fd 7b bf a9 fd 03 00 91 e8 03 00 aa c0 03 5f d6", ascii: "" }];
  expect(instructionBytes(rows, "0x1000", "0x1004")).toBe("fd 7b bf a9");
  expect(instructionBytes(rows, "0x100c", null)).toBe("c0 03 5f d6");
});

test("linked view matches lines that name the same symbol", () => {
  expect(linkedMatch("0x100001a90  bl _DCSDictionaryGetURL", "  url = _DCSDictionaryGetURL(dict);")).toBe(true);
  expect(linkedMatch("0x100001a90  mov x19, x0", "  return 0;")).toBe(false);
});

test("where you are: segment by range, and offset into the function", () => {
  expect(segmentOf([{ a: "__TEXT", b: "0x100000000-0x100004000" }, { a: "__DATA", b: "0x100004000-0x100008000" }], "0x100004010")).toBe("__DATA");
  expect(placeIn("main", "0x1000", "0x101c")).toBe("main+0x1c");
  expect(placeIn("main", "0x1000", "0x1000")).toBe("main");
});

test("pseudocode beside a listing opens in the next pane and links them; again unlinks", () => {
  const tab: Tab = { kind: "fn", id: "a", addr: "0x1000", view: "asm", preview: false };
  const pane: Pane = { tabs: [tab], active: 0 };
  const side = besidePseudo(initialState([pane]), "0x1000");
  expect(side.panes.length).toBe(2);
  const right = side.panes[1]?.tabs[0];
  expect(right?.kind === "fn" && right.view).toBe("pseudo");
  expect(side.linked).toBe(true);
  expect(side.focus).toBe(0);
  expect(besidePseudo(side, "0x1000").linked).toBe(false);
});
