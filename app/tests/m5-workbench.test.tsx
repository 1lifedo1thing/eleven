import { afterAll, beforeAll, test } from "bun:test";
import { join } from "node:path";

import { adoptLoginShell } from "../src/agents/detect";
import { LiveSource } from "../src/gpu/live";
import { prepareTarget } from "../src/engine/target";
import { adoptToolchain } from "../src/engine/toolchain";
import { Screen } from "./harness";

let screen: Screen;

beforeAll(async () => {
  await adoptLoginShell();
  adoptToolchain();
  screen = new Screen().workbench(prepareTarget(join(import.meta.dir, "fixtures", "PhotoFilter.app")));
}, 30_000);

afterAll(() => screen.unmount());

test("M5 in the workbench: an app's shaders sit beside its functions", async () => {
  await screen.until(() => screen.labelled("Shaders and models") !== null, 120_000);
  screen.clickLabel("Shaders and models");
  await screen.until(() => screen.text().includes("gaussian_blur_h"), 10_000);
}, 150_000);

import { expect } from "bun:test";

test("M5: a shader's AIR and its loader resolve for the shader tab", async () => {
  const source = new LiveSource(prepareTarget(join(import.meta.dir, "fixtures", "PhotoFilter.app")));
  const libs = await source.listLibraries();
  const blur = libs.flatMap((lib) => lib.functions).find((fn) => fn.name === "gaussian_blur_h");
  expect(blur?.ir).toContain("define void @gaussian_blur_h");
  const loader = await source.loadedBy("default.metallib", "gaussian_blur_h");
  expect(loader?.symbol).toBe("-[BlurFilter initWithDevice:]");
}, 300_000);
