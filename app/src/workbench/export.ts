import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { currentSettings, pathSetting } from "../settings/store";

import { isRecord, stringField } from "../lib/guards";
import { rea } from "../engine/rea";
import type { Program } from "./model";
import { openExternal, reveal } from "../lib/platform";

export type ObjcEntry = { readonly address: string; readonly name: string };

function exportDir(): string {
  return pathSetting("exportDir", "ELEVEN_EXPORT_DIR") ?? join(homedir(), "Downloads", "Eleven");
}

/** Opens this program's exports folder in the file manager, making it first if nothing was exported yet. */
export async function openExportsFolder(program: Program): Promise<void> {
  const dir = join(exportDir(), safe(program.name));
  await mkdir(dir, { recursive: true });
  openExternal(dir);
}

function safe(name: string): string {
  return name.replace(/[^\w.-]/g, "_").slice(0, 80);
}

async function write(program: Program, file: string, body: string): Promise<string> {
  const dir = join(exportDir(), safe(program.name));
  await mkdir(dir, { recursive: true });
  const path = join(dir, file);
  await writeFile(path, body);
  if (currentSettings().revealExports && !pathSetting("exportDir", "ELEVEN_EXPORT_DIR")) reveal(path);
  return path;
}

/** Writes a function's control-flow graph as a PDF in Downloads/Eleven and reveals it. */
export function exportGraphPdf(program: Program, name: string, pdf: string): Promise<string> {
  return write(program, `${safe(name)}.graph.pdf`, pdf);
}

/** Writes one function's pseudocode or assembly to a file in Downloads/Eleven and reveals it. */
export async function exportFunction(program: Program, addr: string, view: "pseudo" | "asm", name: string): Promise<string> {
  const code = await program.code(addr, view);
  return write(program, `${safe(name)}.${view === "pseudo" ? "c" : "s"}`, code);
}

/** Writes a GPU kernel rewritten by the agent to a file in Downloads/Eleven and reveals it. */
export function exportKernel(program: Program, name: string, extension: string, code: string): Promise<string> {
  return write(program, `${safe(name)}.${extension}`, code);
}

function entries(reply: unknown, key: string): readonly ObjcEntry[] {
  const list = isRecord(reply) && Array.isArray(reply[key]) ? reply[key] : [];
  return list.flatMap((item) => {
    const address = stringField(item, "address");
    const name = stringField(item, "name");
    return address && name ? [{ address, name }] : [];
  });
}

/** A readable listing of a binary's Objective-C classes and protocols with their addresses. */
export function objcInventory(name: string, classes: readonly ObjcEntry[], protocols: readonly ObjcEntry[]): string {
  const section = (title: string, rows: readonly ObjcEntry[]): string => {
    if (rows.length === 0) return `${title}\n  none\n`;
    const body = rows.map((row) => `  ${row.address}  ${row.name}`).join("\n");
    return `${title}\n${body}\n`;
  };
  const header = `// Objective-C in ${name}: ${classes.length} classes, ${protocols.length} protocols\n`;
  return [header, section("Classes", classes), section("Protocols", protocols)].join("\n");
}

/** Writes the binary's Objective-C class and protocol inventory to a file, read in two REA calls. */
export async function exportObjcInventory(program: Program): Promise<string> {
  const [classReply, protoReply] = await Promise.all([
    rea.tool(program.path, "get_objc_classes", { pattern: "" }),
    rea.tool(program.path, "get_objc_protocols", {}),
  ]);
  const classes = entries(classReply, "classes");
  const protocols = entries(protoReply, "protocols");
  return write(program, `${safe(program.name)}-objc.txt`, objcInventory(program.name, classes, protocols));
}

/** Writes every function's pseudocode to one file, decompiled in a single REA call. */
export async function exportAllPseudocode(program: Program): Promise<string> {
  const addresses = program.functions.map((fn) => fn.addr);
  const reply = await rea.tool(program.path, "batch_decompile", { addresses });
  const items = isRecord(reply) && Array.isArray(reply.items) ? reply.items : [];
  const body = items
    .flatMap((item) => {
      const name = isRecord(item) ? stringField(item.procedure, "name") ?? stringField(item, "address") : null;
      const code = stringField(item, "pseudocode");
      return name && code ? [`// ${name}\n${code.trim()}\n`] : [];
    })
    .join("\n");
  return write(program, `${safe(program.name)}-pseudocode.c`, body);
}
