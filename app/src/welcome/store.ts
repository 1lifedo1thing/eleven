import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { isRecord } from "../lib/guards";
import { dataRoot } from "../lib/platform";

const FILE = join(dataRoot(), "welcome.json");
const MAX_RECENT = 12;

export type RecentOpen = { readonly path: string; readonly arch: string; readonly universal: boolean; readonly at: number };

export type MatchPreference = "ask" | "match-this-mac";

type WelcomeState = { readonly done: boolean; readonly match: MatchPreference; readonly recent: readonly RecentOpen[] };

function parseRecent(value: unknown): RecentOpen | null {
  if (!isRecord(value)) return null;
  const { path, arch, universal, at } = value;
  if (typeof path !== "string" || typeof arch !== "string" || typeof at !== "number") return null;
  return { path, arch, universal: universal === true, at };
}

function load(): WelcomeState {
  try {
    const json: unknown = JSON.parse(readFileSync(FILE, "utf8"));
    if (!isRecord(json)) return { done: false, match: "ask", recent: [] };
    const recent = Array.isArray(json.recent) ? json.recent.map(parseRecent).filter((item): item is RecentOpen => item !== null) : [];
    return { done: json.done === true, match: json.match === "match-this-mac" ? "match-this-mac" : "ask", recent };
  } catch {
    return { done: false, match: "ask", recent: [] };
  }
}

function save(state: WelcomeState): void {
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, `${JSON.stringify(state, null, 2)}\n`);
  } catch {
    return;
  }
}

/** True until the user has finished the first-run screen once. */
export function needsWelcome(): boolean {
  return !load().done;
}

export function markWelcomeDone(): void {
  save({ ...load(), done: true });
}

export function recentOpens(): readonly RecentOpen[] {
  return load().recent;
}

export function matchPreference(): MatchPreference {
  return load().match;
}

export function recordOpen(open: RecentOpen, match: MatchPreference): void {
  const state = load();
  const recent = [open, ...state.recent.filter((item) => item.path !== open.path)].slice(0, MAX_RECENT);
  save({ ...state, match, recent });
}
