import { isRecord, stringField } from "../lib/guards";
import { type Opened, rea } from "./rea";

export type Block = { readonly start: string; readonly end: string; readonly successors: readonly string[] };

export type CallSite = { readonly from: string; readonly at: string };

export type Dossier = {
  readonly blocks: readonly Block[];
  readonly callers: readonly CallSite[];
  readonly callees: readonly string[];
  readonly comments: ReadonlyMap<string, string>;
};

function list(value: unknown, key: string): readonly unknown[] {
  const field = isRecord(value) ? value[key] : undefined;
  return Array.isArray(field) ? field : [];
}

function block(entry: unknown): readonly Block[] {
  const start = stringField(entry, "start");
  const end = stringField(entry, "end");
  if (!start || !end) return [];
  const successors = list(entry, "successors").filter((item): item is string => typeof item === "string");
  return [{ start, end, successors }];
}

function callSite(entry: unknown): readonly CallSite[] {
  const at = stringField(entry, "source_address");
  const from = isRecord(entry) ? stringField(entry.source_procedure, "address") : undefined;
  return at && from ? [{ from, at }] : [];
}

function comment(entry: unknown): readonly (readonly [string, string])[] {
  const address = stringField(entry, "address");
  const text = stringField(entry, "text") ?? stringField(entry, "comment");
  return address && text ? [[address, text]] : [];
}

/** Reads a function's dossier from REA and keeps the parts the workbench draws. */
export async function loadDossier(target: Opened, procedure: string): Promise<Dossier> {
  const value = await rea.analyze(target, procedure);
  const sites = list(value, "incoming_references").flatMap(callSite);
  const callerAddrs = list(value, "callers").flatMap((entry) => stringField(entry, "address") ?? []);
  const callers = callerAddrs.map((from) => sites.find((site) => site.from === from) ?? { from, at: from });
  return {
    blocks: list(value, "basic_blocks").flatMap(block),
    callers,
    callees: list(value, "callees").flatMap((entry) => stringField(entry, "address") ?? []),
    comments: new Map(list(value, "comments").flatMap(comment)),
  };
}
