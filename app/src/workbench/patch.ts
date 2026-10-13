import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { extname, join } from "node:path";
import { currentSettings, pathSetting } from "../settings/store";

import { isRecord } from "../lib/guards";
import { YOU } from "../engine/edits";
import { loadProject, updateProject, type Patch } from "../engine/project";
import { rea } from "../engine/rea";
import type { Program } from "./model";
import { reveal } from "../lib/platform";


export type ByteEdit = Patch;

type Placed = { readonly offset: number; readonly bytes: readonly number[] };

function patchDir(): string {
  return pathSetting("exportDir", "ELEVEN_EXPORT_DIR") ?? join(homedir(), "Downloads", "Eleven");
}

function safe(name: string): string {
  return name.replace(/[^\w.-]/g, "_").slice(0, 80);
}

function patchedName(name: string): string {
  const ext = extname(name);
  const stem = ext ? name.slice(0, -ext.length) : name;
  return `${safe(stem)}.patched${ext}`;
}

export function parseBytes(hex: string): readonly number[] {
  const clean = hex.replace(/\s+/g, "");
  if (clean.length === 0 || clean.length % 2 !== 0 || /[^0-9a-fA-F]/.test(clean)) {
    throw new Error(`"${hex}" is not an even run of hex bytes.`);
  }
  return (clean.match(/.{2}/g) ?? []).map((pair) => parseInt(pair, 16));
}

/** The accumulated patches with the incoming edits merged in, newest wins per address. */
function merge(saved: readonly Patch[], edits: readonly ByteEdit[]): readonly Patch[] {
  const byAddr = new Map(saved.map((patch) => [patch.addr, patch]));
  for (const edit of edits) byAddr.set(edit.addr, edit);
  return [...byAddr.values()];
}

export async function fileOffset(path: string, address: string): Promise<number> {
  const reply = await rea.tool(path, "address_to_file_offset", { address });
  const offset = isRecord(reply) ? reply.file_offset : undefined;
  if (typeof offset !== "number") throw new Error(`${address} has no byte in the file to change.`);
  return offset;
}

function noOverlap(placed: readonly Placed[]): void {
  const sorted = [...placed].sort((a, b) => a.offset - b.offset);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const here = sorted[i];
    if (prev && here && prev.offset + prev.bytes.length > here.offset) {
      throw new Error("Two edits cover the same bytes. Combine them into one.");
    }
  }
}

async function writeCopy(program: Program, all: readonly Patch[]): Promise<string> {
  const buffer = await readFile(program.path);
  const placed: Placed[] = [];
  for (const edit of all) {
    const bytes = parseBytes(edit.bytes);
    const offset = await fileOffset(program.path, edit.addr);
    if (offset + bytes.length > buffer.length) throw new Error(`The edit at ${edit.addr} runs past the end of the file.`);
    placed.push({ offset, bytes });
  }
  noOverlap(placed);
  for (const { offset, bytes } of placed) buffer.set(bytes, offset);
  const dir = join(patchDir(), safe(program.name));
  await mkdir(dir, { recursive: true });
  const path = join(dir, patchedName(program.name));
  await writeFile(path, buffer);
  if (currentSettings().revealExports && !pathSetting("exportDir", "ELEVEN_EXPORT_DIR")) reveal(path);
  return path;
}

/** Records the edits in the project, then writes a copy of the binary with every saved patch applied. */
export async function patchBytes(program: Program, edits: readonly ByteEdit[]): Promise<string> {
  const all = merge(loadProject(program.id).patches, edits);
  if (all.length === 0) throw new Error("Nothing to patch.");
  for (const edit of all) parseBytes(edit.bytes);
  const path = await writeCopy(program, all);
  updateProject(program.id, (project) => ({ ...project, patches: all }), YOU);
  return path;
}
