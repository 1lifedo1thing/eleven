import { type FileHandle, open } from "node:fs/promises";
import { basename } from "node:path";

import { runSync } from "../../lib/process";
import type { ShaderFunction, ShaderLibrary } from "../types";
import { cubinKernels, type CudaKernel, cudaFunction, cudaSummary, entryBytes, type FatEntry, fatEntries, isCubin, isFatbin, ptxEntry, ptxKernels } from "./cuda";
import { BUNDLE_MAGIC, bundleEntries, bundleLength, gfxOf, hipFunction, type HipKernel, hipKernels, isAmdCodeObject, isCompressedBundle, unpackBundle } from "./hip";

type Span = { readonly offset: number; readonly size: number };

type GpuSections = { readonly cuda: Span | null; readonly hip: Span | null };

/** A CUDA section's fatbins, kept so a kernel's PTX can be read back when it is opened. */
type CudaIndex = { readonly span: Span; readonly entries: readonly FatEntry[]; readonly fatbinOf: ReadonlyMap<string, number> };

const BUNDLE_SCAN = 1024 * 1024;
const HEAD = 4096;
const cudaIndexes = new Map<string, CudaIndex>();

async function bytesAt(file: FileHandle, offset: number, size: number): Promise<Buffer> {
  const buf = Buffer.alloc(size);
  const { bytesRead } = await file.read(buf, 0, size, offset);
  return buf.subarray(0, bytesRead);
}

function cString(buf: Buffer, at: number): string {
  const end = buf.indexOf(0, at);
  return buf.toString("latin1", at, end < 0 ? buf.length : end);
}

async function elfSections(file: FileHandle, head: Buffer): Promise<GpuSections> {
  const shoff = Number(head.readBigUInt64LE(0x28));
  const entsize = head.readUInt16LE(0x3a);
  const count = head.readUInt16LE(0x3c);
  const headers = await bytesAt(file, shoff, entsize * count);
  const at = (ix: number): { readonly name: number; readonly offset: number; readonly size: number } => ({
    name: headers.readUInt32LE(ix * entsize),
    offset: Number(headers.readBigUInt64LE(ix * entsize + 0x18)),
    size: Number(headers.readBigUInt64LE(ix * entsize + 0x20)),
  });
  const table = at(head.readUInt16LE(0x3e));
  const names = await bytesAt(file, table.offset, table.size);
  const found = new Map(Array.from({ length: count }, (_, ix) => at(ix)).map((s) => [cString(names, s.name), { offset: s.offset, size: s.size }]));
  return { cuda: found.get(".nv_fatbin") ?? null, hip: found.get(".hip_fatbin") ?? null };
}

/** Windows keeps section names to eight bytes, so .nv_fatbin and .hip_fatbin arrive cut short. */
async function peSections(file: FileHandle, head: Buffer): Promise<GpuSections> {
  const pe = head.readUInt32LE(0x3c);
  const coff = await bytesAt(file, pe, 24);
  if (coff.toString("latin1", 0, 4) !== "PE\0\0") return { cuda: null, hip: null };
  const count = coff.readUInt16LE(6);
  const table = await bytesAt(file, pe + 24 + coff.readUInt16LE(20), count * 40);
  const spans = Array.from({ length: count }, (_, ix) => ({ name: cString(table.subarray(ix * 40, ix * 40 + 8), 0), size: table.readUInt32LE(ix * 40 + 16), offset: table.readUInt32LE(ix * 40 + 20) }));
  const pick = (prefix: string): Span | null => {
    const s = spans.find((x) => x.name.startsWith(prefix));
    return s ? { offset: s.offset, size: s.size } : null;
  };
  return { cuda: pick(".nv_fatb"), hip: pick(".hip_fat") };
}

/** Where a file keeps its GPU code: a host binary's CUDA or HIP section, or the whole file when it is GPU code itself. */
async function gpuSections(file: FileHandle, size: number, path: string): Promise<GpuSections> {
  const head = await bytesAt(file, 0, Math.min(size, HEAD));
  const whole = { offset: 0, size };
  if (isFatbin(head) || isCubin(head) || /\.ptx$/i.test(path)) return { cuda: whole, hip: null };
  if (isAmdCodeObject(head) || isCompressedBundle(head) || head.subarray(0, BUNDLE_MAGIC.length).equals(BUNDLE_MAGIC)) return { cuda: null, hip: whole };
  if (head.length >= 64 && head.readUInt32BE(0) === 0x7f454c46 && head[4] === 2) return elfSections(file, head);
  if (head.toString("latin1", 0, 2) === "MZ" && head.length >= 64) return peSections(file, head);
  return { cuda: null, hip: null };
}

