import "./fixtures/isolate";
import { expect, test } from "bun:test";

import { resolveType, withTypes } from "../src/engine/codeTypes";
import { describeEdit, setValue, YOU } from "../src/engine/edits";
import { redo, undo } from "../src/engine/history";
import { asChars, formatOperand, lastImmediate, type Lookup } from "../src/engine/operands";
import { EMPTY_PROJECT, loadProject, updateProject } from "../src/engine/project";
import { rizinTypeCommands } from "../src/engine/rizin";

const LOOKUP: Lookup = {
  at: (value) => (value === 0x100004000n ? "_usage" : null),
  below: (value) => (value >= 0x100004000n ? { name: "_usage", start: 0x100004000n } : null),
};

test("types: the last number in an instruction is found, never its own address or a register", () => {
  expect(lastImmediate("0x100000964: stp x28, x27, [sp, #-0x60]!")?.value).toBe(-0x60n);
  expect(lastImmediate("0x100000984: mov x19, x1")).toBeNull();
  expect(lastImmediate("0x100000960: pacibsp")).toBeNull();
  expect(lastImmediate("0x401000: MOV EAX,0x10")?.value).toBe(0x10n);
});

test("types: each format rewrites only that number", () => {
  const line = "0x100000980: sub sp, sp, #0x640";
  expect(formatOperand(line, "decimal", LOOKUP)).toBe("0x100000980: sub sp, sp, #1600");
  expect(formatOperand("0x1: cmp w0, #0x41", "char", LOOKUP)).toBe("0x1: cmp w0, #'A'");
  expect(formatOperand("0x1: mov w8, #0x47494638", "char", LOOKUP)).toBe("0x1: mov w8, #'GIF8'");
  expect(formatOperand("0x1: stp x28, x27, [sp, #-0x60]!", "decimal", LOOKUP)).toBe("0x1: stp x28, x27, [sp, #-96]!");
  expect(formatOperand("0x1: adrp x1, 0x100004000", "address", LOOKUP)).toBe("0x1: adrp x1, _usage");
  expect(formatOperand("0x1: mov x0, #0x100004010", "offset", LOOKUP)).toBe("0x1: mov x0, _usage+0x10");
  expect(formatOperand("0x1: mov x0, #0x10", "offset", LOOKUP)).toBe("0x1: mov x0, 0x10");
  expect(formatOperand("0x1: mov w0, #1600", "hex", LOOKUP)).toBe("0x1: mov w0, #0x640");
  expect(formatOperand("0x1: ret", "decimal", LOOKUP)).toBe("0x1: ret");
  expect(asChars(0x0an)).toBe("'\\n'");
});

test("types: data steps through the sizes like Hopper's D key, other choices stay as picked", () => {
  expect(resolveType("data", null)).toBe("byte");
  expect(resolveType("data", "byte")).toBe("word");
  expect(resolveType("data", "word")).toBe("dword");
  expect(resolveType("data", "dword")).toBe("qword");
  expect(resolveType("data", "qword")).toBe("byte");
  expect(resolveType("data", "cstring")).toBe("byte");
  expect(resolveType("procedure", "byte")).toBe("procedure");
});

test("types: a marked function joins the list and an undefined one leaves it", () => {
  const fns = [{ addr: "0x10", name: "a", kind: "function" as const }, { addr: "0x20", name: "b", kind: "function" as const }];
  expect(withTypes(fns, new Map())).toBe(fns);
  const changed = withTypes(fns, new Map([["0x20", "undefined"], ["0x30", "procedure"], ["0x10", "procedure"]]));
  expect(changed.map((fn) => fn.addr)).toEqual(["0x10", "0x30"]);
  expect(changed[1]?.name).toBe("FUN_30");
});

test("types: rizin gets the commands for each type, and only drops a function it was asked to make", () => {
  expect(rizinTypeCommands("0x10", "word", null)).toEqual(["C- @ 0x10", "Cd 2 @ 0x10"]);
  expect(rizinTypeCommands("0x10", "cstring", null)).toEqual(["C- @ 0x10", "Cs @ 0x10"]);
  expect(rizinTypeCommands("0x10", "procedure", null)).toEqual(["C- @ 0x10", "af @ 0x10"]);
  expect(rizinTypeCommands("0x10", null, "byte")).toEqual(["C- @ 0x10"]);
  expect(rizinTypeCommands("0x10", null, "procedure")).toEqual(["C- @ 0x10", "af- @ 0x10"]);
});

test("types: type and format changes are saved, logged and undone like any other edit", () => {
  const id = "types-project";
  updateProject(id, () => EMPTY_PROJECT, null);
  updateProject(id, (project) => setValue(project, "types", "0x100000980", "byte"), YOU);
  updateProject(id, (project) => setValue(project, "formats", "0x10000097c", "decimal"), YOU);
  const saved = loadProject(id);
  expect(saved.types.get("0x100000980")).toBe("byte");
  expect(saved.formats.get("0x10000097c")).toBe("decimal");
  const [typed, shown] = saved.edits;
  if (!typed || !shown) throw new Error("both edits should be logged");
  expect(describeEdit(typed, (addr) => addr)).toBe("Marked 0x100000980 as a byte");
  expect(describeEdit(shown, (addr) => addr)).toBe("Showed the number at 0x10000097c as decimal");
  undo(id);
  undo(id);
  expect(loadProject(id).types.size).toBe(0);
  expect(loadProject(id).formats.size).toBe(0);
  redo(id);
  expect(loadProject(id).types.get("0x100000980")).toBe("byte");
});
