import type { Binding, ShaderFunction } from "../types";
import { EM_CUDA, isElf, readElf, symbols } from "./elf";

const FATBIN = 0xba55ed50;
const PTX = 1;
const CUBIN = 2;
/** Fatbins are padded apart with zeros; each starts on an 8-byte boundary. */
const FATBIN_ALIGN = 8;
const ZSTD = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
const LZ4_FLAG = 0x2000n;
/** CUDA marks a kernel's symbol with this st_other bit; device functions it calls don't have it. */
const STO_CUDA_ENTRY = 0x10;
const EIATTR_REGCOUNT = 0x2f;
const EIATTR_PARAM_CBANK = 0x0a;
const EIFMT_SVAL = 0x04;

export type FatEntry = { readonly fatbin: number; readonly kind: "ptx" | "cubin"; readonly sm: number; readonly start: number; readonly stored: number; readonly lz4: boolean };

export type CudaKernel = {
  readonly symbol: string;
  readonly fatbin: number;
  readonly registers: number | null;
  readonly codeBytes: number;
  readonly paramBytes: number | null;
  readonly sharedBytes: number;
};

/** Every fatbin in a section or file, and each PTX or cubin build inside it. */
export function fatEntries(buf: Buffer): readonly FatEntry[] {
  const out: FatEntry[] = [];
  let at = 0;
  let index = 0;
  while (at + 16 <= buf.length) {
    if (buf.readUInt32LE(at) !== FATBIN) {
      at = (Math.floor(at / FATBIN_ALIGN) + 1) * FATBIN_ALIGN;
      continue;
    }
    const head = buf.readUInt16LE(at + 6);
    const size = Number(buf.readBigUInt64LE(at + 8));
    let entry = at + head;
    while (entry + 64 <= at + head + size) {
      const kind = buf.readUInt16LE(entry);
      const entryHead = buf.readUInt32LE(entry + 4);
      const padded = Number(buf.readBigUInt64LE(entry + 8));
      const stored = buf.readUInt32LE(entry + 16);
      const flags = buf.readBigUInt64LE(entry + 40);
      if (kind === PTX || kind === CUBIN) out.push({ fatbin: index, kind: kind === PTX ? "ptx" : "cubin", sm: buf.readUInt32LE(entry + 28), start: entry + entryHead, stored: stored || padded, lz4: (flags & LZ4_FLAG) !== 0n });
      entry += entryHead + padded;
    }
    index++;
    at += head + size;
  }
  return out;
}

/** An entry's bytes, unpacked when the toolkit compressed them. */
export function entryBytes(buf: Buffer, entry: FatEntry): Buffer {
  const raw = buf.subarray(entry.start, entry.start + entry.stored);
  if (raw.subarray(0, 4).equals(ZSTD)) return Buffer.from(Bun.zstdDecompressSync(raw));
  if (entry.lz4) throw new Error("This was built with an older CUDA toolkit whose compression Eleven can't unpack yet.");
  return raw;
}

function sval(info: Buffer, attr: number): readonly Buffer[] {
  const out: Buffer[] = [];
  let at = 0;
  while (at + 2 <= info.length) {
    const format = info[at] ?? 0;
    const id = info[at + 1] ?? 0;
    if (format === EIFMT_SVAL) {
      const size = info.readUInt16LE(at + 2);
      if (id === attr) out.push(info.subarray(at + 4, at + 4 + size));
      at += 4 + size;
    } else {
      at += 4;
    }
  }
  return out;
}

/** The kernels in one cubin: their registers, code size, parameter block and static shared memory. */
export function cubinKernels(cubin: Buffer, fatbin: number): readonly CudaKernel[] {
  const elf = readElf(cubin);
  if (elf.machine !== EM_CUDA) return [];
  const syms = symbols(elf);
  const section = (name: string): { readonly offset: number; readonly size: number } | undefined => elf.sections.find((s) => s.name === name);
  const global = section(".nv.info");
  const registers = new Map<number, number>();
  if (global) {
    for (const v of sval(cubin.subarray(global.offset, global.offset + global.size), EIATTR_REGCOUNT)) registers.set(v.readUInt32LE(0), v.readUInt32LE(4));
  }
  return syms.flatMap((sym, ix) => {
    if (sym.type !== 2 || (sym.other & STO_CUDA_ENTRY) === 0) return [];
    const info = section(`.nv.info.${sym.name}`);
    const bank = info ? sval(cubin.subarray(info.offset, info.offset + info.size), EIATTR_PARAM_CBANK)[0] : undefined;
    return [{
      symbol: sym.name,
      fatbin,
      registers: registers.get(ix) ?? null,
      codeBytes: sym.size,
      paramBytes: bank && bank.length >= 8 ? bank.readUInt16LE(6) : null,
      sharedBytes: section(`.nv.shared.${sym.name}`)?.size ?? 0,
    }];
  });
}

