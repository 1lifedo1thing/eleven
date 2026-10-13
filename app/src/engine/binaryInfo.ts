import { closeSync, openSync, readSync } from "node:fs";

/** What a file's header says it is: the format, and each architecture inside with where its bytes sit. */
export type BinaryInfo = {
  readonly format: "Mach-O" | "ELF" | "PE" | "File";
  readonly slices: readonly Slice[];
};

export type Slice = { readonly arch: string; readonly offset: number; readonly size: number };

const MACH_CPU: Readonly<Record<number, string>> = {
  0x7: "i386",
  0x01000007: "x86_64",
  0xc: "arm",
  0x0100000c: "arm64",
  0x0200000c: "arm64_32",
  0x12: "ppc",
  0x01000012: "ppc64",
};

const CPU_SUBTYPE_ARM64E = 2;

const ELF_MACHINE: Readonly<Record<number, string>> = { 3: "i386", 8: "mips", 20: "ppc", 21: "ppc64", 40: "arm", 62: "x86_64", 183: "arm64", 243: "riscv" };

const PE_MACHINE: Readonly<Record<number, string>> = { 0x14c: "i386", 0x8664: "x86_64", 0xaa64: "arm64", 0x1c0: "arm", 0x1c4: "arm" };

/** Java class files share the fat magic; a real universal binary lists only a handful of slices. */
const MAX_FAT_SLICES = 32;

function machArch(cpu: number, subtype: number): string {
  const name = MACH_CPU[cpu] ?? "";
  return name === "arm64" && (subtype & 0xff) === CPU_SUBTYPE_ARM64E ? "arm64e" : name;
}

function fatSlices(head: Buffer, wide: boolean): readonly Slice[] | null {
  const count = head.readUInt32BE(4);
  if (count === 0 || count > MAX_FAT_SLICES) return null;
  const step = wide ? 32 : 20;
  const slices: Slice[] = [];
  for (let ix = 0; ix < count; ix++) {
    const at = 8 + ix * step;
    if (at + step > head.length) return null;
    const cpu = head.readUInt32BE(at);
    const subtype = head.readUInt32BE(at + 4);
    const offset = wide ? Number(head.readBigUInt64BE(at + 8)) : head.readUInt32BE(at + 8);
    const size = wide ? Number(head.readBigUInt64BE(at + 16)) : head.readUInt32BE(at + 12);
    slices.push({ arch: machArch(cpu, subtype), offset, size });
  }
  return slices;
}

/** Reads a binary's format and architectures from its header alone, the same on every OS. */
export function readBinaryInfo(head: Buffer, fileSize: number): BinaryInfo {
  const none: BinaryInfo = { format: "File", slices: [] };
  if (head.length < 8) return none;
  const be = head.readUInt32BE(0);
  if (be === 0xcafebabe || be === 0xcafebabf) {
    const slices = fatSlices(head, be === 0xcafebabf);
    return slices ? { format: "Mach-O", slices } : none;
  }
  if (be === 0xfeedface || be === 0xfeedfacf) return { format: "Mach-O", slices: [{ arch: machArch(head.readUInt32BE(4), head.readUInt32BE(8)), offset: 0, size: fileSize }] };
  if (be === 0xcefaedfe || be === 0xcffaedfe) return { format: "Mach-O", slices: [{ arch: machArch(head.readUInt32LE(4), head.readUInt32LE(8)), offset: 0, size: fileSize }] };
  if (be === 0x7f454c46 && head.length >= 20) {
    const machine = head[5] === 2 ? head.readUInt16BE(18) : head.readUInt16LE(18);
    return { format: "ELF", slices: [{ arch: ELF_MACHINE[machine] ?? "", offset: 0, size: fileSize }] };
  }
  if (head[0] === 0x4d && head[1] === 0x5a && head.length >= 0x40) {
    const pe = head.readUInt32LE(0x3c);
    if (pe + 6 <= head.length && head.readUInt32BE(pe) === 0x50450000) return { format: "PE", slices: [{ arch: PE_MACHINE[head.readUInt16LE(pe + 4)] ?? "", offset: 0, size: fileSize }] };
  }
  return none;
}

const HEAD_BYTES = 4096;

export function binaryInfoOf(path: string, fileSize: number): BinaryInfo {
  const head = Buffer.alloc(HEAD_BYTES);
  const fd = openSync(path, "r");
  try {
    return readBinaryInfo(head.subarray(0, readSync(fd, head, 0, HEAD_BYTES, 0)), fileSize);
  } finally {
    closeSync(fd);
  }
}
