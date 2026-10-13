import { stat } from "node:fs/promises";
import { basename } from "node:path";

import { isRecord } from "../../lib/guards";
import type { MetaEntry, ModelInfo, ModelTensor } from "../types";
import { bytes, count, head, mixOf, mixSummary } from "./read";

const MAX_HEADER = 100 * 1024 * 1024;

function numbers(value: unknown): readonly number[] {
  return Array.isArray(value) ? value.filter((n): n is number => typeof n === "number") : [];
}

export async function readSafetensors(path: string): Promise<ModelInfo> {
  const start = await head(path, 8);
  const length = Number(start.readBigUInt64LE(0));
  if (length <= 0 || length > MAX_HEADER) throw new Error("This doesn't look like a safetensors file.");
  const header: unknown = JSON.parse((await head(path, 8 + length)).subarray(8).toString("utf8"));
  if (!isRecord(header)) throw new Error("The safetensors header isn't readable.");
  const tensors: ModelTensor[] = Object.entries(header).flatMap(([name, value]) => {
    if (name === "__metadata__" || !isRecord(value)) return [];
    const [from, to] = numbers(value.data_offsets);
    return [{
      name,
      shape: numbers(value.shape).join(" × "),
      type: typeof value.dtype === "string" ? value.dtype : "",
      bytes: from !== undefined && to !== undefined ? to - from : 0,
      offset: from ?? null,
    }];
  }).sort((a, b) => (a.offset ?? 0) - (b.offset ?? 0));
  const extra = header.__metadata__;
  const metadata: MetaEntry[] = isRecord(extra) ? Object.entries(extra).map(([key, value]) => ({ key, value: String(value) })) : [];
  const params = Object.entries(header).reduce<number>((sum, [name, value]) => sum + (name !== "__metadata__" && isRecord(value) ? numbers(value.shape).reduce((n, d) => n * d, 1) : 0), 0);
  const mix = mixOf(tensors);
  const size = (await stat(path)).size;
  return {
    name: basename(path),
    format: "safetensors",
    weights: `${count(params)} parameters · ${mixSummary(mix)} · ${bytes(size)}`,
    inputs: [],
    outputs: [],
    layers: tensors.map((t) => ({ name: t.name, op: "weights", shape: t.shape, type: t.type })),
    risk: null,
    tensors,
    mix,
    metadata,
    template: null,
    loads: [],
    nodes: [],
    size,
  };
}
