import type { SwiftType } from "../engine/swiftTypes";
import type { Fn, Program, TableRow } from "./model";
import { sourcePaths } from "./sidebar/model";

/** Paths the Swift compiler inlines from its own library; they aren't the app's files. */
const LIBRARY = /^(?:Swift|_Concurrency|_StringProcessing|Observation|Distributed|RegexBuilder|Synchronization)\//;
const MAX_STRINGS = 8;

export type GuessedFile = { readonly file: string; readonly type: string };

export type SourceFiles = {
  readonly paths: readonly string[];
  readonly library: readonly string[];
  /** One file per top-level Swift type that no path accounts for, named after the type. */
  readonly guessed: readonly GuessedFile[];
};

export function stemOf(file: string): string {
  const name = file.split("/").pop() ?? file;
  return (name.replace(/\.[^.]+$/, "").split("+")[0] ?? name).trim();
}

export function sourceFiles(strings: readonly string[], types: readonly SwiftType[]): SourceFiles {
  const all = sourcePaths(strings);
  const paths = all.filter((path) => !LIBRARY.test(path));
  const taken = new Set(paths.map(stemOf));
  const guessed = new Map<string, GuessedFile>();
  for (const type of types) {
    const top = type.name.split(".")[0] ?? "";
    if (!top || top.startsWith("_") || taken.has(top) || guessed.has(top)) continue;
    guessed.set(top, { file: `${top}.swift`, type: top });
  }
  return { paths, library: all.filter((path) => LIBRARY.test(path)), guessed: [...guessed.values()].sort((a, b) => a.file.localeCompare(b.file)) };
}

export type TraceReason = "metadata" | "accessor" | "path" | "named";

export type TracedFn = { readonly addr: string; readonly why: TraceReason };

export type FileTrace = {
  readonly file: string;
  readonly guessed: boolean;
  readonly types: readonly SwiftType[];
  readonly fns: readonly TracedFn[];
  readonly strings: readonly string[];
};

/** The file's own types: the one it's named after and everything nested in it. */
export function typesOfFile(file: string, types: readonly SwiftType[]): readonly SwiftType[] {
  const stem = stemOf(file);
  return types.filter((type) => type.name.split(".")[0] === stem);
}

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A name mentions the type plainly (`Type.method`) or mangled with its length (`30Type`). */
function mentions(stem: string): RegExp {
  const name = escaped(stem);
  return new RegExp(`(?:^|[^A-Za-z0-9_])${name}(?:$|[^A-Za-z0-9_])|(?<![0-9])${stem.length}${name}`);
}

/** What the binary ties to a file without asking the engine: the types' metadata and the function names. */
export function traceStatic(file: string, guessed: boolean, types: readonly SwiftType[], functions: readonly Fn[], strings: readonly TableRow[]): FileTrace {
  const own = typesOfFile(file, types);
  const known = new Set(functions.map((fn) => fn.addr));
  const fns = new Map<string, TracedFn>();
  const add = (addr: string, why: TraceReason): void => {
    if (known.has(addr) && !fns.has(addr)) fns.set(addr, { addr, why });
  };
  for (const type of own) {
    for (const method of type.methods) add(method, "metadata");
    if (type.accessor) add(type.accessor, "accessor");
  }
  const stem = stemOf(file);
  const named = mentions(stem);
  for (const fn of functions) if (fn.kind === "function" && named.test(fn.name)) add(fn.addr, "named");
  const said = strings.filter((row) => row.b.includes(stem)).slice(0, MAX_STRINGS).map((row) => row.b);
  return { file, guessed, types: own, fns: [...fns.values()], strings: said };
}

/** Adds the functions that use the file's path, which Swift leaves behind for asserts and logging. */
export async function traceFile(program: Program, file: string, guessed: boolean, types: readonly SwiftType[]): Promise<FileTrace> {
  const base = traceStatic(file, guessed, types, program.functions, program.strings);
  const codeUsing = program.codeUsing;
  if (guessed || !codeUsing) return base;
  const known = new Set(program.functions.map((fn) => fn.addr));
  const sites = program.strings.filter((row) => row.b.includes(file));
  const users = (await Promise.all(sites.map(async (row) => {
    try {
      return await codeUsing(row.a);
    } catch {
      return [];
    }
  }))).flat();
  const seen = new Set(base.fns.map((fn) => fn.addr));
  const extra = [...new Set(users)].filter((addr) => known.has(addr) && !seen.has(addr)).map((addr): TracedFn => ({ addr, why: "path" }));
  return { ...base, fns: [...base.fns, ...extra] };
}
