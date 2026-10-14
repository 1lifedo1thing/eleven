import { beforeAll, expect, test } from "bun:test";
import { join } from "node:path";

import { adoptLoginShell } from "../src/agents/detect";
import { readMetalLibrary } from "../src/gpu/metal";
import { readCoreMl } from "../src/gpu/models/coreml";
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

test("M5: a CoreML model's inputs, outputs and layers", async () => {
  const model = await readCoreMl("/System/Library/NearbyInteractionBundles/BiasEstimatorResourceBundle.bundle/Contents/Resources/AntennaMask_1_NN_V5_Model_DeviceType_201.mlmodelc");
  expect(model.inputs).toEqual([{ kind: "tensor", name: "input_1", shape: [1, 43] }]);
  expect(model.layers.length).toBeGreaterThan(10);
});
