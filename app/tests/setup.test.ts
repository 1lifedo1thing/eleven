import { expect, test } from "bun:test";

import { engineReady, type Found, type Install, rowState } from "../src/welcome/engines";
import { nextStep, previousStep, STEPS } from "../src/welcome/steps";
import { ready, stripFor } from "../src/welcome/strip";

const IDLE: Install = { phase: "idle" };
const HERE: Found = { found: true, where: "~/x" };
const GONE: Found = { found: false, where: "" };
test("setup walks engine, agent, shortcuts, then try it", () => {
  expect(STEPS.map((step) => step.id)).toEqual(["engine", "agent", "keys", "try"]);
  expect(nextStep("engine")).toBe("agent");
  expect(nextStep("keys")).toBe("try");
  expect(nextStep("try")).toBeNull();
  expect(previousStep("engine")).toBeNull();
  expect(previousStep("try")).toBe("keys");
});

test("an engine row follows detection and the running install", () => {
  expect(rowState(GONE, IDLE)).toBe("missing");
  expect(rowState(HERE, IDLE)).toBe("ready");
  expect(rowState(GONE, { phase: "running", progress: 0.4, note: "Downloading" })).toBe("installing");
  expect(rowState(GONE, { phase: "failed", message: "No network" })).toBe("failed");
});

test("rizin alone, or ghidra with java, is enough to start", () => {
  expect(engineReady({ rizin: GONE, ghidra: GONE, java: HERE })).toBe(false);
  expect(engineReady({ rizin: GONE, ghidra: HERE, java: GONE })).toBe(false);
  expect(engineReady({ rizin: GONE, ghidra: HERE, java: HERE })).toBe(true);
  expect(engineReady({ rizin: HERE, ghidra: GONE, java: GONE })).toBe(true);
});

test("the composer strip says what is missing and clears when ready", () => {
  const base = { found: { rizin: GONE, ghidra: GONE, java: GONE }, installs: { rizin: IDLE, ghidra: IDLE, java: IDLE }, agentName: "Claude", agent: "ready" as const, waiting: false };
  expect(stripFor(base)?.text).toBe("To read Calculator, Eleven needs Rizin (38 MB).");
  expect(stripFor(base)?.engines).toEqual(["rizin"]);
  const busy: Install = { phase: "running", progress: 0.5, note: "x" };
  const running = { ...base, installs: { ...base.installs, rizin: busy }, waiting: true };
  expect(stripFor(running)?.text).toBe("Your question sends as soon as Rizin is installed.");
  expect(stripFor(running)?.action?.does).toBe("unqueue");
  expect(ready(running)).toBe(false);
  const failed = { ...base, installs: { ...base.installs, rizin: { phase: "failed" as const, message: "x" } } };
  expect(stripFor(failed)?.tone).toBe("failed");
  const done = { ...base, found: { ...base.found, rizin: HERE } };
  expect(stripFor(done)).toBeNull();
  expect(ready(done)).toBe(true);
  expect(stripFor({ ...done, agent: "signin" })?.action?.label).toBe("Sign in");
  expect(stripFor({ ...done, agent: "install" })?.text).toContain("Claude isn't installed yet");
});
