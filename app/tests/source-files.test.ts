import "./fixtures/isolate";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "bun:test";

import { languageOf, recreatedSource, type RecreateRequest, recreatePrompt } from "../src/engine/recreate";
import { readSwiftTypes, type SwiftType } from "../src/engine/swiftTypes";
import type { Fn } from "../src/workbench/model";
import { sourceTree } from "../src/workbench/sidebar/model";
import { sourceFiles, stemOf, traceStatic } from "../src/workbench/sources";

const FIXTURE = join(import.meta.dir, "fixtures", "swift", "HistoryStore");

test("Swift types come out of the metadata with their nesting, accessor and vtable", () => {
  const types = readSwiftTypes(readFileSync(FIXTURE), "arm64");
  expect(types.map((type) => `${type.kind} ${type.name}`)).toEqual(["class HistoryStore", "struct HistoryStore.Record", "enum DeletionMode"]);
  expect(types.every((type) => type.module === "HistoryStore" && type.accessor?.startsWith("0x"))).toBe(true);
  expect(types[0]?.methods.length).toBe(3);
  expect(types[1]?.methods).toEqual([]);
});

test("a file that isn't Mach-O has no Swift types", () => {
  expect(readSwiftTypes(Buffer.from("not a binary at all"), "arm64")).toEqual([]);
});

const TYPES: readonly SwiftType[] = [
  { kind: "class", module: "Calculator", name: "CalculatorHistoryRecordManager", accessor: "0x10000b35c", methods: ["0x100001000"] },
  { kind: "class", module: "Calculator", name: "CalculatorHistoryRecordManager.NSCacheObserver", accessor: "0x10000b484", methods: [] },
  { kind: "struct", module: "Calculator", name: "CalculatorHistoryView", accessor: "0x100094d40", methods: [] },
  { kind: "struct", module: "Calculator", name: "_PrivateHelper", accessor: null, methods: [] },
];

test("files come from paths first, then one guess per top-level type no path accounts for", () => {
  const files = sourceFiles(["Calculator/CalculatorHistoryRecordManager.swift", "Swift/Dictionary.swift", "plain text"], TYPES);
  expect(files.paths).toEqual(["Calculator/CalculatorHistoryRecordManager.swift"]);
  expect(files.library).toEqual(["Swift/Dictionary.swift"]);
  expect(files.guessed).toEqual([{ file: "CalculatorHistoryView.swift", type: "CalculatorHistoryView" }]);
  expect(stemOf("Sources/App/NSString+Extras.m")).toBe("NSString");
});

test("a file's functions come from its types' metadata, its name in symbols, and nothing unknown", () => {
  const functions: readonly Fn[] = [
    { addr: "0x100001000", name: "FUN_100001000", kind: "function" },
    { addr: "0x10000b35c", name: "FUN_10000b35c", kind: "function" },
    { addr: "0x100002000", name: "_TtCC10Calculator30CalculatorHistoryRecordManagerP33_4DA6015NSCacheObserver::init", kind: "function" },
    { addr: "0x100003000", name: "CalculatorHistoryRecordManager.clear", kind: "function" },
    { addr: "0x100004000", name: "CalculatorHistoryRecordManagerDelegate.call", kind: "function" },
  ];
  const strings = [{ a: "0x1", b: "Calculator/CalculatorHistoryRecordManager.swift" }, { a: "0x2", b: "unrelated" }];
  const trace = traceStatic("Calculator/CalculatorHistoryRecordManager.swift", false, TYPES, functions, strings);
  expect(trace.types.map((type) => type.name)).toEqual(["CalculatorHistoryRecordManager", "CalculatorHistoryRecordManager.NSCacheObserver"]);
  expect(trace.fns).toEqual([
    { addr: "0x100001000", why: "metadata" },
    { addr: "0x10000b35c", why: "accessor" },
    { addr: "0x100002000", why: "named" },
    { addr: "0x100003000", why: "named" },
  ]);
  expect(trace.strings).toEqual(["Calculator/CalculatorHistoryRecordManager.swift"]);
});

test("the tree keeps each file's path as the binary spells it", () => {
  const tree = sourceTree(["/Users/me/App/Sources/A.swift", "/Users/me/App/Sources/B.swift"], new Set());
  expect(tree.filter((node) => !node.folder).map((node) => node.full)).toEqual(["/Users/me/App/Sources/A.swift", "/Users/me/App/Sources/B.swift"]);
});

const REQUEST: RecreateRequest = {
  agent: { id: "test", name: "Test agent", description: "", version: "1", iconUrl: null, distribution: { kind: "command", command: "true", args: [] } },
  native: null,
  projectId: "abc",
  binary: { path: "/Apps/Calculator", name: "Calculator", arch: "arm64e" },
  file: "Calculator/CalculatorHistoryRecordManager.swift",
  types: ["class CalculatorHistoryRecordManager"],
  fns: [{ name: "FUN_100001000", addr: "0x100001000", why: "method in the type's metadata" }],
  strings: ["CalculatorDidAddHistoryRecord"],
  pseudocode: [{ name: "FUN_100001000", addr: "0x100001000", code: "void FUN_100001000(void) {}" }],
};

test("the recreate prompt carries what was traced and asks for address markers", () => {
  const prompt = recreatePrompt(REQUEST);
  expect(prompt).toContain("Recreate the source file Calculator/CalculatorHistoryRecordManager.swift");
  expect(prompt).toContain("as Swift");
  expect(prompt).toContain("- class CalculatorHistoryRecordManager");
  expect(prompt).toContain("- FUN_100001000 at 0x100001000: method in the type's metadata");
  expect(prompt).toContain('- "CalculatorDidAddHistoryRecord"');
  expect(prompt).toContain("// @0x1000a3184");
  expect(prompt).toContain("```swift code block");
  expect(prompt).toContain("void FUN_100001000(void) {}");
  expect(prompt).toContain("Only read");
  expect(recreatePrompt({ ...REQUEST, fns: [], pseudocode: [] })).toContain("Find its code yourself");
});

test("address markers become links on the line under them and leave the file", () => {
  const source = recreatedSource("import Foundation\n\n// @0x100001000\nfunc add() {}\n  // @0X100002000\n\n  init() {}\n");
  expect(source.text).toBe("import Foundation\n\nfunc add() {}\n\n  init() {}");
  expect(source.starts).toEqual([{ line: 3, addr: "0x100001000" }, { line: 5, addr: "0x100002000" }]);
});

test("the language follows the file's extension", () => {
  expect(languageOf("A.swift")).toEqual({ label: "Swift", fence: "swift" });
  expect(languageOf("b/C.mm").label).toBe("Objective-C++");
  expect(languageOf("README").label).toBe("its original language");
});
