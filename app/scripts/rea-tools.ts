import { Client } from "@modelcontextprotocol/sdk/client/index.js";

import { adoptLoginShell } from "../src/agents/detect";
import { reaTransport } from "../src/engine/rea";
import { adoptToolchain } from "../src/engine/toolchain";

await adoptLoginShell();
adoptToolchain();
const client = new Client({ name: "tools", version: "0" });
await client.connect(reaTransport());
const { tools } = await client.listTools();
const names = tools.map((tool) => tool.name).sort();
console.log(names.join(" "));
await client.close();
process.exit(0);
