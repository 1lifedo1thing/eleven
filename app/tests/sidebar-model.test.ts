import { expect, test } from "bun:test";

import type { Fn } from "../src/workbench/model";
import { functionRows, logoFor, rowFile, sourcePaths, sourceTree, splitOwner } from "../src/workbench/sidebar/model";

const fn = (addr: string, name: string, kind: Fn["kind"] = "function"): Fn => ({ addr, name, kind });
const FNS: readonly Fn[] = [
  fn("0x100001190", "entry"),
  fn("0x100001518", "ApplicationController::_prepareWindows"),
  fn("0x100001194", "ApplicationController::awakeFromNib"),
  fn("0x100001224", "-[DictionaryBrowserApp finishLaunching]"),
  fn("0x100002404", "_NSLog", "thunk"),
];
const base = { nameOf: (addr: string) => FNS.find((f) => f.addr === addr)?.name ?? addr, renamed: new Set<string>(), query: "", show: "all" as const, flipped: new Set<string>() };

test("owners split from C++, Ghidra and Objective-C names", () => {
  expect(splitOwner("A::B::run")).toEqual({ owner: "A::B", member: "run" });
  expect(splitOwner("-[Foo bar:baz:]")).toEqual({ owner: "Foo", member: "bar:baz:" });
  expect(splitOwner("entry")).toBeNull();
});

const shape = (rows: ReturnType<typeof functionRows>): readonly string[] =>
  rows.map((r) => `${"  ".repeat(r.depth)}${r.kind === "node" ? `[${r.tree} ${r.name} ${r.count}]` : r.label}`);

type Options = Parameters<typeof functionRows>[1];

/** Opens every closed group and folder, the way clicking each one would. */
function expandAll(fns: readonly Fn[], options: Options): ReadonlySet<string> {
  let opened = new Set(options.flipped);
  for (;;) {
    const paths = functionRows(fns, { ...options, flipped: opened }).flatMap((r) => (r.kind === "node" && !r.open ? [r.path] : []));
    const next = new Set([...opened, ...paths]);
    if (next.size === opened.size) return opened;
    opened = next;
  }
}

test("every group and folder starts folded", () => {
  expect(shape(functionRows(FNS, { ...base, sort: "files" }))).toEqual(["[group Your code 4]", "[group Imports 1]"]);
  expect(shape(functionRows(FNS, { ...base, sort: "files", flipped: new Set(["#yours"]) }))).toEqual([
    "[group Your code 4]", "[class ApplicationController 2]", "[class DictionaryBrowserApp 1]", "entry", "[group Imports 1]",
  ]);
});

test("a folder alone at its level starts open, and Your code starts open when there are no source files", () => {
  const cpp: readonly Fn[] = [fn("0x1", "std::__1::vector::push_back"), fn("0x2", "std::__1::string::c_str")];
  const nameOf = (addr: string): string => cpp.find((f) => f.addr === addr)?.name ?? addr;
  expect(shape(functionRows(cpp, { ...base, nameOf, sort: "files" }))).toEqual(["[folder std::__1 2]", "  [class string 1]", "  [class vector 1]"]);
  expect(shape(functionRows(cpp, { ...base, nameOf, sort: "files", flipped: new Set(["std/__1"]) })).length).toBeGreaterThan(0);
  expect(shape(functionRows(FNS, { ...base, sort: "files", yoursOpen: true })).slice(0, 2)).toEqual(["[group Your code 4]", "[class ApplicationController 2]"]);
});

test("by file: your code with classes A–Z, then imports under their own heading", () => {
  const yours = new Set(["#yours", "#yours/ApplicationController", "#yours/DictionaryBrowserApp"]);
  expect(shape(functionRows(FNS, { ...base, sort: "files", flipped: yours }))).toEqual([
    "[group Your code 4]", "[class ApplicationController 2]", "  _prepareWindows", "  awakeFromNib", "[class DictionaryBrowserApp 1]", "  finishLaunching", "entry", "[group Imports 1]",
  ]);
  expect(shape(functionRows(FNS, { ...base, sort: "files", flipped: new Set(["#imports"]) })).slice(-2)).toEqual(["[group Imports 1]", "_NSLog"]);
});

test("a folded class keeps its heading and hides its members", () => {
  const rows = functionRows(FNS, { ...base, sort: "files", flipped: new Set(["#yours", "#yours/DictionaryBrowserApp"]) });
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
  const options = { ...base, nameOf, sort: "files" as const };
  expect(shape(functionRows(java, options))).toEqual(["[folder com.example.app 3]", "[file a.java 1]"]);
  const all = expandAll(java, options);
  const rows = functionRows(java, { ...options, flipped: all });
  expect(shape(rows)).toEqual([
    "[folder com.example.app 3]", "  [folder net 1]", "    [file Api.java 1]", "      get", "  [file MainActivity.java 2]", "    Click.run", "    onCreate", "[file a.java 1]", "  b",
  ]);
  const top = rows[0];
  const folded = functionRows(java, { ...options, flipped: new Set([...all].filter((path) => path !== (top?.kind === "node" ? top.path : ""))) });
  expect(shape(folded)).toEqual(["[folder com.example.app 3]", "[file a.java 1]", "  b"]);
  const found = functionRows(java, { ...base, nameOf, sort: "files", query: "net/api" });
  expect(found.map((r) => r.kind === "fn" && `${r.label} · ${r.where}`)).toEqual(["com.example.app.net.Api.get · com.example.app.net · your code"]);
});

