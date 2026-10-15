import * as acp from "@agentclientprotocol/sdk";

import { toWebReadable, toWebWritable } from "../../src/lib/streams";

const current: Record<string, string> = { model: "default", effort: "medium" };

function options(): acp.SessionConfigOption[] {
  return [
    { type: "select", id: "model", name: "Model", category: "model", currentValue: current.model ?? "", options: [{ value: "default", name: "Default" }, { value: "opus", name: "Opus" }] },
    { type: "select", id: "effort", name: "Effort", category: "thought_level", currentValue: current.effort ?? "", options: [{ value: "medium", name: "Medium" }, { value: "high", name: "High" }] },
  ];
}

const stream = acp.ndJsonStream(toWebWritable(process.stdout), toWebReadable(process.stdin));
new acp.AgentSideConnection((conn) => ({
  initialize: async () => ({ protocolVersion: acp.PROTOCOL_VERSION, agentCapabilities: {} }),
  authenticate: async () => ({}),
  newSession: async () => ({ sessionId: "s1", configOptions: options() }),
  setSessionConfigOption: async ({ configId, value }) => {
    if (typeof value === "string") current[configId] = value;
    return { configOptions: options() };
  },
  prompt: async ({ sessionId }) => {
    await conn.sessionUpdate({ sessionId, update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: `model=${current.model} effort=${current.effort}` } } });
    return { stopReason: "end_turn" };
  },
  cancel: async () => undefined,
}), stream);
