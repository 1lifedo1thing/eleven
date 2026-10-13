/** Frames a DAP message the way lldb-dap reads it: a Content-Length header, then the JSON body. */
export function frame(message: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "ascii"), body]);
}

/** Reassembles DAP messages from a byte stream that may split or coalesce them. Feed it chunks; it returns whole messages. */
export class Decoder {
  private buffer = Buffer.alloc(0);

  push(chunk: Buffer): readonly unknown[] {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const out: unknown[] = [];
    for (;;) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) break;
      const header = this.buffer.subarray(0, headerEnd).toString("ascii");
      const match = /Content-Length:\s*(\d+)/i.exec(header);
      const start = headerEnd + 4;
      if (!match) {
        this.buffer = this.buffer.subarray(start);
        continue;
      }
      const length = Number(match[1]);
      if (this.buffer.length < start + length) break;
      const body = this.buffer.subarray(start, start + length).toString("utf8");
      this.buffer = this.buffer.subarray(start + length);
      try {
        out.push(JSON.parse(body));
      } catch {
        continue;
      }
    }
    return out;
  }
}
