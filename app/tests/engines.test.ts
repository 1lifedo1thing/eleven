import { beforeEach, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { activeEngine, activeProvider, ENGINES, enabledEngines, isEnabled, setEnabled } from "../src/analysis/engines";

/** Start from a known, empty set so real installs (Hopper on this Mac) don't leak into assertions. */
beforeEach(() => {
  process.env.ELEVEN_SUPPORT = mkdtempSync(join(tmpdir(), "eleven-engines-"));
  delete process.env.GHIDRA_INSTALL_DIR;
  delete process.env.REA_IDA_MCP_CONFIG;
  for (const e of ENGINES) setEnabled(e.id, false);
});

test("engines: turning one on persists and reads back", () => {
  setEnabled("hopper", true);
  expect(isEnabled("hopper")).toBe(true);
  setEnabled("ghidra", true);
  expect(new Set(enabledEngines())).toEqual(new Set(["hopper", "ghidra"]));
  setEnabled("hopper", false);
  expect(isEnabled("hopper")).toBe(false);
  expect(isEnabled("ghidra")).toBe(true);
});

test("engines: the active engine must be on, ready, and installed", () => {
  setEnabled("ghidra", true);
  expect(activeEngine()).toBeNull();
  expect(activeProvider()).toBeNull();

  process.env.GHIDRA_INSTALL_DIR = process.env.ELEVEN_SUPPORT as string;
  expect(activeEngine()?.id).toBe("ghidra");
  expect(activeProvider()).toBe("ghidra");
});

test("engines: an experimental engine never becomes the active provider", () => {
  process.env.GHIDRA_INSTALL_DIR = process.env.ELEVEN_SUPPORT as string;
  setEnabled("r2ghidra", true);
  expect(activeProvider()).toBeNull();
});

test("engines: turning everything off leaves no engine", () => {
  process.env.GHIDRA_INSTALL_DIR = process.env.ELEVEN_SUPPORT as string;
  setEnabled("ghidra", true);
  expect(activeProvider()).toBe("ghidra");
  setEnabled("ghidra", false);
  expect(activeEngine()).toBeNull();
  expect(activeProvider()).toBeNull();
});
