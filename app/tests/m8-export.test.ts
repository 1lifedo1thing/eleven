import { beforeAll, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { adoptLoginShell } from "../src/agents/detect";
import { prepareTarget } from "../src/engine/target";
import { adoptToolchain } from "../src/engine/toolchain";
import { exportAllPseudocode, exportFunction } from "../src/workbench/export";
import { loadProgram } from "../src/workbench/program";

const APP = join(import.meta.dir, "fixtures", "PhotoFilter.app");

beforeAll(async () => {
  await adoptLoginShell();
  adoptToolchain();
  process.env.ELEVEN_EXPORT_DIR = mkdtempSync(join(tmpdir(), "eleven-export-"));
});

test("M8: export writes a function's pseudocode and all functions to files", async () => {
  const program = await loadProgram(prepareTarget(APP));
  const entry = program.functions.find((fn) => fn.name === "entry") ?? program.functions[0];
  if (!entry) throw new Error("no functions");
  const one = await exportFunction(program, entry.addr, "pseudo", entry.name);
  expect(one).toEndWith("entry.c");
  expect(readFileSync(one, "utf8").length).toBeGreaterThan(50);
  const all = await exportAllPseudocode(program);
  const body = readFileSync(all, "utf8");
  expect(body).toContain("// entry");
  expect((body.match(/^\/\/ /gm) ?? []).length).toBeGreaterThan(20);
}, 300_000);
