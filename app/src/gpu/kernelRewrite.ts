import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { askQuietly, codeFrom, type QuietAsk, type RewriteProgress } from "../engine/rewrite";
import { isRecord } from "../lib/guards";
import { cacheRoot } from "../lib/platform";
import type { Binding } from "./types";

export const KERNEL_LANGUAGES = ["CUDA C++", "HIP C++", "Metal"] as const;
export type KernelLanguage = (typeof KERNEL_LANGUAGES)[number];

/** One kernel's PTX and what the file says about it, plus who rewrites it. */
export type KernelRequest = QuietAsk & {
  readonly library: string;
  readonly kernel: string;
  readonly ptx: string;
  readonly params: readonly Binding[];
  readonly stats: readonly Binding[];
};

/** A plain-words note beside a run of PTX lines; `surprise` marks something the compiler added that the source never asked for. */
export type KernelNote = { readonly from: number; readonly to: number; readonly note: string; readonly surprise: boolean };

export const KERNEL_FENCE: Readonly<Record<KernelLanguage, string>> = { "CUDA C++": "cuda", "HIP C++": "hip", Metal: "metal" };
export const KERNEL_EXTENSION: Readonly<Record<KernelLanguage, string>> = { "CUDA C++": "cu", "HIP C++": "hip.cpp", Metal: "metal" };

const TARGET: Readonly<Record<KernelLanguage, string>> = {
  "CUDA C++": "readable CUDA C++, as close as you can tell to the source it was compiled from",
  "HIP C++": "HIP C++ that builds for AMD GPUs with hipcc, keeping the same behavior",
  Metal: "a Metal Shading Language compute kernel for Apple GPUs, with the parameters as buffers and the thread index from thread_position_in_grid",
};

function described(label: string, rows: readonly Binding[]): readonly string[] {
  return rows.length === 0 ? [] : [`${label}: ${rows.map((row) => `${row.slot} ${row.type}`).join(", ")}`];
}

export function kernelRewritePrompt(req: KernelRequest, language: KernelLanguage): string {
  return [
    `Rewrite the CUDA kernel ${req.kernel} as ${TARGET[language]}.`,
    "",
    `It comes from ${req.library}, in ${req.binary.path}. Below is its PTX, NVIDIA's portable assembly.`,
    ...described("Parameters", req.params),
    ...described("Resources", req.stats),
    "",
    "Keep the behavior exactly, including the bounds checks. Give parameters and variables meaningful names when the code makes them clear. Leave out checks the compiler added on its own, like testing whether a 64-bit divide fits in 32 bits, and say so in one short comment.",
    `Reply with one \`\`\`${KERNEL_FENCE[language]} code block holding the whole kernel, and nothing else. Don't change any files.`,
    "",
    "```ptx",
    req.ptx,
    "```",
  ].join("\n");
}

export function kernelExplainPrompt(req: KernelRequest): string {
  const numbered = req.ptx.split("\n").map((line, ix) => `${ix + 1}: ${line}`);
  return [
    `Explain the PTX of the CUDA kernel ${req.kernel} from ${req.library}, one group of lines at a time, for someone who doesn't read PTX.`,
    ...described("Parameters", req.params),
    "",
    "Split the lines into groups that each do one thing (reading parameters, working out the thread's index, a bounds check, a load, a store). Each note is one or two plain sentences that say what the group does in terms of the kernel's own values, not instruction by instruction.",
    "Set surprise to true only for something the compiler added that the source never asked for, like a fast path for small divides or flushing tiny floats to zero.",
    'Reply with only a JSON array, nothing else: [{"from": 1, "to": 14, "note": "...", "surprise": false}]. Line numbers are the ones below; groups don\'t overlap. Don\'t change any files.',
    "",
    ...numbered,
  ].join("\n");
}

type RawNote = { readonly from: number; readonly to: number; readonly note: string; readonly surprise?: unknown };

function isNote(value: unknown): value is RawNote {
  return isRecord(value) && typeof value["from"] === "number" && typeof value["to"] === "number" && typeof value["note"] === "string";
}

/** The notes in the agent's reply, in line order, keeping only well-formed groups that don't overlap. */
export function parseNotes(reply: string, lineCount: number): readonly KernelNote[] {
  const start = reply.indexOf("[");
  const end = reply.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(reply.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const notes = parsed.filter(isNote)
    .map((n) => ({ from: Math.max(1, Math.round(n.from)), to: Math.min(lineCount, Math.round(n.to)), note: n.note.trim(), surprise: n.surprise === true }))
    .filter((n) => n.from <= n.to && n.note.length > 0)
    .sort((a, b) => a.from - b.from);
  return notes.filter((n, ix) => ix === 0 || n.from > (notes[ix - 1]?.to ?? 0));
}

function kernelDir(req: KernelRequest): string {
  const key = createHash("sha256").update(JSON.stringify([req.library, req.kernel, req.ptx])).digest("hex");
  return join(cacheRoot(), "kernels", req.projectId, key);
}

function rewriteFile(req: KernelRequest, language: KernelLanguage): string {
  return join(kernelDir(req), `${req.agent.id}.${KERNEL_FENCE[language]}.txt`);
}

function notesFile(req: KernelRequest): string {
  return join(kernelDir(req), `${req.agent.id}.notes.json`);
}

async function saved(file: string): Promise<string | null> {
  try {
    return await readFile(file, "utf8");
  } catch {
    return null;
  }
}

async function keep(file: string, body: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, body);
}

const running = new Map<string, Promise<string>>();

/** Runs `work` once per file at a time, so opening the same kernel twice doesn't ask the agent twice. */
async function once(file: string, work: () => Promise<string>): Promise<string> {
  const pending = running.get(file) ?? work();
  running.set(file, pending);
  try {
    return await pending;
  } finally {
    running.delete(file);
  }
}

export async function savedKernelRewrite(req: KernelRequest, language: KernelLanguage): Promise<string | null> {
  return await saved(rewriteFile(req, language));
}

/** The kernel rewritten by the chat's agent, saved so reopening it is instant. */
export async function rewriteKernel(req: KernelRequest, language: KernelLanguage, onProgress: (progress: RewriteProgress) => void): Promise<string> {
  const file = rewriteFile(req, language);
  const known = await saved(file);
  if (known !== null) return known;
  return await once(file, async () => {
    const code = codeFrom(await askQuietly(req, kernelRewritePrompt(req, language), onProgress));
    await keep(file, code);
    return code;
  });
}

export async function forgetKernelRewrite(req: KernelRequest, language: KernelLanguage): Promise<void> {
  await rm(rewriteFile(req, language), { force: true });
}

/** Plain-words notes for groups of the kernel's PTX lines, saved like rewrites. */
export async function explainKernel(req: KernelRequest, onProgress: (progress: RewriteProgress) => void): Promise<readonly KernelNote[]> {
  const lineCount = req.ptx.split("\n").length;
  const file = notesFile(req);
  const known = await saved(file);
  if (known !== null) return parseNotes(known, lineCount);
  const reply = await once(file, async () => {
    const text = await askQuietly(req, kernelExplainPrompt(req), onProgress);
    const notes = parseNotes(text, lineCount);
    if (notes.length === 0) throw new Error(`${req.agent.name} didn't send notes Eleven could read. Try again.`);
    await keep(file, JSON.stringify(notes));
    return text;
  });
  return parseNotes(reply, lineCount);
}
