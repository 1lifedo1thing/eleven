import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { basename } from "node:path";
import { promisify } from "node:util";

import type { ModelInfo, ModelLayer, ModelRisk } from "../types";
import { bytes, head } from "./read";

const run = promisify(execFile);
const MAX_PICKLE = 64 * 1024 * 1024;

/** Imports that let a pickle run code on whoever loads it. */
const DANGEROUS = /^(os|posix|nt|subprocess|sys|socket|shutil|runpy|pty|webbrowser|importlib|ctypes)\b|^builtins\.(eval|exec|compile|__import__|open|getattr)$|^__builtin__\./;

const SHORT_BINUNICODE = 0x8c;
const BINUNICODE = 0x58;
const GLOBAL = 0x63;
const STACK_GLOBAL = 0x93;

/** The module.name pairs a pickle imports, read from its GLOBAL and STACK_GLOBAL opcodes. */
export function pickleImports(data: Buffer): readonly string[] {
  const found = new Set<string>();
  const recent: string[] = [];
  for (let at = 0; at < data.length; at++) {
    const op = data[at];
    if (op === GLOBAL) {
      const end1 = data.indexOf(0x0a, at + 1);
      const end2 = end1 < 0 ? -1 : data.indexOf(0x0a, end1 + 1);
      if (end1 > 0 && end2 > 0 && end2 - at < 512) {
        found.add(`${data.toString("latin1", at + 1, end1)}.${data.toString("latin1", end1 + 1, end2)}`);
        at = end2;
      }
    } else if (op === SHORT_BINUNICODE && at + 1 < data.length) {
      const length = data[at + 1] ?? 0;
      recent.push(data.toString("utf8", at + 2, at + 2 + length));
      at += 1 + length;
    } else if (op === BINUNICODE && at + 5 <= data.length) {
      const length = data.readUInt32LE(at + 1);
      if (length < 4096) {
        recent.push(data.toString("utf8", at + 5, at + 5 + length));
        at += 4 + length;
      }
    } else if (op === STACK_GLOBAL && recent.length >= 2) {
      found.add(`${recent.at(-2)}.${recent.at(-1)}`);
    }
  }
  return [...found];
}

async function pickleBytes(path: string): Promise<Buffer> {
  const start = await head(path, 4);
  if (start.toString("latin1", 0, 2) !== "PK") return head(path, MAX_PICKLE);
  const { stdout: listing } = await run("unzip", ["-Z1", path], { maxBuffer: 16 * 1024 * 1024 });
  const entry = listing.split("\n").find((name) => name.endsWith("data.pkl"));
  if (!entry) return Buffer.alloc(0);
  const { stdout } = await run("unzip", ["-p", path, entry], { encoding: "buffer", maxBuffer: MAX_PICKLE });
  return stdout;
}

/** A PyTorch or pickle file: what it imports when loaded, and whether any of that runs code. */
export async function readPickle(path: string): Promise<ModelInfo> {
  const imports = pickleImports(await pickleBytes(path));
  const dangerous = imports.filter((name) => DANGEROUS.test(name));
  const layers: ModelLayer[] = imports.map((name) => ({ name, op: DANGEROUS.test(name) ? "runs code" : "import", shape: "", type: "" }));
  const risk: ModelRisk | null = dangerous.length > 0
    ? { title: `${basename(path)} runs Python code when it loads`, detail: `It's a pickle file that calls ${dangerous.join(", ")}. Eleven read it without loading it. Don't open it in PyTorch.` }
    : null;
  return { name: basename(path), format: "PyTorch pickle", weights: bytes((await stat(path)).size), inputs: [], outputs: [], layers, risk };
}
