import type { ModelInfo } from "../types";
import { readCoreMl } from "./coreml";
import { readGguf } from "./gguf";
import { readPickle } from "./pickle";
import { readOnnx } from "./onnx";
import { readSafetensors } from "./safetensors";

export const MODEL_FILE = /\.(mlmodelc|gguf|safetensors|onnx|pt|pth|ckpt)$/i;

/** Reads any model file Eleven understands; the reader is picked by extension. */
export function readModel(path: string): Promise<ModelInfo> {
  if (/\.mlmodelc$/i.test(path)) return readCoreMl(path);
  if (/\.gguf$/i.test(path)) return readGguf(path);
  if (/\.safetensors$/i.test(path)) return readSafetensors(path);
  if (/\.onnx$/i.test(path)) return readOnnx(path);
  return readPickle(path);
}
