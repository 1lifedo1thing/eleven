import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { z } from "zod";

import { readOr } from "../lib/schema";
import { supportPath } from "../lib/support";

export type Picks = Readonly<Record<string, string>>;

const PICKS: z.ZodType<Readonly<Record<string, Picks>>> = z.record(z.string(), z.record(z.string(), z.string())).catch({});

function file(): string {
  return supportPath("agent-picks.json");
}

function load(): Readonly<Record<string, Picks>> {
  try {
    return readOr(PICKS, JSON.parse(readFileSync(file(), "utf8")), {});
  } catch {
    return {};
  }
}

/** The model, mode, effort and other options you last picked for an agent, by option id. */
export function savedPicks(agentId: string): Picks {
  return load()[agentId] ?? {};
}

export function rememberPick(agentId: string, optionId: string, value: string): void {
  const all = load();
  if (all[agentId]?.[optionId] === value) return;
  try {
    mkdirSync(dirname(file()), { recursive: true });
    writeFileSync(file(), `${JSON.stringify({ ...all, [agentId]: { ...all[agentId], [optionId]: value } }, null, 2)}\n`);
  } catch {
    return;
  }
}
