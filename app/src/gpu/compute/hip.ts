import { inflateSync } from "node:zlib";

import type { Binding, ShaderFunction } from "../types";
import { signatureParams } from "./cuda";
import { EM_AMDGPU, isElf, notes, readElf } from "./elf";
import { isPackMap, packList, packNumber, packText, type Pack, unpack } from "./msgpack";

export const BUNDLE_MAGIC = Buffer.from("__CLANG_OFFLOAD_BUNDLE__");
const COMPRESSED_MAGIC = Buffer.from("CCOB");
const NT_AMDGPU_METADATA = 32;
const ZLIB = 1;

export type BundleEntry = { readonly target: string; readonly offset: number; readonly size: number };

export type HipKernel = { readonly symbol: string; readonly meta: { readonly [key: string]: Pack } };

/** The code objects in one offload bundle: one per GPU target, plus an empty host entry. */
export function bundleEntries(buf: Buffer): readonly BundleEntry[] {
  if (!buf.subarray(0, BUNDLE_MAGIC.length).equals(BUNDLE_MAGIC)) return [];
  const count = Number(buf.readBigUInt64LE(24));
  const out: BundleEntry[] = [];
  let at = 32;
  for (let ix = 0; ix < count; ix++) {
    const offset = Number(buf.readBigUInt64LE(at));
    const size = Number(buf.readBigUInt64LE(at + 8));
    const length = Number(buf.readBigUInt64LE(at + 16));
    out.push({ target: buf.toString("latin1", at + 24, at + 24 + length), offset, size });
    at += 24 + length;
  }
  return out;
}

/** How many bytes the bundle at the start of `buf` takes, so the next one can be found. */
export function bundleLength(entries: readonly BundleEntry[]): number {
  return entries.reduce((end, e) => Math.max(end, e.offset + e.size), 0);
}

export function isCompressedBundle(buf: Buffer): boolean {
  return buf.subarray(0, 4).equals(COMPRESSED_MAGIC);
}

/** A compressed bundle's stored length and its contents unpacked; versions 1 to 3 differ only in header widths. */
export function unpackBundle(buf: Buffer): { readonly length: number; readonly bundle: Buffer } {
  const version = buf.readUInt16LE(4);
  const method = buf.readUInt16LE(6);
  const header = version >= 3 ? 32 : version === 2 ? 24 : 20;
  const total = version >= 3 ? Number(buf.readBigUInt64LE(8)) : version === 2 ? buf.readUInt32LE(8) : buf.length;
  const data = buf.subarray(header, total);
  const bundle = method === ZLIB ? inflateSync(data) : Buffer.from(Bun.zstdDecompressSync(data));
  return { length: total, bundle };
}

/** The GPU name in a target triple like hipv4-amdgcn-amd-amdhsa--gfx1030:xnack-. */
export function gfxOf(target: string): string | null {
  return /(gfx[0-9a-f]+)/.exec(target)?.[1] ?? null;
}

export function isAmdCodeObject(buf: Buffer): boolean {
  return isElf(buf) && buf.readUInt16LE(18) === EM_AMDGPU;
}

/** Each kernel in a code object, with the metadata the AMD loader reads: arguments, registers, local memory. */
export function hipKernels(code: Buffer): readonly HipKernel[] {
  const elf = readElf(code);
  if (elf.machine !== EM_AMDGPU) return [];
  const note = notes(elf).find((n) => n.name === "AMDGPU" && n.type === NT_AMDGPU_METADATA);
  if (!note) return [];
  const meta = unpack(note.desc);
  if (!isPackMap(meta)) return [];
  return packList(meta["amdhsa.kernels"]).flatMap((k) => {
    if (!isPackMap(k)) return [];
    const symbol = packText(k[".name"]) ?? packText(k[".symbol"])?.replace(/\.kd$/, "");
    return symbol ? [{ symbol, meta: k }] : [];
  });
}

/** Arguments the runtime adds itself, like the grid size, rather than the ones the kernel was written with. */
function isHidden(arg: Pack): boolean {
  return isPackMap(arg) && (packText(arg[".value_kind"]) ?? "").startsWith("hidden_");
}

function argBinding(arg: Pack, ix: number, declared: string | undefined): Binding {
  if (!isPackMap(arg)) return { slot: `arg ${ix}`, type: declared ?? "" };
  const kind = (packText(arg[".value_kind"]) ?? "").replace(/_/g, " ");
  const size = packNumber(arg[".size"]);
  const type = declared ?? packText(arg[".type_name"]) ?? kind;
  return { slot: packText(arg[".name"]) ?? `arg ${ix}`, type: [type, size !== null ? `${size} bytes` : ""].filter(Boolean).join(", ") };
}

function count(meta: { readonly [key: string]: Pack }, key: string): number | null {
  return packNumber(meta[key]);
}

/** The kernel's metadata as readable lines, in place of instructions, which need ROCm's tools to disassemble. */
export function metadataText(kernel: HipKernel): string {
  const lines = Object.entries(kernel.meta).flatMap(([key, value]) => {
    if (key === ".args") {
      return [".args:", ...packList(value).map((arg, ix) => {
        const shown = argBinding(arg, ix, undefined);
        return `  - ${shown.slot}: ${shown.type}`;
      })];
    }
    return isPackMap(value) || Array.isArray(value) ? [`${key}: ${JSON.stringify(value)}`] : [`${key}: ${String(value)}`];
  });
  return [`; ${kernel.symbol}`, "; Kernel metadata from the code object. The instructions need ROCm's llvm-objdump to read.", ...lines].join("\n");
}

export function hipFunction(kernel: HipKernel, name: string, targets: readonly string[]): ShaderFunction {
  const m = kernel.meta;
  const lds = count(m, ".group_segment_fixed_size");
  const scratch = count(m, ".private_segment_fixed_size");
  const stats: Binding[] = [
    ...(count(m, ".vgpr_count") !== null ? [{ slot: "Vector registers", type: `${count(m, ".vgpr_count")} per thread` }] : []),
    ...(count(m, ".sgpr_count") !== null ? [{ slot: "Scalar registers", type: `${count(m, ".sgpr_count")} per wave` }] : []),
    ...(lds ? [{ slot: "Local memory (LDS)", type: `${lds.toLocaleString("en-US")} bytes` }] : []),
    ...(scratch ? [{ slot: "Scratch", type: `${scratch.toLocaleString("en-US")} bytes per thread` }] : []),
    ...(count(m, ".wavefront_size") !== null ? [{ slot: "Wavefront", type: `${count(m, ".wavefront_size")} lanes` }] : []),
    ...(count(m, ".max_flat_workgroup_size") !== null ? [{ slot: "Largest workgroup", type: `${count(m, ".max_flat_workgroup_size")} threads` }] : []),
    ...(targets.length > 0 ? [{ slot: "Built for", type: targets.join(", ") }] : []),
  ];
  const declared = signatureParams(name);
  const bindings = packList(m[".args"]).filter((arg) => !isHidden(arg)).map((arg, ix) => argBinding(arg, ix, declared[ix]));
  return { name, symbol: kernel.symbol, kind: "compute", ir: metadataText(kernel), bindings, stats, loadedBy: null };
}
