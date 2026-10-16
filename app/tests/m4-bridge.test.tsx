import { afterAll, beforeAll, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { adoptLoginShell } from "../src/agents/detect";
import { App } from "../src/App";
import { startAppBridge } from "../src/bridge/live";
import { AGENT_ENV, BRIDGE_ENV, CHAT_ENV } from "../src/bridge/protocol";
import { accept, pending } from "../src/engine/history";
import { loadProject } from "../src/engine/project";
import { prepareTarget } from "../src/engine/target";
import { adoptToolchain } from "../src/engine/toolchain";
import { Screen } from "./harness";

const LS_ID = "7475c05a59b8bfbdcedffe4195a45c36d22c5ccdd9412bf48152472965653fee";
const PROJECT = join(homedir(), "Library", "Application Support", "Eleven", "projects", `${LS_ID}.json`);

let screen: Screen;
let client: Client;

async function call(name: string, args: Record<string, string | boolean> = {}): Promise<string> {
  const reply = await client.callTool({ name, arguments: args });
  const content = Array.isArray(reply.content) ? reply.content : [];
  const first: unknown = content[0];
  const text = typeof first === "object" && first !== null && "text" in first && typeof first.text === "string" ? first.text : "";
  if (reply.isError) throw new Error(text);
  return text;
}

beforeAll(async () => {
  await adoptLoginShell();
  adoptToolchain();
  rmSync(PROJECT, { force: true });
  startAppBridge();
  screen = new Screen().render(<App initial={prepareTarget("/bin/ls")} />);
  await screen.until(() => screen.text().includes("What should we take apart?"));
  const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  client = new Client({ name: "m4-test", version: "0" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(import.meta.dir, "..", "src", "main.tsx"), "--eleven-mcp"], env: { ...env, [BRIDGE_ENV]: process.env[BRIDGE_ENV] ?? "", [AGENT_ENV]: "Claude", [CHAT_ENV]: "chat-m4" }, stderr: "ignore" }));
});

afterAll(async () => {
  await client.close();
  screen.unmount();
  rmSync(PROJECT, { force: true });
});

test("M4: the agent's open_function shows that function to the user", async () => {
  expect(await call("open_function", { function: "FUN_1000016d8" })).toContain("Showing FUN_1000016d8");
  await screen.until(() => screen.text().includes("Workbench") && screen.text().includes("FUN_1000016d8"), 60_000);
  expect(await call("current_view")).toContain("FUN_1000016d8");
}, 120_000);

test("M4: the agent's rename lands in the project and on screen", async () => {
  expect(await call("rename_function", { function: "0x1000016d8", new_name: "print_usage" })).toContain("print_usage");
  expect(loadProject(LS_ID).names.get("0x1000016d8")).toBe("print_usage");
  expect(await call("list_marks")).toContain("renamed 0x1000016d8 to print_usage");
  await expect(call("rename_function", { function: "nope", new_name: "x" })).rejects.toThrow("no function called nope");
}, 60_000);

test("M4: the agent's edits are logged under its name, and its patches wait for review", async () => {
  const renamed = loadProject(LS_ID).edits.find((edit) => edit.field === "names" && edit.key === "0x1000016d8");
  expect(renamed?.by).toEqual({ kind: "agent", agent: "Claude", chat: "chat-m4" });
  expect(await call("propose_patch", { address: "0x1000016d8", bytes: "c0035fd6", reason: "Return right away" })).toContain("reviews it in Changes");
  expect(loadProject(LS_ID).patches).toEqual([]);
  expect(await call("list_marks")).toContain("waiting for the user's review: Patch 0x1000016d8 to c0 03 5f d6");
  await expect(call("propose_patch", { address: "0x1000016d8", bytes: "xyz", reason: "" })).rejects.toThrow("hex bytes");
  accept(LS_ID, pending(loadProject(LS_ID)).map((edit) => edit.id));
  expect(loadProject(LS_ID).patches).toEqual([{ addr: "0x1000016d8", bytes: "c0 03 5f d6" }]);
}, 60_000);

test("M9: the agent sets breakpoints in the project, and can only drive a session the user started", async () => {
  expect(await call("set_breakpoint", { address: "0x1000016d8", on: true })).toContain("Added a breakpoint at 0x1000016d8");
  expect(loadProject(LS_ID).breakpoints.get("0x1000016d8")).toBe("on");
  expect(await call("debug_state")).toContain("Ask the user to press Debug");
  await expect(call("debug_control", { action: "continue" })).rejects.toThrow("only they can start the program");
  expect(await call("set_breakpoint", { address: "0x1000016d8", on: false })).toContain("Removed");
  expect(loadProject(LS_ID).breakpoints.has("0x1000016d8")).toBe(false);
}, 60_000);
