import { expect, test } from "bun:test";

import { adoptLoginShell } from "../src/agents/detect";
import { prepareTarget } from "../src/engine/target";
import { adoptToolchain } from "../src/engine/toolchain";
import { layoutGraph } from "../src/workbench/cfg";
import { loadProgram } from "../src/workbench/program";

test("M2: Ghidra's real callers, callees and control-flow blocks", async () => {
  await adoptLoginShell();
  adoptToolchain();
  const program = await loadProgram(prepareTarget("/bin/ls"));
  if (!program.dossier) throw new Error("real programs carry a dossier");
  const dossier = await program.dossier("0x100004088");
  const refs = await program.refs("0x100004088");
  expect(refs.callers.map((caller) => caller.addr)).toContain("0x100000960");
  const entry = await program.dossier("0x100000960");
  expect(entry.blocks.length).toBeGreaterThan(5);
  const layout = layoutGraph(entry.blocks, (await program.code("0x100000960", "asm")).split("\n"));
  expect(layout.blocks.length).toBe(entry.blocks.length);
  expect(layout.edges.some((edge) => edge.kind === "taken")).toBe(true);
  expect(layout.blocks.every((block) => block.lines.length > 0)).toBe(true);
  expect(dossier.blocks.length).toBeGreaterThan(0);
}, 300_000);
