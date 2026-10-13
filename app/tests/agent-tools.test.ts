import "./fixtures/isolate";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { join } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { adoptLoginShell } from "../src/agents/detect";
import { isReadOnly, onlySuggests } from "../src/agents/permissions";
import { ELEVEN_OWNED } from "../src/bridge/reaProxy";
import { adoptToolchain } from "../src/engine/toolchain";

let client: Client;

function text(reply: Awaited<ReturnType<Client["callTool"]>>): string {
  const first: unknown = Array.isArray(reply.content) ? reply.content[0] : undefined;
  return typeof first === "object" && first !== null && "text" in first && typeof first.text === "string" ? first.text : "";
}

beforeAll(async () => {
  await adoptLoginShell();
  adoptToolchain();
  const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  client = new Client({ name: "agent-tools-test", version: "0" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(import.meta.dir, "..", "src", "main.tsx"), "--rea-mcp"], env, stderr: "ignore" }));
}, 60_000);

afterAll(async () => {
  await client.close();
});

test("agent tools: REA's own rename, comment and bookmark tools are hidden from agents", async () => {
  const names = (await client.listTools()).tools.map((tool) => tool.name);
  expect(names).toContain("list_procedures");
  expect(names).toContain("procedure_pseudo_code");
  for (const hidden of ELEVEN_OWNED.keys()) expect(names).not.toContain(hidden);
}, 60_000);

test("agent tools: calling a hidden REA tool by name points to Eleven's tool", async () => {
  const reply = await client.callTool({ name: "set_comment", arguments: { address: "0x1000", comment: "x" } });
  expect(reply.isError).toBe(true);
  expect(text(reply)).toContain("add_comment");
}, 60_000);

test("agent tools: other REA tools still answer through the filter", async () => {
  const reply = await client.callTool({ name: "binary_session", arguments: {} });
  expect(text(reply).length).toBeGreaterThan(0);
}, 120_000);

test("agent tools: a suggestion never asks first, an edit asks unless every edit is reviewed", () => {
  expect(onlySuggests("mcp__eleven__propose_patch", false)).toBe(true);
  expect(onlySuggests("mcp__eleven__rename_function", false)).toBe(false);
  expect(onlySuggests("mcp__eleven__rename_function", true)).toBe(true);
  expect(onlySuggests("mcp__eleven-rea__set_comment", true)).toBe(false);
  expect(isReadOnly("mcp__eleven__propose_patch")).toBe(false);
});

test("agent tools: the REA filter exits once the agent that started it goes away", async () => {
  const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  const proxy = Bun.spawn([process.execPath, join(import.meta.dir, "..", "src", "main.tsx"), "--rea-mcp"], { env, stdin: "pipe", stdout: "ignore", stderr: "ignore" });
  await Bun.sleep(3_000);
  await proxy.stdin.end();
  const timeout = async (): Promise<null> => {
    await Bun.sleep(20_000);
    return null;
  };
  const exited = await Promise.race([proxy.exited, timeout()]);
  if (exited === null) proxy.kill();
  expect(exited).toBe(0);
}, 60_000);
