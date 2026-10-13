import { beforeAll, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { adoptLoginShell } from "../src/agents/detect";
import { prepareTarget } from "../src/engine/target";
import { adoptToolchain } from "../src/engine/toolchain";
import { loadProgram } from "../src/workbench/program";

/** Binaries that ship with every Ghidra install, so the test needs no extra fixture. */
function ghidraBinary(os: string, match: (name: string) => boolean): string {
  const dir = join(process.env.GHIDRA_INSTALL_DIR ?? "", "GPL", "DemanglerGnu", "os", os);
  const file = existsSync(dir) ? readdirSync(dir).find(match) : undefined;
  if (!file) throw new Error(`no binary found in ${dir} to test with`);
  return join(dir, file);
}

beforeAll(async () => {
  await adoptLoginShell();
  adoptToolchain();
});

test("M7: an ELF binary reads its arch, functions, code, strings, segments and bytes", async () => {
  const target = prepareTarget(ghidraBinary("linux_x86_64", (name) => !name.includes(".")));
  expect(target.arch).toBe("x86_64");
  expect(target.meta).toContain("ELF");
  const program = await loadProgram(target);
  expect(program.total).toBeGreaterThan(50);
  expect(program.strings.length).toBeGreaterThan(5);
  expect(program.segments.length).toBeGreaterThan(3);
  const main = program.functions.find((fn) => fn.name === "main") ?? program.functions[0];
  if (!main) throw new Error("no functions");
  const code = await program.code(main.addr, "pseudo");
  expect(code.length).toBeGreaterThan(20);
  const hex = await program.hex(main.addr);
  expect(hex.length).toBeGreaterThan(0);
  expect(hex[0]?.bytes).toMatch(/^[0-9a-f ]+$/);
}, 300_000);


test("M7: a Windows PE binary reads its arch, functions and strings", async () => {
  const target = prepareTarget(ghidraBinary("win_x86_64", (name) => name.endsWith(".exe")));
  expect(target.arch).toBe("x86_64");
  expect(target.meta).toContain("PE");
  const program = await loadProgram(target);
  expect(program.total).toBeGreaterThan(50);
  expect(program.strings.length).toBeGreaterThan(5);
  expect(program.segments.length).toBeGreaterThan(2);
}, 300_000);
