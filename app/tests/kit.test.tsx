import { afterAll, beforeAll, expect, test } from "bun:test";
import { type ReactElement, useState } from "react";

import type { PermissionChoice } from "../src/agents/events";
import { MessageView } from "../src/chat/MessageView";
import type { Message } from "../src/chat/thread";
import { ErrorCard, StepProgress } from "../src/components/kit";
import { DARK, ThemeContext } from "../src/theme";
import { nameProblem } from "../src/workbench/Details";
import { Screen } from "./harness";

const ALLOW: PermissionChoice = { id: "allow", label: "Allow once", allows: true };
const REJECT: PermissionChoice = { id: "reject", label: "Don't allow", allows: false };

const TURN: Message = {
  kind: "agent",
  startedAt: 0,
  endedAt: 2000,
  outcome: "done",
  blocks: [
    { kind: "tool", step: { id: "a", tool: "Read pseudocode", input: { procedure: "entry" }, output: "ok", status: "done", startedAt: 1000, endedAt: 1157 } },
    { kind: "tool", step: { id: "b", tool: "Read pseudocode", input: { procedure: "FUN_1" }, output: "Ghidra couldn't decompile this function.", status: "failed", startedAt: 1000, endedAt: 1200 } },
    { kind: "text", text: "It prints usage in FUN_100004088." },
  ],
};

function Kit(): ReactElement {
  const [answer, setAnswer] = useState("none");
  const [state, setState] = useState<"pending" | "answered">("pending");
  const permission: Message = {
    kind: "permission",
    id: 1,
    tool: "rename_function",
    input: { function: "FUN_100004088", new_name: "print_usage" },
    choices: [ALLOW, REJECT],
    state: state === "pending" ? { kind: "pending" } : { kind: "answered", label: answer },
  };
  const actions = {
    onAnswer: (choice: PermissionChoice | null) => {
      setAnswer(choice?.label ?? "none");
      setState("answered");
    },
    onRetry: () => {},
    onOpen: (name: string) => setAnswer(`opened ${name}`),
  };
  return (
    <ThemeContext.Provider value={{ p: DARK, appearance: "Dark", setAppearance: () => {} }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 24, width: 700 }}>
        <ErrorCard title="Couldn't open Notes.app" detail="Pick Apple silicon or Intel and try again." raw="capability_unavailable · unsupported_provider" />
        <StepProgress title="Analyzing ls" steps={[{ label: "Read the file", state: "done" }, { label: "Ghidra is finding functions", state: "now" }, { label: "Ready", state: "next" }]} note="Next time this file opens from cache." />
        <MessageView message={TURN} agentName="Claude" last actions={actions} />
        <MessageView message={permission} agentName="Claude" last actions={actions} />
        <div>{`Answer ${answer}`}</div>
      </div>
    </ThemeContext.Provider>
  );
}

let screen: Screen;

beforeAll(() => {
  screen = new Screen().render(<Kit />);
});

afterAll(() => screen.unmount());

test("kit: an error card folds its raw detail behind Show details", async () => {
  await screen.until(() => screen.text().includes("Couldn't open Notes.app"), 5_000);
  expect(screen.text()).not.toContain("capability_unavailable");
  screen.click("Show details");
  await screen.until(() => screen.text().includes("capability_unavailable"), 5_000);
});

test("kit: step progress says which step it's on", () => {
  expect(screen.text()).toContain("Step 2 of 3");
  expect(screen.text()).toContain("✓ Read the file");
  expect(screen.text()).toContain("Next time this file opens from cache.");
});

test("chain of thought: a finished reply folds its steps under one line, and opens on click", async () => {
  expect(screen.text()).toContain("Worked through 2 steps in 2s");
  expect(screen.text()).not.toContain("157 ms");
  screen.clickLabel("Worked through 2 steps in 2s");
  await screen.until(() => screen.text().includes("157 ms"), 5_000);
});

test("kit: tool calls show how long they took, or that they didn't work", () => {
  expect(screen.text()).toContain("157 ms");
  expect(screen.text()).toContain("Didn't work");
  expect(screen.text()).toContain("Ghidra couldn't decompile this function.");
});

test("kit: a finished reply offers to open the functions it names", async () => {
  screen.clickLabel("Open FUN_100004088");
  await screen.until(() => screen.text().includes("Answer opened FUN_100004088"), 5_000);
});

test("kit: an agent's rename is a suggestion you accept or skip", async () => {
  expect(screen.text()).toContain("Rename FUN_100004088 to print_usage?");
  screen.clickLabel("Rename");
  await screen.until(() => screen.text().includes("Renamed to print_usage everywhere."), 5_000);
  expect(screen.text()).toContain("Answer Allow once");
});

test("kit: names with spaces are refused with a fix", () => {
  expect(nameProblem("print usage")).toBe("Names can't have spaces. Try print_usage.");
  expect(nameProblem("2fast")).toBe("Names can't start with a number. Try _2fast.");
  expect(nameProblem("print_usage")).toBeNull();
});
