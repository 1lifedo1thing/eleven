import { expect, test } from "bun:test";

import { changedSpan, classifyFunctions, diffStats, lineDiff, reviewRows } from "../src/workbench/diff";
import type { Fn } from "../src/workbench/model";

function fn(name: string, addr: string): Fn {
  return { name, addr, kind: "function" };
}

test("M8: classifying functions marks what is shared, removed and added", () => {
  const left = [fn("main", "0x100"), fn("old_helper", "0x200"), fn("shared", "0x300")];
  const right = [fn("main", "0xa00"), fn("shared", "0xb00"), fn("new_helper", "0xc00")];
  expect(classifyFunctions(left, right)).toEqual([
    { name: "main", status: "both", left: "0x100", right: "0xa00" },
    { name: "old_helper", status: "removed", left: "0x200", right: null },
    { name: "shared", status: "both", left: "0x300", right: "0xb00" },
    { name: "new_helper", status: "added", left: null, right: "0xc00" },
  ]);
});

test("M8: a line diff keeps shared lines and marks the one that changed", () => {
  expect(lineDiff("int x = 1;\nreturn x;", "int x = 2;\nreturn x;")).toEqual([
    { op: "del", text: "int x = 1;" },
    { op: "add", text: "int x = 2;" },
    { op: "same", text: "return x;" },
  ]);
});

test("M8: identical code is all shared, and empty sides are handled", () => {
  expect(lineDiff("a\nb", "a\nb")).toEqual([
    { op: "same", text: "a" },
    { op: "same", text: "b" },
  ]);
  expect(lineDiff("", "only")).toEqual([{ op: "add", text: "only" }]);
  expect(lineDiff("gone", "")).toEqual([{ op: "del", text: "gone" }]);
});

test("a review numbers both sides and marks only the edited characters", () => {
  const lines = lineDiff("int x = 1;\nreturn x;", "int x = 2;\nreturn x;");
  expect(diffStats(lines)).toEqual({ added: 1, removed: 1 });
  expect(reviewRows(lines, new Set())).toEqual([
    { kind: "line", op: "del", text: "int x = 1;", before: 1, after: null, changed: { start: 8, end: 9 } },
    { kind: "line", op: "add", text: "int x = 2;", before: null, after: 1, changed: { start: 8, end: 9 } },
    { kind: "line", op: "same", text: "return x;", before: 2, after: 2, changed: null },
  ]);
  expect(changedSpan("foo()", "bar")).toBeNull();
});

test("a review folds long unchanged stretches and opens them on request", () => {
  const body = Array.from({ length: 10 }, (_, ix) => `line ${ix}`);
  const before = [...body, "old"].join("\n");
  const after = [...body, "new"].join("\n");
  const folded = reviewRows(lineDiff(before, after), new Set());
  expect(folded[0]).toEqual({ kind: "fold", at: 0, count: 7 });
  expect(folded[1]).toEqual({ kind: "line", op: "same", text: "line 7", before: 8, after: 8, changed: null });
  const opened = reviewRows(lineDiff(before, after), new Set([0]));
  expect(opened.every((row) => row.kind === "line")).toBe(true);
  expect(opened).toHaveLength(12);
});
