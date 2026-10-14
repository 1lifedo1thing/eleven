import { readFile, stat } from "node:fs/promises";

import { binaryInfoOf, readBinaryInfo } from "./binaryInfo";

export type SwiftTypeKind = "class" | "struct" | "enum";

/** A type from the binary's Swift metadata, which survives stripping: its name, and the code the metadata points at. */
export type SwiftType = {
  readonly kind: SwiftTypeKind;
  readonly module: string;
  /** Nested types are dotted: `Outer.Inner`. */
  readonly name: string;
  readonly accessor: string | null;
  /** Method implementations from a class's vtable and override table. */
  readonly methods: readonly string[];
};

type Segment = { readonly vm: bigint; readonly size: bigint; readonly offset: number; readonly fileSize: number };
type Section = { readonly addr: bigint; readonly size: number };

const MH_MAGIC_64 = 0xfeedfacf;
const LC_SEGMENT_64 = 0x19;
const KINDS: Readonly<Record<number, SwiftTypeKind>> = { 16: "class", 17: "struct", 18: "enum" };
const MODULE = 0;
const GENERIC = 0x80;
const HAS_VTABLE = 0x8000;
const HAS_OVERRIDES = 0x4000;
const RESILIENT_SUPER = 0x2000;
const CLASS_HEADER = 44n;
const MAX_DEPTH = 16;

class Image {
  private readonly segments: Segment[] = [];
  types: Section | null = null;

  constructor(private readonly buf: Buffer, private readonly base: number) {
    if (buf.readUInt32LE(base) !== MH_MAGIC_64) return;
    const count = buf.readUInt32LE(base + 16);
    let at = base + 32;
    for (let ix = 0; ix < count && at + 8 <= buf.length; ix++) {
      if (buf.readUInt32LE(at) === LC_SEGMENT_64) this.segment(at);
      at += buf.readUInt32LE(at + 4);
    }
  }

  private segment(at: number): void {
    const b = this.buf;
    this.segments.push({ vm: b.readBigUInt64LE(at + 24), size: b.readBigUInt64LE(at + 32), offset: this.base + Number(b.readBigUInt64LE(at + 40)), fileSize: Number(b.readBigUInt64LE(at + 48)) });
    const sections = b.readUInt32LE(at + 64);
    for (let ix = 0; ix < sections; ix++) {
      const s = at + 72 + ix * 80;
      if (b.toString("latin1", s, s + 16).replace(/\0.*$/s, "") === "__swift5_types") this.types = { addr: b.readBigUInt64LE(s + 32), size: Number(b.readBigUInt64LE(s + 40)) };
    }
  }

  offset(addr: bigint): number {
    for (const seg of this.segments) {
      if (addr < seg.vm || addr >= seg.vm + seg.size) continue;
      const at = seg.offset + Number(addr - seg.vm);
      if (at + 4 > seg.offset + seg.fileSize || at + 4 > this.buf.length) throw new Error("Pointer outside the file.");
      return at;
    }
    throw new Error("Pointer outside every segment.");
  }

  u32(addr: bigint): number {
    return this.buf.readUInt32LE(this.offset(addr));
  }

  i32(addr: bigint): number {
    return this.buf.readInt32LE(this.offset(addr));
  }

  /** A relative pointer: the address it names, or null when it's empty. */
  relative(addr: bigint): bigint | null {
    const delta = this.i32(addr);
    return delta === 0 ? null : addr + BigInt(delta);
  }

  text(addr: bigint): string {
    const at = this.offset(addr);
    const end = this.buf.indexOf(0, at);
    return this.buf.toString("utf8", at, end < 0 ? at : end);
  }

  /** A descriptor's parent; indirect parents live in another image, so the walk stops there. */
  parent(addr: bigint): bigint | null {
    const delta = this.i32(addr + 4n);
    return delta === 0 || (delta & 1) !== 0 ? null : addr + 4n + BigInt(delta);
  }
}

function hex(addr: bigint): string {
  return `0x${addr.toString(16)}`;
}

function naming(image: Image, descriptor: bigint): { readonly module: string; readonly name: string } {
  const names: string[] = [];
  let module = "";
  let at: bigint | null = descriptor;
  for (let depth = 0; at !== null && depth < MAX_DEPTH; depth++) {
    const kind = image.u32(at) & 0x1f;
    const nameAt = kind === MODULE || KINDS[kind] ? image.relative(at + 8n) : null;
    if (kind === MODULE) {
      module = nameAt ? image.text(nameAt) : "";
      break;
    }
    if (nameAt) names.unshift(image.text(nameAt));
    at = image.parent(at);
  }
  return { module, name: names.join(".") };
}

function implementations(image: Image, at: bigint, count: number, stride: bigint, field: bigint): readonly string[] {
  const found: string[] = [];
  for (let ix = 0; ix < count; ix++) {
    const impl = image.relative(at + BigInt(ix) * stride + field);
    if (impl) found.push(hex(impl));
  }
  return found;
}

/** A non-generic class's methods: its vtable, then the superclass methods it overrides. */
function classMethods(image: Image, descriptor: bigint, flags: number): readonly string[] {
  const specific = flags >>> 16;
  if ((flags & GENERIC) !== 0) return [];
  let at = descriptor + CLASS_HEADER;
  if (specific & RESILIENT_SUPER) at += 4n;
  const init = specific & 0x3;
  if (init === 1) at += 12n;
  else if (init === 2) at += 4n;
  const methods: string[] = [];
  if (specific & HAS_VTABLE) {
    const count = image.u32(at + 4n);
    methods.push(...implementations(image, at + 8n, count, 8n, 4n));
    at += 8n + BigInt(count) * 8n;
  }
  if (specific & HAS_OVERRIDES) methods.push(...implementations(image, at + 4n, image.u32(at), 12n, 8n));
  return methods;
}

function readType(image: Image, entry: bigint): SwiftType | null {
  const raw = image.i32(entry);
  if ((raw & 3) !== 0) return null;
  const descriptor = entry + BigInt(raw);
  const flags = image.u32(descriptor);
  const kind = KINDS[flags & 0x1f];
  if (!kind) return null;
  const { module, name } = naming(image, descriptor);
  const accessor = image.relative(descriptor + 12n);
  return { kind, module, name, accessor: accessor ? hex(accessor) : null, methods: kind === "class" ? classMethods(image, descriptor, flags) : [] };
}

/** The Swift types a Mach-O defines, read straight from `__swift5_types`; empty for anything else. */
export function readSwiftTypes(buf: Buffer, arch: string): readonly SwiftType[] {
  const info = readBinaryInfo(buf.subarray(0, 4096), buf.length);
  if (info.format !== "Mach-O") return [];
  const slice = info.slices.find((candidate) => candidate.arch === arch) ?? info.slices[0];
  const image = new Image(buf, slice?.offset ?? 0);
  const section = image.types;
  if (!section) return [];
  const types: SwiftType[] = [];
  for (let at = 0; at < section.size; at += 4) {
    try {
      const type = readType(image, section.addr + BigInt(at));
      if (type?.name) types.push(type);
    } catch {
      continue;
    }
  }
  return types;
}

const loaded = new Map<string, Promise<readonly SwiftType[]>>();

export function swiftTypes(path: string, arch: string): Promise<readonly SwiftType[]> {
  const key = `${path}:${arch}`;
  const pending = loaded.get(key) ?? (async () => {
    if (binaryInfoOf(path, (await stat(path)).size).format !== "Mach-O") return [];
    return readSwiftTypes(await readFile(path), arch);
  })();
  loaded.set(key, pending);
  return pending;
}
