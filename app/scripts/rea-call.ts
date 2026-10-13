import { Client } from "@modelcontextprotocol/sdk/client/index.js";

import { adoptLoginShell } from "../src/agents/detect";
import { reaTransport } from "../src/engine/rea";
import { adoptToolchain } from "../src/engine/toolchain";

await adoptLoginShell();
adoptToolchain();
const [path, ...calls] = process.argv.slice(2);
const client = new Client({ name: "call", version: "0" });
await client.connect(reaTransport());
const options = { timeout: 600_000 } as const;
await client.callTool({ name: "open_binary", arguments: { path, provider_id: "ghidra" } }, undefined, options);
for (const call of calls) {
  const [name = "", json = "{}"] = call.split("=", 2);
  const reply = await client.callTool({ name, arguments: JSON.parse(json) }, undefined, options);
  const normalized = typeof reply.structuredContent === "object" && reply.structuredContent !== null && "normalized_result" in reply.structuredContent ? reply.structuredContent.normalized_result : reply.content;
  console.log(`== ${name}`, JSON.stringify(normalized, null, 1).slice(0, 1500));
}
await client.close();
process.exit(0);