/** Readable kernel names; c++filt is on every Mac and Linux machine with developer tools, and names stay mangled without it. */
export function demangle(symbols: readonly string[]): readonly string[] {
  if (symbols.length === 0) return [];
  try {
    const out = runSync("c++filt", ["-n"], { input: symbols.join("\n"), maxBuffer: 256 * 1024 * 1024 }).split("\n");
    return symbols.map((s, ix) => out[ix] || s);
  } catch {
    return symbols;
  }
}

function newest(entries: readonly FatEntry[], kind: FatEntry["kind"]): number | null {
  const sms = entries.filter((e) => e.kind === kind).map((e) => e.sm);
  return sms.length > 0 ? Math.max(...sms) : null;
}

async function cudaLibrary(file: FileHandle, span: Span, path: string): Promise<ShaderLibrary | null> {
  const buf = await bytesAt(file, span.offset, span.size);
  const name = `${basename(path)} · CUDA`;
  if (/\.ptx$/i.test(path) && !isFatbin(buf) && !isCubin(buf)) {
    const text = buf.toString("utf8");
    const kernels = ptxKernels(text, 0);
    cudaIndexes.set(name, { span, entries: [{ fatbin: 0, kind: "ptx", sm: 0, start: 0, stored: buf.length, lz4: false }], fatbinOf: new Map(kernels.map((k) => [k.symbol, 0])) });
    return cudaLibraryOf(name, `CUDA · PTX · ${kernels.length} kernels`, kernels, () => []);
  }
  const entries: readonly FatEntry[] = isCubin(buf) ? [{ fatbin: 0, kind: "cubin", sm: 0, start: 0, stored: buf.length, lz4: false }] : fatEntries(buf);
  if (entries.length === 0) return null;
  const fatbins = new Map<number, FatEntry[]>();
  for (const e of entries) fatbins.set(e.fatbin, [...(fatbins.get(e.fatbin) ?? []), e]);
  const best = newest(entries, "cubin");
  const kernels = new Map<string, CudaKernel>();
  for (const [index, list] of fatbins) {
    const cubin = list.find((e) => e.kind === "cubin" && e.sm === best) ?? list.filter((e) => e.kind === "cubin").at(-1);
    const ptx = list.filter((e) => e.kind === "ptx").at(-1);
    try {
      const found = cubin ? cubinKernels(entryBytes(buf, cubin), index) : ptx ? ptxKernels(entryBytes(buf, ptx).toString("utf8"), index) : [];
      for (const k of found) if (!kernels.has(k.symbol)) kernels.set(k.symbol, k);
    } catch {
      continue;
    }
  }
  const list = [...kernels.values()];
  cudaIndexes.set(name, { span, entries, fatbinOf: new Map(list.map((k) => [k.symbol, k.fatbin])) });
  const targetsOf = (k: CudaKernel): readonly number[] => [...new Set((fatbins.get(k.fatbin) ?? []).filter((e) => e.kind === "cubin").map((e) => e.sm))].sort((a, b) => a - b);
  return cudaLibraryOf(name, `CUDA · ${cudaSummary(entries, list.length)}`, list, targetsOf);
}

function cudaLibraryOf(name: string, format: string, kernels: readonly CudaKernel[], targetsOf: (k: CudaKernel) => readonly number[]): ShaderLibrary {
  const names = demangle(kernels.map((k) => k.symbol));
  return { name, format, api: "cuda", functions: kernels.map((k, ix) => cudaFunction(k, names[ix] ?? k.symbol, targetsOf(k))) };
}

function hipLibraryOf(name: string, format: string, kernels: readonly HipKernel[], targets: readonly string[]): ShaderLibrary {
  const names = demangle(kernels.map((k) => k.symbol));
  return { name, format, api: "hip", functions: kernels.map((k, ix) => hipFunction(k, names[ix] ?? k.symbol, targets)) };
}

/** One bundle at `offset`: its code object for `target` (or the first GPU target), and how far the next bundle is. */
async function readBundle(file: FileHandle, offset: number, end: number, target: string | null): Promise<{ readonly length: number; readonly targets: readonly string[]; readonly code: Buffer | null } | null> {
  const head = await bytesAt(file, offset, Math.min(HEAD * 4, end - offset));
  if (isCompressedBundle(head)) {
    const version = head.readUInt16LE(4);
    const total = version >= 3 ? Number(head.readBigUInt64LE(8)) : version === 2 ? head.readUInt32LE(8) : end - offset;
    const { bundle } = unpackBundle(await bytesAt(file, offset, total));
    const entries = bundleEntries(bundle).filter((e) => gfxOf(e.target));
    const pick = entries.find((e) => e.target === target) ?? entries[0];
    return { length: total, targets: entries.map((e) => e.target), code: pick ? bundle.subarray(pick.offset, pick.offset + pick.size) : null };
  }
  if (!head.subarray(0, BUNDLE_MAGIC.length).equals(BUNDLE_MAGIC)) return null;
  const all = bundleEntries(head);
  const entries = all.filter((e) => gfxOf(e.target) && e.size > 0);
  const pick = entries.find((e) => e.target === target) ?? entries[0];
  return { length: bundleLength(all), targets: entries.map((e) => e.target), code: pick ? await bytesAt(file, offset + pick.offset, pick.size) : null };
}