/** One kernel's `.entry` block from a PTX file, through its closing brace. */
export function ptxEntry(ptx: string, symbol: string): string | null {
  const start = ptx.search(new RegExp(`\\.entry\\s+${symbol.replace(/[.*+?^${}()|[\]\\$]/g, "\\$&")}\\s*\\(`));
  if (start < 0) return null;
  const lineStart = ptx.lastIndexOf("\n", start) + 1;
  const end = ptx.indexOf("\n}", start);
  return ptx.slice(lineStart, end < 0 ? undefined : end + 2);
}

/** Kernels named in PTX text, for a build that ships no cubin. */
export function ptxKernels(ptx: string, fatbin: number): readonly CudaKernel[] {
  return [...ptx.matchAll(/\.entry\s+([\w$.]+)\s*\(/g)].flatMap((m) => (m[1] ? [{ symbol: m[1], fatbin, registers: null, codeBytes: 0, paramBytes: null, sharedBytes: 0 }] : []));
}

function plural(n: number, word: string): string {
  return `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;
}

/** The parameter types from a demangled signature, split at top-level commas. */
export function signatureParams(demangled: string): readonly string[] {
  const open = demangled.indexOf("(");
  const close = demangled.lastIndexOf(")");
  if (open < 0 || close <= open) return [];
  const inner = demangled.slice(open + 1, close);
  const out: string[] = [];
  let depth = 0;
  let from = 0;
  for (let ix = 0; ix < inner.length; ix++) {
    const c = inner[ix];
    if (c === "<" || c === "(") depth++;
    else if (c === ">" || c === ")") depth--;
    else if (c === "," && depth === 0) {
      out.push(inner.slice(from, ix).trim());
      from = ix + 1;
    }
  }
  const last = inner.slice(from).trim();
  return last && last !== "void" ? [...out, last] : out;
}

export function cudaFunction(kernel: CudaKernel, name: string, targets: readonly number[]): ShaderFunction {
  const params: readonly Binding[] = signatureParams(name).map((type, ix) => ({ slot: `param ${ix}`, type }));
  const stats: Binding[] = [
    ...(kernel.registers !== null ? [{ slot: "Registers", type: `${kernel.registers} per thread` }] : []),
    ...(kernel.sharedBytes > 0 ? [{ slot: "Shared memory", type: `${kernel.sharedBytes.toLocaleString("en-US")} bytes` }] : []),
    ...(kernel.codeBytes > 0 ? [{ slot: "Code size", type: `${kernel.codeBytes.toLocaleString("en-US")} bytes` }] : []),
    ...(kernel.paramBytes !== null ? [{ slot: "Parameter block", type: `${kernel.paramBytes} bytes` }] : []),
    ...(targets.length > 0 ? [{ slot: "Built for", type: targets.map((sm) => `sm_${sm}`).join(", ") }] : []),
  ];
  return { name, symbol: kernel.symbol, kind: "compute", ir: "", bindings: params, stats, loadedBy: null };
}

export function cudaSummary(entries: readonly FatEntry[], kernels: number): string {
  const cubins = [...new Set(entries.filter((e) => e.kind === "cubin").map((e) => e.sm))].sort((a, b) => a - b);
  const ptx = [...new Set(entries.filter((e) => e.kind === "ptx").map((e) => e.sm))].sort((a, b) => a - b);
  const parts = [
    plural(kernels, "kernel"),
    cubins.length > 0 ? `machine code for ${cubins.map((sm) => `sm_${sm}`).join(", ")}` : "",
    ptx.length > 0 ? `PTX for ${ptx.map((sm) => `sm_${sm}`).join(", ")}` : "",
  ];
  return parts.filter(Boolean).join(" · ");
}

export function isCubin(buf: Buffer): boolean {
  return isElf(buf) && buf.readUInt16LE(18) === EM_CUDA;
}

export function isFatbin(buf: Buffer): boolean {
  return buf.length >= 4 && buf.readUInt32LE(0) === FATBIN;
}
