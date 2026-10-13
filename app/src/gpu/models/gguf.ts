import { stat } from "node:fs/promises";
import { basename } from "node:path";

import type { ModelInfo, ModelLayer, ModelRisk } from "../types";
import { bytes, head } from "./read";

const HEADER_LIMIT = 64 * 1024 * 1024;
const MAX_LAYERS = 200;
const GGML_TYPES: Readonly<Record<number, string>> = {
  0: "F32", 1: "F16", 2: "Q4_0", 3: "Q4_1", 6: "Q5_0", 7: "Q5_1", 8: "Q8_0", 9: "Q8_1", 10: "Q2_K", 11: "Q3_K", 12: "Q4_K",
  13: "Q5_K", 14: "Q6_K", 15: "Q8_K", 16: "IQ2_XXS", 17: "IQ2_XS", 18: "IQ3_XXS", 19: "IQ1_S", 20: "IQ4_NL", 21: "IQ3_S",
  22: "IQ2_S", 23: "IQ4_XS", 24: "I8", 25: "I16", 26: "I32", 27: "I64", 28: "F64", 29: "IQ1_M", 30: "BF16",
};

type Value = string | number | bigint | boolean | readonly Value[];

class Cursor {
  constructor(private readonly buf: Buffer, private at = 0) {}
  u32(): number { const v = this.buf.readUInt32LE(this.at); this.at += 4; return v; }
  u64(): bigint { const v = this.buf.readBigUInt64LE(this.at); this.at += 8; return v; }
  str(): string { const n = Number(this.u64()); const v = this.buf.toString("utf8", this.at, this.at + n); this.at += n; return v; }
  value(type: number): Value {
    switch (type) {
      case 0: return this.buf.readUInt8(this.at++);
      case 1: return this.buf.readInt8(this.at++);
      case 2: { const v = this.buf.readUInt16LE(this.at); this.at += 2; return v; }
      case 3: { const v = this.buf.readInt16LE(this.at); this.at += 2; return v; }
      case 4: return this.u32();
      case 5: { const v = this.buf.readInt32LE(this.at); this.at += 4; return v; }
      case 6: { const v = this.buf.readFloatLE(this.at); this.at += 4; return v; }
      case 7: return this.buf.readUInt8(this.at++) !== 0;
      case 8: return this.str();
      case 9: { const inner = this.u32(); const n = Number(this.u64()); return Array.from({ length: n }, () => this.value(inner)); }
      case 10: return this.u64();
      case 11: { const v = this.buf.readBigInt64LE(this.at); this.at += 8; return v; }
      case 12: { const v = this.buf.readDoubleLE(this.at); this.at += 8; return v; }
      default: throw new Error(`GGUF value type ${type} isn't known.`);
    }
  }
}

function text(meta: ReadonlyMap<string, Value>, key: string): string | null {
  const value = meta.get(key);
  return typeof value === "string" || typeof value === "number" || typeof value === "bigint" ? String(value) : null;
}

/** GGUF header: architecture, quantization, tokenizer and any baked-in chat template or system prompt. */
export async function readGguf(path: string): Promise<ModelInfo> {
  const buffer = await head(path, HEADER_LIMIT);
  if (buffer.toString("ascii", 0, 4) !== "GGUF") throw new Error("This isn't a GGUF file.");
  const cursor = new Cursor(buffer, 4);
  const version = cursor.u32();
  const tensorCount = Number(cursor.u64());
  const kvCount = Number(cursor.u64());
  const meta = new Map<string, Value>();
  for (let ix = 0; ix < kvCount; ix++) {
    const key = cursor.str();
    meta.set(key, cursor.value(cursor.u32()));
  }
  const layers: ModelLayer[] = [];
  const types = new Map<string, number>();
  for (let ix = 0; ix < tensorCount; ix++) {
    const name = cursor.str();
    const dims = Array.from({ length: cursor.u32() }, () => cursor.u64());
    const type = GGML_TYPES[cursor.u32()] ?? "unknown";
    cursor.u64();
    types.set(type, (types.get(type) ?? 0) + 1);
    if (layers.length < MAX_LAYERS) layers.push({ name, op: "weights", shape: dims.join(" × "), type });
  }
  const quant = [...types].sort((a, b) => b[1] - a[1]).map(([type]) => type).slice(0, 2).join(" + ");
  const template = text(meta, "tokenizer.chat_template");
  const risk: ModelRisk | null = template ? { title: "Ships a chat template", detail: `It shapes every prompt, and may carry a hidden system prompt: ${template.slice(0, 280)}${template.length > 280 ? "…" : ""}` } : null;
  const arch = text(meta, "general.architecture") ?? "unknown";
  const context = text(meta, `${arch}.context_length`);
  return {
    name: text(meta, "general.name") ?? basename(path),
    format: `GGUF v${version} · ${arch}${context ? ` · ${context} context` : ""} · ${text(meta, "tokenizer.ggml.model") ?? "no"} tokenizer`,
    weights: `${quant} · ${tensorCount} tensors · ${bytes((await stat(path)).size)}`,
    inputs: [],
    outputs: [],
    layers,
    risk,
  };
}