/** The next bundle at or after `from`; bundles are padded apart, so the gap is searched rather than assumed. */
async function nextBundle(file: FileHandle, from: number, end: number): Promise<number> {
  for (let at = from; at < end; at += BUNDLE_SCAN) {
    const chunk = await bytesAt(file, at, Math.min(BUNDLE_SCAN + 32, end - at));
    const plain = chunk.indexOf(BUNDLE_MAGIC);
    const packed = chunk.indexOf(Buffer.from("CCOB"));
    const hits = [plain, packed].filter((ix) => ix >= 0);
    if (hits.length > 0) return at + Math.min(...hits);
  }
  return -1;
}

async function hipLibrary(file: FileHandle, span: Span, path: string): Promise<ShaderLibrary | null> {
  const end = span.offset + span.size;
  const name = `${basename(path)} · HIP`;
  const head = await bytesAt(file, span.offset, Math.min(HEAD, span.size));
  if (isAmdCodeObject(head)) {
    const code = await bytesAt(file, span.offset, span.size);
    const kernels = hipKernels(code);
    return hipLibraryOf(name, `HIP · ${kernels.length} kernels`, kernels, []);
  }
  const kernels = new Map<string, HipKernel>();
  let targets: readonly string[] = [];
  let target: string | null = null;
  let at = await nextBundle(file, span.offset, end);
  while (at >= 0 && at < end) {
    const bundle = await readBundle(file, at, end, target);
    if (!bundle) break;
    if (target === null) {
      targets = bundle.targets;
      target = [...bundle.targets].sort((a, b) => (gfxOf(b) ?? "").localeCompare(gfxOf(a) ?? "", undefined, { numeric: true }))[0] ?? null;
      if (target && target !== bundle.targets[0]) continue;
    }
    if (bundle.code) {
      try {
        for (const k of hipKernels(bundle.code)) if (!kernels.has(k.symbol)) kernels.set(k.symbol, k);
      } catch {
        // A code object Eleven can't parse still leaves the rest of the bundles readable.
      }
    }
    at = await nextBundle(file, at + Math.max(bundle.length, 1), end);
  }
  if (kernels.size === 0 && targets.length === 0) return null;
  const gfx = targets.map((t) => gfxOf(t) ?? t);
  const shown = target ? gfxOf(target) ?? target : "";
  const list = [...kernels.values()];
  return hipLibraryOf(name, `HIP · ${list.length} kernels · read from ${shown} · built for ${gfx.length} GPUs`, list, gfx);
}

/** Every CUDA and HIP kernel in a file: a Linux or Windows library, a standalone fatbin, cubin, PTX or AMD code object. */
export async function readComputeLibraries(path: string): Promise<readonly ShaderLibrary[]> {
  const file = await open(path, "r");
  try {
    const { size } = await file.stat();
    const sections = await gpuSections(file, size, path);
    const cuda = sections.cuda ? await cudaLibrary(file, sections.cuda, path) : null;
    const hip = sections.hip ? await hipLibrary(file, sections.hip, path) : null;
    return [cuda, hip].filter((lib): lib is ShaderLibrary => lib !== null);
  } finally {
    await file.close();
  }
}

/** A CUDA kernel's PTX, read back from its fatbin only when it is opened. */
export async function cudaKernelIr(path: string, library: string, fn: ShaderFunction): Promise<string> {
  const index = cudaIndexes.get(library);
  if (!index) throw new Error(`${library} isn't open.`);
  const fatbin = index.fatbinOf.get(fn.symbol);
  const ptx = index.entries.filter((e) => e.kind === "ptx" && e.fatbin === fatbin).at(-1);
  if (!ptx) return `; ${fn.name}\n; This build ships only machine code (SASS) for this kernel, no PTX. Reading it needs NVIDIA's nvdisasm.`;
  const file = await open(path, "r");
  try {
    const raw = await bytesAt(file, index.span.offset + ptx.start, ptx.stored);
    const text = entryBytes(raw, { ...ptx, start: 0 }).toString("utf8");
    return ptxEntry(text, fn.symbol) ?? `; ${fn.name}\n; Its PTX wasn't found in this build.`;
  } finally {
    await file.close();
  }
}
