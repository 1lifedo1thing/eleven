import "./fixtures/isolate";
import { beforeAll, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { adoptLoginShell } from "../src/agents/detect";
import { prepareTarget } from "../src/engine/target";
import { adoptToolchain } from "../src/engine/toolchain";
import { lineAddress } from "../src/workbench/subject";
import { loadProgram } from "../src/workbench/program";

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

test("M8: Ghidra reads an instruction as data, then as code again, and the assembly follows", async () => {
  const program = await loadProgram(prepareTarget(ghidraBinary("linux_x86_64", (name) => !name.includes("."))));
  const retype = program.retype;
  if (!retype) throw new Error("the Ghidra engine should change types");
  const fn = program.functions.find((f) => f.kind === "function");
  if (!fn) throw new Error("need a function");
  const before = (await program.code(fn.addr, "asm")).split("\n");
  const second = before[1] ?? "";
  const addr = lineAddress(second);
  if (!addr) throw new Error(`no address in ${second}`);

  await retype(addr, "byte", null);
  const asData = (await program.code(fn.addr, "asm")).split("\n");
  expect(asData.find((line) => lineAddress(line) === addr)).toMatch(/: db 0x[0-9a-f]{2}$/);

  await retype(addr, null, "byte");
  const back = (await program.code(fn.addr, "asm")).split("\n");
  expect(back.find((line) => lineAddress(line) === addr)).toBe(second);
}, 600_000);
