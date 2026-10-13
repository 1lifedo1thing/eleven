import "./fixtures/isolate";
import { expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { loadProject } from "../src/engine/project";
import { DEFAULT_SETTINGS, loadSettings, SETTINGS_FILE } from "../src/settings/store";
import { supportPath } from "../src/lib/support";
import { loadThreadTabs } from "../src/workbench/threadTabs";

function put(path: string, json: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(json));
}

test("saved files: a damaged project keeps its good parts", () => {
  put(supportPath("projects", "damaged.json"), {
    names: { "0x10": "main", "0x20": 5 },
    bookmarks: [{ addr: "0x10", label: "start" }, { addr: 7 }, "junk"],
    notes: "not a map",
    groups: [{ fn: "0x10", blocks: ["0x10"], label: "one block" }, { fn: "0x10", blocks: ["0x10", "0x14"], label: "loop" }],
    edits: [{ id: "a", at: 1, changedAt: 1, by: { kind: "you" }, field: "names", key: "0x10", before: null, after: "main", status: "applied" }, { id: "b", field: "nope" }],
  });
  const project = loadProject("damaged");
  expect([...project.names]).toEqual([["0x10", "main"]]);
  expect(project.bookmarks).toEqual([{ addr: "0x10", label: "start" }]);
  expect(project.notes.size).toBe(0);
  expect(project.patches).toEqual([]);
  expect(project.groups.map((group) => group.label)).toEqual(["loop"]);
  expect(project.edits.map((edit) => edit.id)).toEqual(["a"]);
});

test("saved files: one bad setting falls back alone", () => {
  put(SETTINGS_FILE, { askBeforeChanges: false, appearance: "Purple", codeFontSize: 99, keymap: "ida", shortcuts: { goto: "cmd-g", nope: "x", back: 3 } });
  expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, askBeforeChanges: false, keymap: "ida", shortcuts: { goto: "cmd-g" } });
  put(SETTINGS_FILE, "garbage");
  expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
});

test("saved files: tab layouts drop bad tabs and keep the active tab and focus in range", () => {
  put(supportPath("thread-tabs", "t1.json"), {
    panes: [
      { tabs: [{ id: "a", kind: "fn", addr: "0x10", view: "graph", preview: true }, { id: "b", kind: "fn", addr: "0x20", view: "sideways" }], active: 9, weight: -1 },
      { tabs: [{ kind: "list", list: "strings" }] },
    ],
    focus: 4,
  });
  expect(loadThreadTabs("t1")).toEqual({ panes: [{ tabs: [{ id: "a", kind: "fn", addr: "0x10", view: "graph", preview: false }], active: 0 }], tree: { kind: "pane", pane: 0 }, focus: 0 });
  put(supportPath("thread-tabs", "t2.json"), { panes: [] });
  expect(loadThreadTabs("t2")).toBeNull();
});
