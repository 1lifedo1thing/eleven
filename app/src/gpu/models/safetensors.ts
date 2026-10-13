import { stat } from "node:fs/promises";
import { basename } from "node:path";

import { isRecord } from "../../lib/guards";
import type { ModelInfo, ModelLayer } from "../types";
import { bytes, count, head } from "./read";

const MAX_LAYERS = 200;
const MAX_HEADER = 100 * 1024 * 1024;

export async function readSafetensors(path: string): Promise<ModelInfo> {
  const start = await head(path, 8);
  const length = Number(start.readBigUInt64LE(0));
  if (length <= 0 || length > MAX_HEADER) throw new Error("This doesn't look like a safetensors file.");
  const header: unknown = JSON.parse((await head(path, 8 + length)).subarray(8).toString("utf8"));
  if (!isRecord(header)) throw new Error("The safetensors header isn't readable.");
  const tensors = Object.entries(header).filter(([name, value]) => name !== "__metadata__" && isRecord(value));
  const layers: ModelLayer[] = tensors.slice(0, MAX_LAYERS).map(([name, value]) => {
    const info = isRecord(value) ? value : {};
    const shape = Array.isArray(info.shape) ? info.shape.join(" × ") : "";
    return { name, op: "weights", shape, type: typeof info.dtype === "string" ? info.dtype : "" };
  });
  const params = tensors.reduce((sum, [, value]) => sum + (isRecord(value) && Array.isArray(value.shape) ? value.shape.reduce((n: number, d: unknown) => n * (typeof d === "number" ? d : 1), 1) : 0), 0);
  const dtypes = [...new Set(layers.map((layer) => layer.type))].join(", ");
  return { name: basename(path), format: "safetensors", weights: `${count(params)} parameters · ${dtypes} · ${bytes((await stat(path)).size)}`, inputs: [], outputs: [], layers, risk: null };
}
