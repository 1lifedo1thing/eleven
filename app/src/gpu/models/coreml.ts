import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { isRecord, stringField } from "../../lib/guards";
import type { ModelInfo, ModelLayer, Tensor } from "../types";

const MAX_LAYERS = 200;

function shape(value: unknown): readonly number[] {
  if (typeof value !== "string") return [];
  return value.replace(/[[\]]/g, "").split(",").map((part) => part.trim()).filter(Boolean).map(Number).filter((n) => Number.isFinite(n));
}

function tensors(schema: unknown): readonly Tensor[] {
  if (!Array.isArray(schema)) return [];
  return schema.flatMap((entry): Tensor[] => {
    const name = stringField(entry, "name");
    if (!name) return [];
    return [{ kind: stringField(entry, "type") === "Image" ? "image" : "tensor", name, shape: shape(isRecord(entry) ? entry.shape : undefined) }];
  });
}

async function espressoLayers(dir: string, files: readonly string[]): Promise<readonly ModelLayer[]> {
  const net = files.find((file) => file.endsWith(".espresso.net"));
  if (!net) return [];
  const parsed: unknown = JSON.parse(await readFile(join(dir, net), "utf8"));
  const layers = isRecord(parsed) && Array.isArray(parsed.layers) ? parsed.layers : [];
  return layers.slice(0, MAX_LAYERS).map((layer) => ({ name: stringField(layer, "name") ?? "", op: stringField(layer, "type") ?? "", shape: stringField(layer, "top") ?? "", type: "" }));
}

async function milLayers(dir: string, files: readonly string[]): Promise<readonly ModelLayer[]> {
  if (!files.includes("model.mil")) return [];
  const program = await readFile(join(dir, "model.mil"), "utf8");
  const ops = [...program.matchAll(/^\s*(tensor<([^>]*)>)\s+([\w.]+)\s*=\s*([\w.]+)\(/gm)];
  return ops.slice(0, MAX_LAYERS).map((match) => ({ name: match[3] ?? "", op: match[4] ?? "", shape: match[2] ?? "", type: "" }));
}

function histogram(meta: Record<string, unknown>): readonly ModelLayer[] {
  const counts = meta.neuralNetworkLayerTypeHistogram ?? meta.mlProgramOperationTypeHistogram;
  if (!isRecord(counts)) return [];
  return Object.entries(counts).map(([op, n]) => ({ name: `${String(n)} ×`, op, shape: "", type: "" }));
}

/** A compiled CoreML model: inputs, outputs and layers, from its metadata and its network or program file. */
export async function readCoreMl(dir: string): Promise<ModelInfo> {
  const files = await readdir(dir);
  const parsed: unknown = JSON.parse(await readFile(join(dir, "metadata.json"), "utf8"));
  const meta = Array.isArray(parsed) && isRecord(parsed[0]) ? parsed[0] : {};
  const layers = [...(await espressoLayers(dir, files)), ...(await milLayers(dir, files))];
  const kind = isRecord(meta.modelType) ? stringField(meta.modelType, "name")?.replace("MLModelType_", "") : undefined;
  const author = stringField(meta, "author");
  return {
    name: basename(dir),
    format: `CoreML ${kind ?? "model"}${author ? ` · by ${author}` : ""}`,
    weights: `${stringField(meta, "storagePrecision") ?? "unknown"} weights · runs in ${stringField(meta, "computePrecision") ?? "unknown"}`,
    inputs: tensors(meta.inputSchema),
    outputs: tensors(meta.outputSchema),
    layers: layers.length > 0 ? layers : histogram(meta),
    risk: null,
    tensors: [],
    mix: [],
    metadata: Object.entries(meta).flatMap(([key, value]) => (typeof value === "string" || typeof value === "number" ? [{ key, value: String(value) }] : [])),
    template: null,
    loads: [],
    nodes: [],
    size: 0,
  };
}
