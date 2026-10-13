import { connect } from "node:net";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { isRecord } from "../lib/guards";
import { hidePaths } from "./privacy";
import { AGENT_ENV, BRIDGE_ENV, type BridgeCaller, type BridgeTool, CHAT_ENV } from "./protocol";

let nextId = 1;

const caller: BridgeCaller = { agent: process.env[AGENT_ENV] || "Agent", chat: process.env[CHAT_ENV] || null };

function ask(tool: BridgeTool, args: Readonly<Record<string, string>>): Promise<string> {
  const path = process.env[BRIDGE_ENV];
  if (!path) return Promise.reject(new Error("Eleven isn't running, so there is no view to drive."));
  return new Promise((resolve, reject) => {
    const socket = connect(path);
    let buffer = "";
    socket.on("error", (err) => reject(new Error(`Eleven didn't answer: ${err.message}`)));
    socket.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const line = buffer.split("\n")[0];
      if (line === undefined || !buffer.includes("\n")) return;
      socket.end();
      const reply: unknown = JSON.parse(line);
      if (isRecord(reply) && reply.ok === true && typeof reply.text === "string") resolve(reply.text);
      else reject(new Error(isRecord(reply) && typeof reply.error === "string" ? reply.error : "Eleven couldn't do that."));
    });
    socket.write(`${JSON.stringify({ id: nextId++, tool, args, from: caller })}\n`);
  });
}

async function run(tool: BridgeTool, args: Readonly<Record<string, string>>): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
  try {
    return { content: [{ type: "text", text: hidePaths(await ask(tool, args)) }] };
  } catch (err) {
    return { content: [{ type: "text", text: hidePaths(err instanceof Error ? err.message : String(err)) }], isError: true };
  }
}

/** Eleven's own MCP server: lets any agent see and move the user's view, and annotate the project. */
export async function runMcp(): Promise<void> {
  const server = new McpServer({ name: "eleven", version: "0.1.0" });
  server.registerTool("open_function", {
    description: "Show a function in the user's Eleven window (code canvas and workbench). Use it whenever you start discussing a function, so the user sees what you see.",
    inputSchema: { function: z.string().describe("Function name like entry or FUN_100001234, or its address like 0x100001234") },
  }, ({ function: fn }) => run("open_function", { function: fn }));
  server.registerTool("current_view", {
    description: "What the user is looking at right now in Eleven: the file, function, address and view.",
  }, () => run("current_view", {}));
  server.registerTool("set_view", {
    description: "Switch the user's code view to pseudocode, assembly, graph or hex.",
    inputSchema: { view: z.enum(["pseudocode", "assembly", "graph", "hex"]) },
  }, ({ view }) => run("set_view", { view }));
  server.registerTool("rename_function", {
    description: "Give a function a meaningful name in the user's Eleven project (never changes the binary). Use it once you understand what a FUN_ function does.",
    inputSchema: { function: z.string(), new_name: z.string().describe("A C identifier, like check_license_key") },
  }, (args) => run("rename_function", { function: args.function, new_name: args.new_name }));
  server.registerTool("add_note", {
    description: "Save a short note on a function in the user's Eleven project, shown beside the code.",
    inputSchema: { function: z.string(), note: z.string() },
  }, (args) => run("add_note", { function: args.function, note: args.note }));
  server.registerTool("add_comment", {
    description: "Comment one instruction or address in the user's Eleven project; it shows at the end of that line in assembly and the graph. An empty comment removes it.",
    inputSchema: { address: z.string().describe("Hexadecimal, like 0x100003f2c"), comment: z.string() },
  }, (args) => run("add_comment", { address: args.address, comment: args.comment }));
  server.registerTool("bookmark", {
    description: "Bookmark a function or address in the user's Eleven sidebar, with a short label.",
    inputSchema: { address: z.string().describe("A function name or hexadecimal address"), label: z.string() },
  }, (args) => run("bookmark", { address: args.address, label: args.label }));
  server.registerTool("propose_patch", {
    description: "Suggest new bytes at an address. The user reviews it before it is saved; the binary itself is never changed, only a patched copy is written.",
    inputSchema: { address: z.string().describe("Hexadecimal, like 0x100003f2c"), bytes: z.string().describe("Hex bytes, like 1f2003d5 or 90 90"), reason: z.string().describe("One sentence on what the patch does, shown to the user") },
  }, (args) => run("propose_patch", { address: args.address, bytes: args.bytes, reason: args.reason }));
  server.registerTool("set_code_type", {
    description: "Mark what the bytes at an address are in the user's Eleven project, like Hopper's Modify menu: code, procedure (start a function), byte, word, dword, qword, cstring or undefined. Leave type empty to read them as code again. Ghidra re-reads the code and the user can undo it.",
    inputSchema: { address: z.string().describe("Hexadecimal, like 0x100003f2c"), type: z.string().describe("code, procedure, byte, word, dword, qword, cstring, undefined, or empty") },
  }, (args) => run("set_code_type", { address: args.address, type: args.type }));
  server.registerTool("set_number_format", {
    description: "Choose how the number in the instruction at an address reads in the user's assembly: hex, decimal, char, offset or address. Leave format empty to show it as Ghidra prints it.",
    inputSchema: { address: z.string().describe("Hexadecimal, like 0x100003f2c"), format: z.string().describe("hex, decimal, char, offset, address, or empty") },
  }, (args) => run("set_number_format", { address: args.address, format: args.format }));
  server.registerTool("list_marks", {
    description: "The user's renames, bookmarks, notes and line comments for the open file, plus your suggestions still waiting for review.",
  }, () => run("list_marks", {}));
  server.registerTool("gpu_profile", {
    description: "The newest GPU recording of the open app (Metal System Trace): frame time, how busy the GPU is, gaps between frames, and what the numbers suggest fixing.",
  }, () => run("gpu_profile", {}));
  await server.connect(new StdioServerTransport());
}
