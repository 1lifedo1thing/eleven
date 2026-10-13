import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { z } from "zod";

import { readOr } from "../lib/schema";
import { supportPath } from "../lib/support";

type Remembered = Readonly<Record<string, readonly string[]>>;

const REMEMBERED: z.ZodType<Remembered> = z.record(z.string(), z.array(z.string()));

function file(): string {
  return supportPath("remembered-answers.json");
}

function load(): Remembered {
  try {
    return readOr(REMEMBERED, JSON.parse(readFileSync(file(), "utf8")), {});
  } catch {
    return {};
  }
}

/** Whether "Always allow" was picked for this tool in this project. */
export function isRemembered(project: string, tool: string): boolean {
  return load()[project]?.includes(tool) ?? false;
}

export function rememberAnswer(project: string, tool: string): void {
  const all = load();
  const tools = all[project] ?? [];
  if (tools.includes(tool)) return;
  mkdirSync(dirname(file()), { recursive: true });
  writeFileSync(file(), `${JSON.stringify({ ...all, [project]: [...tools, tool] }, null, 2)}\n`);
}

/** How many projects have at least one remembered "Always allow". */
export function rememberedAnswerProjects(): number {
  return Object.values(load()).filter((tools) => tools.length > 0).length;
}

/** Forgets every remembered answer and returns how many projects had some. */
export function forgetAnswers(): number {
  const count = rememberedAnswerProjects();
  rmSync(file(), { force: true });
  return count;
}
