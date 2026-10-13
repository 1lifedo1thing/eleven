import type { Fn } from "../workbench/model";

/** What a run of bytes is read as. Data has its size, so replaying a saved change always lands the same way. */
export const CODE_TYPES = ["code", "procedure", "byte", "word", "dword", "qword", "cstring", "undefined"] as const;

export type CodeType = (typeof CODE_TYPES)[number];

/** What you pick in the menu; "data" steps through the sizes like Hopper's D key. */
export type TypeChoice = "code" | "procedure" | "data" | "cstring" | "undefined";

const SIZES = ["byte", "word", "dword", "qword"] as const;

export function isCodeType(value: unknown): value is CodeType {
  return CODE_TYPES.some((type) => type === value);
}

/** The type a choice lands on: data grows byte, word, dword, qword, then wraps; the rest stay as picked. */
export function resolveType(choice: TypeChoice, current: string | null): CodeType {
  if (choice !== "data") return choice;
  const at = SIZES.findIndex((size) => size === current);
  return SIZES[(at + 1) % SIZES.length] ?? "byte";
}

const WORDS: Readonly<Record<CodeType, string>> = {
  code: "code",
  procedure: "a function",
  byte: "a byte",
  word: "a 2-byte word",
  dword: "a 4-byte value",
  qword: "an 8-byte value",
  cstring: "a C string",
  undefined: "undefined bytes",
};

export function describeType(value: string): string {
  return isCodeType(value) ? WORDS[value] : value;
}

/** The program's functions with your changes: new ones where you marked a function, none where you undefined its start. */
export function withTypes(functions: readonly Fn[], types: ReadonlyMap<string, string>): readonly Fn[] {
  const kept = functions.filter((fn) => types.get(fn.addr) !== "undefined");
  const known = new Set(kept.map((fn) => fn.addr));
  const added: Fn[] = [...types].flatMap(([addr, type]) => (type === "procedure" && !known.has(addr) ? [{ addr, name: `FUN_${addr.replace(/^0x/i, "")}`, kind: "function" as const }] : []));
  return added.length === 0 && kept.length === functions.length ? functions : [...kept, ...added];
}
