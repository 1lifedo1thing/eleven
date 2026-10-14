/** A decoded MessagePack value; AMD GPU code objects keep their kernel metadata in this format. */
export type Pack = null | boolean | number | string | Buffer | readonly Pack[] | { readonly [key: string]: Pack };

class Reader {
  at = 0;
  constructor(private readonly buf: Buffer) {}

  private take(n: number): number {
    const start = this.at;
    this.at += n;
    if (this.at > this.buf.length) throw new Error("The kernel metadata ends early.");
    return start;
  }

  private str(n: number): string {
    const start = this.take(n);
    return this.buf.toString("utf8", start, start + n);
  }

  private bin(n: number): Buffer {
    const start = this.take(n);
    return this.buf.subarray(start, start + n);
  }

  private list(n: number): readonly Pack[] {
    return Array.from({ length: n }, () => this.value());
  }

  private map(n: number): { readonly [key: string]: Pack } {
    const out: Record<string, Pack> = {};
    for (let ix = 0; ix < n; ix++) out[String(this.value())] = this.value();
    return out;
  }

  value(): Pack {
    const byte = this.buf[this.take(1)] ?? 0;
    if (byte <= 0x7f) return byte;
    if (byte >= 0xe0) return byte - 0x100;
    if (byte >= 0x80 && byte <= 0x8f) return this.map(byte & 0x0f);
    if (byte >= 0x90 && byte <= 0x9f) return this.list(byte & 0x0f);
    if (byte >= 0xa0 && byte <= 0xbf) return this.str(byte & 0x1f);
    switch (byte) {
      case 0xc0: return null;
      case 0xc2: return false;
      case 0xc3: return true;
      case 0xc4: return this.bin(this.buf.readUInt8(this.take(1)));
      case 0xc5: return this.bin(this.buf.readUInt16BE(this.take(2)));
      case 0xc6: return this.bin(this.buf.readUInt32BE(this.take(4)));
      case 0xca: return this.buf.readFloatBE(this.take(4));
      case 0xcb: return this.buf.readDoubleBE(this.take(8));
      case 0xcc: return this.buf.readUInt8(this.take(1));
      case 0xcd: return this.buf.readUInt16BE(this.take(2));
      case 0xce: return this.buf.readUInt32BE(this.take(4));
      case 0xcf: return Number(this.buf.readBigUInt64BE(this.take(8)));
      case 0xd0: return this.buf.readInt8(this.take(1));
      case 0xd1: return this.buf.readInt16BE(this.take(2));
      case 0xd2: return this.buf.readInt32BE(this.take(4));
      case 0xd3: return Number(this.buf.readBigInt64BE(this.take(8)));
      case 0xd9: return this.str(this.buf.readUInt8(this.take(1)));
      case 0xda: return this.str(this.buf.readUInt16BE(this.take(2)));
      case 0xdb: return this.str(this.buf.readUInt32BE(this.take(4)));
      case 0xdc: return this.list(this.buf.readUInt16BE(this.take(2)));
      case 0xdd: return this.list(this.buf.readUInt32BE(this.take(4)));
      case 0xde: return this.map(this.buf.readUInt16BE(this.take(2)));
      case 0xdf: return this.map(this.buf.readUInt32BE(this.take(4)));
      default: throw new Error(`Unknown MessagePack byte 0x${byte.toString(16)}.`);
    }
  }
}

export function unpack(buf: Buffer): Pack {
  return new Reader(buf).value();
}

export function isPackMap(value: Pack | undefined): value is { readonly [key: string]: Pack } {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !Buffer.isBuffer(value);
}

export function packList(value: Pack | undefined): readonly Pack[] {
  return Array.isArray(value) ? value : [];
}

export function packText(value: Pack | undefined): string | null {
  return typeof value === "string" ? value : null;
}

export function packNumber(value: Pack | undefined): number | null {
  return typeof value === "number" ? value : null;
}
