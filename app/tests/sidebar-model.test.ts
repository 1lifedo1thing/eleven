import { expect, test } from "bun:test";

import type { Fn } from "../src/workbench/model";
import { functionRows, logoFor, sourcePaths, sourceTree, splitOwner } from "../src/workbench/sidebar/model";

const fn = (addr: string, name: string, kind: Fn["kind"] = "function"): Fn => ({ addr, name, kind });
const FNS: readonly Fn[] = [
  fn("0x100001190", "entry"),
  fn("0x100001518", "ApplicationController::_prepareWindows"),
  fn("0x100001194", "ApplicationController::awakeFromNib"),
  fn("0x100001224", "-[DictionaryBrowserApp finishLaunching]"),
  fn("0x100002404", "_NSLog", "thunk"),
];
const base = { nameOf: (addr: string) => FNS.find((f) => f.addr === addr)?.name ?? addr, renamed: new Set<string>(), query: "", show: "all" as const, folded: new Set<string>() };

test("owners split from C++, Ghidra and Objective-C names", () => {
  expect(splitOwner("A::B::run")).toEqual({ owner: "A::B", member: "run" });
  expect(splitOwner("-[Foo bar:baz:]")).toEqual({ owner: "Foo", member: "bar:baz:" });
  expect(splitOwner("entry")).toBeNull();
});

const shape = (rows: ReturnType<typeof functionRows>): readonly string[] =>
  rows.map((r) => `${"  ".repeat(r.depth)}${r.kind === "node" ? `[${r.tree} ${r.name} ${r.count}]` : r.label}`);

test("by file: classes A–Z with members, then loose functions, then imports", () => {
  expect(shape(functionRows(FNS, { ...base, sort: "files" }))).toEqual([
    "[class ApplicationController 2]", "  _prepareWindows", "  awakeFromNib", "[class DictionaryBrowserApp 1]", "  finishLaunching", "entry", "_NSLog",
  ]);
});

test("a folded class keeps its heading and hides its members", () => {
  const rows = functionRows(FNS, { ...base, sort: "files", folded: new Set(["::ApplicationController"]) });
  expect(rows.filter((r) => r.kind === "fn" && r.depth > 0).map((r) => r.kind === "fn" && r.label)).toEqual(["finishLaunching"]);
});

test("by file: decompiled Java sits under compacted packages and its .java file", () => {
  const java: readonly Fn[] = [
    { addr: "0x10", name: "com.example.app.MainActivity.onCreate", kind: "function", file: "com/example/app/MainActivity.java" },
    { addr: "0x20", name: "com.example.app.MainActivity$Click.run", kind: "function", file: "com/example/app/MainActivity.java" },
    { addr: "0x30", name: "com.example.app.net.Api.get", kind: "function", file: "com/example/app/net/Api.java" },
    { addr: "0x40", name: "a.b", kind: "function", file: "a.java" },
  ];
  const nameOf = (addr: string): string => java.find((f) => f.addr === addr)?.name ?? addr;
  const rows = functionRows(java, { ...base, nameOf, sort: "files" });
  expect(shape(rows)).toEqual([
    "[folder com.example.app 3]", "  [folder net 1]", "    [file Api.java 1]", "      get", "  [file MainActivity.java 2]", "    Click.run", "    onCreate", "[file a.java 1]", "  b",
  ]);
  const top = rows[0];
  const folded = functionRows(java, { ...base, nameOf, sort: "files", folded: new Set([top?.kind === "node" ? top.path : ""]) });
  expect(shape(folded)).toEqual(["[folder com.example.app 3]", "[file a.java 1]", "  b"]);
  expect(functionRows(java, { ...base, nameOf, sort: "files", query: "net/api" }).length).toBe(3);
});

test("by file: C++ namespaces nest and a lone namespace chain compacts", () => {
  const cpp: readonly Fn[] = [fn("0x1", "std::__1::vector::push_back"), fn("0x2", "std::__1::vector::size"), fn("0x3", "std::__1::string::c_str")];
  const nameOf = (addr: string): string => cpp.find((f) => f.addr === addr)?.name ?? addr;
  expect(shape(functionRows(cpp, { ...base, nameOf, sort: "files" }))).toEqual([
    "[folder std::__1 3]", "  [class string 1]", "    c_str", "  [class vector 2]", "    push_back", "    size",
  ]);
});

test("address order, imports tab and filter", () => {
  expect(functionRows(FNS, { ...base, sort: "address" }).map((r) => r.kind === "fn" && r.fn.addr)).toEqual(["0x100001190", "0x100001194", "0x100001224", "0x100001518", "0x100002404"]);
  expect(functionRows(FNS, { ...base, sort: "name", show: "imports" }).length).toBe(1);
  expect(functionRows(FNS, { ...base, sort: "name", query: "nib" }).length).toBe(1);
});

test("source paths come out of strings and form a tree under the project folder", () => {
  const paths = sourcePaths([
    "/Users/builder/src/Dictionary/Dictionary/ApplicationController.m",
    "Assertion failed: (x), function f, file /Users/builder/src/Dictionary/Shared/Cache.cpp, line 12.",
    "/Users/builder/src/Dictionary/Dictionary/Panels/Prefs.swift",
    "not a path",
    "/Users/builder/src/Dictionary/Dictionary/ApplicationController.m",
  ]);
  expect(paths.length).toBe(3);
  const tree = sourceTree(paths, new Set());
  expect(tree.map((n) => `${"  ".repeat(n.depth)}${n.name}`)).toEqual([
    "Dictionary", "  Dictionary", "    Panels", "      Prefs.swift", "    ApplicationController.m", "  Shared", "    Cache.cpp",
  ]);
  expect(sourceTree(paths, new Set(["Dictionary/Dictionary"])).map((n) => n.name)).toEqual(["Dictionary", "Dictionary", "Shared", "Cache.cpp"]);
  expect(logoFor("swift")).toBe("lang-swift");
});
