import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const app = process.argv[2] ?? "build/Eleven.app";
const client = new Client({ name: "bundle-check", version: "0" });
await client.connect(new StdioClientTransport({ command: `${app}/Contents/MacOS/Eleven`, args: ["--eleven-mcp"], env: { HOME: process.env.HOME ?? "", PATH: "/usr/bin:/bin" }, stderr: "inherit" }));
const { tools } = await client.listTools();
console.log(`bundled eleven-mcp serves ${tools.length} tools: ${tools.map((t) => t.name).join(", ")}`);
await client.close();
process.exit(0);
