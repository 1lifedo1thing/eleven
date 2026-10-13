import { createHash } from "node:crypto";
import { readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { adoptLoginShell } from "../src/agents/detect";
import { entryProcedure } from "../src/engine/procedures";
import { prepareTarget } from "../src/engine/target";
import { adoptToolchain } from "../src/engine/toolchain";
import { loadProgram } from "../src/workbench/program";

await adoptLoginShell();
adoptToolchain();
console.log(`REA: ${process.env.ELEVEN_REA}`);

const seconds = (since: number): string => `${((performance.now() - since) / 1000).toFixed(1)}s`;

for (const path of process.argv.slice(2)) {
  const target = prepareTarget(path);
  const sha = createHash("sha256").update(readFileSync(target.path)).digest("hex");
  rmSync(join(homedir(), "Library", "Caches", "eleven", sha), { recursive: true, force: true });
  console.log(`\n== ${target.name} (${target.arch}, ${target.meta}) analysed file ${target.path}`);
  const cold = performance.now();
  const program = await loadProgram(target);
  console.log(`cold open + function list: ${seconds(cold)}, ${program.total} functions, ${program.imports.length} imports, ${program.strings.length} strings, ${program.segments.length} segments`);
  const entry = entryProcedure(program.functions.map((fn) => ({ address: fn.addr, name: fn.name, kind: "Function" as const }))) ?? null;
  if (!entry) throw new Error("no entry function");
  const read = performance.now();
  const pseudo = await program.code(entry.address, "pseudo");
  const asm = await program.code(entry.address, "asm");
  console.log(`read ${entry.name} @ ${entry.address}: ${seconds(read)}, pseudocode ${pseudo.split("\n").length} lines, assembly ${asm.split("\n").length} lines`);
  console.log(pseudo.split("\n").slice(0, 6).join("\n"));
  const refs = await program.refs(entry.address);
  console.log(`refs: ${JSON.stringify(refs).slice(0, 200)}`);
  const warm = performance.now();
  const again = await loadProgram(target);
  await again.code(entry.address, "pseudo");
  console.log(`cached reopen + read: ${seconds(warm)}`);
}
process.exit(0);
