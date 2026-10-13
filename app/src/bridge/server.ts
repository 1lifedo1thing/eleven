import { mkdirSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { dirname } from "node:path";

import { errorMessage, isRecord } from "../lib/guards";
import { BRIDGE_ENV, type BridgeCaller, type BridgeReply, type BridgeTool, bridgePath, isBridgeTool } from "./protocol";
import { OS } from "../lib/platform";

export type BridgeHandler = (tool: BridgeTool, args: Readonly<Record<string, string>>, from: BridgeCaller) => Promise<string>;

function stringArgs(value: unknown): Readonly<Record<string, string>> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

function callerOf(value: unknown): BridgeCaller {
  if (!isRecord(value)) return { agent: "Agent", chat: null };
  return { agent: typeof value.agent === "string" && value.agent ? value.agent : "Agent", chat: typeof value.chat === "string" ? value.chat : null };
}

async function answer(line: string, handle: BridgeHandler): Promise<BridgeReply> {
  const request: unknown = JSON.parse(line);
  const id = isRecord(request) && typeof request.id === "number" ? request.id : 0;
  if (!isRecord(request) || !isBridgeTool(request.tool)) return { id, ok: false, error: "Eleven doesn't know that tool." };
  try {
    return { id, ok: true, text: await handle(request.tool, stringArgs(request.args), callerOf(request.from)) };
  } catch (err) {
    return { id, ok: false, error: errorMessage(err) };
  }
}

/** Listens on a local socket so the `eleven` MCP server inside each agent can reach this window. */
export function startBridge(handle: BridgeHandler): Server {
  const path = bridgePath();
  const pipe = OS === "windows";
  if (!pipe) {
    mkdirSync(dirname(path), { recursive: true });
    rmSync(path, { force: true });
  }
  const server = createServer((socket) => {
    let buffer = "";
    socket.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines.filter(Boolean)) {
        const respond = async (): Promise<void> => {
          socket.write(`${JSON.stringify(await answer(line, handle))}\n`);
        };
        void respond();
      }
    });
  });
  server.listen(path);
  process.env[BRIDGE_ENV] = path;
  if (!pipe) process.on("exit", () => rmSync(path, { force: true }));
  return server;
}
