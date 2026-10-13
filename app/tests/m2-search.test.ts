import { beforeAll, expect, test } from "bun:test";
import { join } from "node:path";

import { adoptLoginShell } from "../src/agents/detect";
import { prepareTarget } from "../src/engine/target";
import { adoptToolchain } from "../src/engine/toolchain";
import { codeForString } from "../src/workbench/layout";
import { loadProgram } from "../src/workbench/program";

const APP = join(import.meta.dir, "fixtures", "PhotoFilter.app");

beforeAll(async () => {
  await adoptLoginShell();
  adoptToolchain();
});

test("search: a string in the palette jumps to the code that references it", async () => {
  const program = await loadProgram(prepareTarget(APP));
  const shader = program.strings.find((row) => row.b === "gaussian_blur_h");
  expect(shader).toBeDefined();
  if (!shader) return;
  const fn = await codeForString(program.path, shader.a);
  expect(fn).not.toBeNull();
  const name = program.functions.find((f) => f.addr === fn)?.name ?? "";
  expect(name).toContain("BlurFilter");
}, 300_000);
