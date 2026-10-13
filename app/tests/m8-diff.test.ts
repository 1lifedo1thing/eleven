import { expect, test } from "bun:test";

import { classifyFunctions, lineDiff } from "../src/workbench/diff";
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
