/** Just enough of a 64-bit little-endian ELF file to find sections, symbols and notes: what GPU code objects use. */
export type ElfSection = { readonly name: string; readonly type: number; readonly offset: number; readonly size: number; readonly link: number };

export type ElfSymbol = { readonly name: string; readonly type: number; readonly other: number; readonly section: number; readonly size: number };

export type ElfNote = { readonly name: string; readonly type: number; readonly desc: Buffer };

export type Elf = { readonly machine: number; readonly flags: number; readonly sections: readonly ElfSection[]; readonly buf: Buffer };

const SYMTAB = 2;
const NOTE = 7;

/** ELF machine numbers for GPU code. */
export const EM_CUDA = 190;
export const EM_AMDGPU = 224;

export function isElf(buf: Buffer): boolean {
  return buf.length >= 64 && buf.readUInt32BE(0) === 0x7f454c46 && buf[4] === 2 && buf[5] === 1;
}

function cString(buf: Buffer, at: number): string {
  const end = buf.indexOf(0, at);
  return buf.toString("latin1", at, end < 0 ? buf.length : end);
}

export function readElf(buf: Buffer): Elf {
  if (!isElf(buf)) throw new Error("This isn't a 64-bit ELF file.");
  const shoff = Number(buf.readBigUInt64LE(0x28));
  const entsize = buf.readUInt16LE(0x3a);
  const count = buf.readUInt16LE(0x3c);
  const names = buf.readUInt16LE(0x3e);
  const raw = Array.from({ length: count }, (_, ix) => {
    const at = shoff + ix * entsize;
    return { nameAt: buf.readUInt32LE(at), type: buf.readUInt32LE(at + 4), offset: Number(buf.readBigUInt64LE(at + 0x18)), size: Number(buf.readBigUInt64LE(at + 0x20)), link: buf.readUInt32LE(at + 0x28) };
  });
  const table = raw[names]?.offset ?? 0;
  return {
    machine: buf.readUInt16LE(18),
    flags: buf.readUInt32LE(48),
    sections: raw.map((s) => ({ name: cString(buf, table + s.nameAt), type: s.type, offset: s.offset, size: s.size, link: s.link })),
    buf,
  };
}

export function symbols(elf: Elf): readonly ElfSymbol[] {
  const table = elf.sections.find((s) => s.type === SYMTAB);
  const strings = table ? elf.sections[table.link] : undefined;
  if (!table || !strings) return [];
  return Array.from({ length: Math.floor(table.size / 24) }, (_, ix) => {
    const at = table.offset + ix * 24;
    const info = elf.buf[at + 4] ?? 0;
    return { name: cString(elf.buf, strings.offset + elf.buf.readUInt32LE(at)), type: info & 0xf, other: elf.buf[at + 5] ?? 0, section: elf.buf.readUInt16LE(at + 6), size: Number(elf.buf.readBigUInt64LE(at + 16)) };
  });
}

export function notes(elf: Elf): readonly ElfNote[] {
  return elf.sections.filter((s) => s.type === NOTE).flatMap((s) => {
    const out: ElfNote[] = [];
    let at = s.offset;
    const end = s.offset + s.size;
    while (at + 12 <= end) {
      const nameSize = elf.buf.readUInt32LE(at);
      const descSize = elf.buf.readUInt32LE(at + 4);
      const type = elf.buf.readUInt32LE(at + 8);
      const nameAt = at + 12;
      const descAt = nameAt + Math.ceil(nameSize / 4) * 4;
      out.push({ name: elf.buf.toString("latin1", nameAt, nameAt + Math.max(0, nameSize - 1)), type, desc: elf.buf.subarray(descAt, descAt + descSize) });
      at = descAt + Math.ceil(descSize / 4) * 4;
    }
    return out;
  });
}
