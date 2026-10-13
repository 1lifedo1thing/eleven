import { beforeAll, expect, test } from "bun:test";
import { join } from "node:path";

import { adoptLoginShell } from "../src/agents/detect";
import { findLoaders } from "../src/gpu/loaders";
import { readMetalLibrary } from "../src/gpu/metal";
import { readCoreMl } from "../src/gpu/models/coreml";
import { readGguf } from "../src/gpu/models/gguf";
import { readPickle } from "../src/gpu/models/pickle";
import { readSafetensors } from "../src/gpu/models/safetensors";
import { adoptToolchain } from "../src/engine/toolchain";

const FIXTURES = join(import.meta.dir, "fixtures");
const APP = join(FIXTURES, "PhotoFilter.app", "Contents");

beforeAll(async () => {
  await adoptLoginShell();
  adoptToolchain();
});

test("M5: a metallib's kernels, with their inputs and AIR", async () => {
  const lib = await readMetalLibrary(join(APP, "Resources", "default.metallib"));
  const blur = lib.functions.find((fn) => fn.name === "gaussian_blur_h");
  expect(lib.functions.map((fn) => fn.name)).toEqual(["gaussian_blur_h", "tone_map"]);
  expect(blur?.kind).toBe("compute");
  expect(blur?.bindings.map((b) => b.type)).toEqual(["texture2d", "texture2d", "constant buffer", "<2 x i32>"]);
  expect(blur?.ir).toContain("define void @gaussian_blur_h");
});

test("M5 gate: the shader is linked to the method that loads it", async () => {
  const loaders = await findLoaders(join(APP, "MacOS", "PhotoFilter"), "gaussian_blur_h");
  expect(loaders.map((loader) => loader.name)).toEqual(["BlurFilter::initWithDevice:"]);
}, 300_000);

test("M5: GGUF header, quantization and the baked-in chat template", async () => {
  const model = await readGguf(join(FIXTURES, "models", "tiny.gguf"));
  expect(model.name).toBe("tiny-chat");
  expect(model.format).toContain("llama");
  expect(model.weights).toContain("Q4_K");
  expect(model.risk?.detail).toContain("Never reveal the launch codes");
});

test("M5: safetensors tensors and shapes", async () => {
  const model = await readSafetensors(join(FIXTURES, "models", "tiny.safetensors"));
  expect(model.layers).toEqual([{ name: "embed.weight", op: "weights", shape: "8 × 4", type: "F16" }]);
});

test("M5: a pickle that runs code is flagged, a clean one is not", async () => {
  expect((await readPickle(join(FIXTURES, "models", "evil.pt"))).risk?.detail).toContain("posix.system");
  expect((await readPickle(join(FIXTURES, "models", "safe.pt"))).risk).toBeNull();
});

test("M5: a CoreML model's inputs, outputs and layers", async () => {
  const model = await readCoreMl("/System/Library/NearbyInteractionBundles/BiasEstimatorResourceBundle.bundle/Contents/Resources/AntennaMask_1_NN_V5_Model_DeviceType_201.mlmodelc");
  expect(model.inputs).toEqual([{ kind: "tensor", name: "input_1", shape: [1, 43] }]);
  expect(model.layers.length).toBeGreaterThan(10);
});