test("by file: C++ namespaces nest and a lone namespace chain compacts", () => {
  const cpp: readonly Fn[] = [fn("0x1", "std::__1::vector::push_back"), fn("0x2", "std::__1::vector::size"), fn("0x3", "std::__1::string::c_str")];
  const nameOf = (addr: string): string => cpp.find((f) => f.addr === addr)?.name ?? addr;
  const options = { ...base, nameOf, sort: "files" as const };
  expect(shape(functionRows(cpp, { ...options, flipped: expandAll(cpp, options) }))).toEqual([
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

test("an Android app: its own packages first, libraries folded with their packages closed", () => {
  const apk: readonly Fn[] = [
    { addr: "0x1", name: "com.example.hermes.MainActivity.onCreate", kind: "function", file: "com/example/hermes/MainActivity.java" },
    { addr: "0x2", name: "androidx.core.app.NotificationCompat.build", kind: "function", file: "androidx/core/app/NotificationCompat.java" },
    { addr: "0x3", name: "kotlin.collections.CollectionsKt.first", kind: "function", file: "kotlin/collections/CollectionsKt.java" },
    { addr: "0x4", name: "app.notifee.core.Notifee.display", kind: "function", file: "app/notifee/core/Notifee.java" },
  ];
  const nameOf = (addr: string): string => apk.find((f) => f.addr === addr)?.name ?? addr;
  const options = { ...base, nameOf, sort: "files" as const };
  expect(shape(functionRows(apk, options))).toEqual(["[group Your code 1]", "[group Libraries 3]"]);
  const yours = new Set([...expandAll(apk, options)].filter((path) => !path.startsWith("#libraries")));
  expect(shape(functionRows(apk, { ...options, flipped: yours }))).toEqual([
    "[group Your code 1]", "[folder com.example.hermes 1]", "  [file MainActivity.java 1]", "    onCreate", "[group Libraries 3]",
  ]);
  const file = functionRows(apk, { ...options, flipped: yours }).find((r) => r.kind === "node" && r.tree === "file");
  expect(file?.kind === "node" ? rowFile(file.path) : "").toBe("com/example/hermes/MainActivity.java");
  const libs = functionRows(apk, { ...options, flipped: new Set([...yours, "#libraries"]) });
  expect(shape(libs).slice(4)).toEqual(["[group Libraries 3]", "[folder androidx.core.app 1]", "[folder app.notifee.core 1]", "[folder kotlin.collections 1]"]);
});

test("native code: runtime glue and unnamed functions fold away, and Your code only hides the rest", () => {
  const mac: readonly Fn[] = [
    fn("0x1", "-[CalculatorController evaluate]"), fn("0x2", "FUN_100004088"), fn("0x3", "$s10Calculator9EvaluatorCMa"),
    fn("0x4", "outlined copy of Calculator.Token"), fn("0x5", "_objc_msgSend", "thunk"), fn("0x6", "_start"),
  ];
  const nameOf = (addr: string): string => mac.find((f) => f.addr === addr)?.name ?? addr;
  expect(shape(functionRows(mac, { ...base, nameOf, sort: "files", flipped: new Set(["#yours", "#yours/CalculatorController"]) }))).toEqual([
    "[group Your code 2]", "[class CalculatorController 1]", "  evaluate", "[folder Unnamed 1]", "[group Imports 1]", "[group Runtime 3]",
  ]);
  expect(functionRows(mac, { ...base, nameOf, sort: "name", show: "yours" }).map((r) => r.kind === "fn" && r.label)).toEqual(["-[CalculatorController evaluate]", "FUN_100004088"]);
});

test("search lists your code first, each match saying where it lives", () => {
  const mixed: readonly Fn[] = [
    { addr: "0x1", name: "androidx.core.app.NotificationCompat.notify", kind: "function", file: "androidx/core/app/NotificationCompat.java" },
    { addr: "0x2", name: "com.example.hermes.ui.NotificationHelper.notify", kind: "function", file: "com/example/hermes/ui/NotificationHelper.java" },
  ];
  const nameOf = (addr: string): string => mixed.find((f) => f.addr === addr)?.name ?? addr;
  expect(functionRows(mixed, { ...base, nameOf, sort: "files", query: "notify" }).map((r) => r.kind === "fn" && r.where)).toEqual([
    "com.example.hermes.ui · your code", "androidx.core.app · libraries",
  ]);
});

test("Android files with no methods list under their package, libraries apart, and drop out of Renamed", () => {
  const apk: readonly Fn[] = [{ addr: "0x1", name: "com.example.hermes.MainActivity.onCreate", kind: "function", file: "com/example/hermes/MainActivity.java" }];
  const nameOf = (addr: string): string => apk.find((f) => f.addr === addr)?.name ?? addr;
  const bareFiles = ["com/example/hermes/R.java", "androidx/core/R.java"];
  const options = { ...base, nameOf, sort: "files" as const, bareFiles };
  const rows = functionRows(apk, { ...options, flipped: expandAll(apk, options) });
  expect(shape(rows)).toEqual([
    "[group Your code 1]", "[folder com.example.hermes 1]", "  [file MainActivity.java 1]", "    onCreate", "  [file R.java 0]",
    "[group Libraries 0]", "[folder androidx.core 0]", "  [file R.java 0]",
  ]);
  expect(functionRows(apk, { ...options, show: "renamed" }).length).toBe(0);
});

