import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { z } from "zod";

import { readOr } from "../lib/schema";
import { supportPath } from "../lib/support";
import type { OptionChoice, SessionOption } from "./events";

type Known = Readonly<Record<string, readonly OptionChoice[]>>;

const CHOICE: z.ZodType<OptionChoice> = z.object({ value: z.string(), name: z.string(), description: z.string().nullable().catch(null) });
const KNOWN: z.ZodType<Known> = z.record(z.string(), z.array(CHOICE)).catch({});

function file(): string {
  return supportPath("agent-models.json");
}

function load(): Known {
  try {
    return readOr(KNOWN, JSON.parse(readFileSync(file(), "utf8")), {});
  } catch {
    return {};
  }
}

/** The models an agent offered the last time one of its sessions started, so Settings can list them. */
export function knownModels(agentId: string): readonly OptionChoice[] {
  return load()[agentId] ?? [];
}

export function rememberModels(agentId: string, options: readonly SessionOption[]): void {
  const choices = options.find((option) => option.category === "model")?.choices;
  if (!choices || choices.length === 0) return;
  const all = load();
  if (JSON.stringify(all[agentId]) === JSON.stringify(choices)) return;
  try {
    mkdirSync(dirname(file()), { recursive: true });
    writeFileSync(file(), `${JSON.stringify({ ...all, [agentId]: choices }, null, 2)}\n`);
  } catch {
    return;
  }
}
