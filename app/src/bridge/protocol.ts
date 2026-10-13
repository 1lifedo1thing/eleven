import { homedir } from "node:os";
import { join } from "node:path";

export const BRIDGE_ENV = "ELEVEN_BRIDGE";

export const AGENT_ENV = "ELEVEN_AGENT";

export const CHAT_ENV = "ELEVEN_CHAT";

export const ELEVEN_SERVER = "eleven";

export type BridgeTool = "open_function" | "current_view" | "set_view" | "rename_function" | "add_note" | "add_comment" | "bookmark" | "propose_patch" | "set_code_type" | "set_number_format" | "list_marks" | "gpu_profile";

/** Which agent, in which chat, sent a request. */
export type BridgeCaller = { readonly agent: string; readonly chat: string | null };

export type BridgeRequest = { readonly id: number; readonly tool: BridgeTool; readonly args: Readonly<Record<string, string>>; readonly from: BridgeCaller };

export type BridgeReply = { readonly id: number; readonly ok: true; readonly text: string } | { readonly id: number; readonly ok: false; readonly error: string };

export function bridgePath(): string {
  return join(homedir(), "Library", "Caches", "eleven", `bridge-${process.pid}.sock`);
}

const TOOLS: readonly BridgeTool[] = ["open_function", "current_view", "set_view", "rename_function", "add_note", "add_comment", "bookmark", "propose_patch", "set_code_type", "set_number_format", "list_marks", "gpu_profile"];

export function isBridgeTool(value: unknown): value is BridgeTool {
  return TOOLS.some((tool) => tool === value);
}
