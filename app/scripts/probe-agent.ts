import { describe } from "../src/agents/describe";
import type { AgentEvent } from "../src/agents/events";
import { adoptLoginShell, detectInstalled } from "../src/agents/detect";
import { loadAgents } from "../src/agents/registry";
import { adoptToolchain } from "../src/engine/toolchain";
import { AgentSession } from "../src/agents/session";

const [agentId = "claude-acp", binary] = process.argv.slice(2);
if (!binary) throw new Error("usage: bun scripts/probe-agent.ts <agent-id> <binary>");
await adoptLoginShell();
adoptToolchain();
const agents = await loadAgents();
const agent = agents.find((a) => a.id === agentId);
if (!agent) throw new Error(`unknown agent ${agentId}; known: ${agents.map((a) => a.id).join(", ")}`);
const native = (await detectInstalled(agents)).get(agent.id)?.command ?? null;
console.log(`[launch] ${agent.name} ${native ? `native ${native.path}` : agent.distribution.kind}`);

const done = Promise.withResolvers<void>();
const session = new AgentSession(agent, native, process.cwd(), (event: AgentEvent): void => {
  switch (event.kind) {
    case "connected": console.log(`[connected] ${event.agent}`); return;
    case "text": process.stdout.write(event.text); return;
    case "step": if (event.status !== "running") console.log(`[${event.status}] ${describe(event.tool, event.input)}`); return;
    case "permission": console.log(`[asks] ${event.tool}`); session.answer(event.id, event.choices[0]?.id ?? null); return;
    case "turnEnded": console.log("\n[turn ended]"); done.resolve(); return;
    case "failed": console.log(`\n[failed] ${event.reason}`); done.resolve(); return;
    case "thought": return;
    case "plan": console.log(`[plan] ${event.items.map((i) => `${i.status}:${i.content}`).join(" | ")}`); return;
    case "commands": console.log(`[commands] ${event.commands.map((c) => c.name).join(", ")}`); return;
    case "options": console.log(`[options] ${event.options.map((o) => `${o.category}=${o.current} (${o.choices.length})`).join(", ")}`); return;
    case "usage": console.log(`[usage] ${event.usage.used}/${event.usage.size}`); return;
  }
}, "probe");
await session.prompt(`Use the eleven-rea tools: open_binary ${binary} with provider_id "ghidra", read the pseudocode of its entry function, and say in one sentence what it does.`);
await done.promise;
session.stop();
