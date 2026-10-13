import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { findOnPath, type NativeCommand } from "../agents/detect";
import { binaryInstalled, readyToRun, resolveLaunch } from "../agents/launch";
import type { AgentEntry } from "../agents/registry";

const HOME = homedir();

type Login = {
  readonly signedIn: () => boolean;
  readonly cli: string;
  readonly args: readonly string[];
  readonly npx: string | null;
  readonly logout?: readonly string[];
};

function hasFile(...parts: readonly string[]): boolean {
  return existsSync(join(HOME, ...parts));
}

function fileHas(text: string, ...parts: readonly string[]): boolean {
  try {
    return readFileSync(join(HOME, ...parts), "utf8").includes(text);
  } catch {
    return false;
  }
}

const LOGINS: Readonly<Record<string, Login>> = {
  "claude-acp": { signedIn: () => Boolean(process.env.ANTHROPIC_API_KEY) || fileHas("oauthAccount", ".claude.json"), cli: "claude", args: ["/login"], logout: ["/logout"], npx: "@anthropic-ai/claude-code" },
  "codex-acp": { signedIn: () => Boolean(process.env.OPENAI_API_KEY) || hasFile(".codex", "auth.json"), cli: "codex", args: ["login"], logout: ["logout"], npx: "@openai/codex" },
  gemini: { signedIn: () => Boolean(process.env.GEMINI_API_KEY) || hasFile(".gemini", "oauth_creds.json"), cli: "gemini", args: [], npx: "@google/gemini-cli" },
  opencode: { signedIn: () => hasFile(".local", "share", "opencode", "auth.json"), cli: "opencode", args: ["auth", "login"], logout: ["auth", "logout"], npx: "opencode-ai" },
  goose: { signedIn: () => hasFile(".config", "goose", "config.yaml"), cli: "goose", args: ["configure"], npx: null },
};

export type AgentStatus =
  | { readonly kind: "ready"; readonly detail: string }
  | { readonly kind: "install" }
  | { readonly kind: "installing" }
  | { readonly kind: "failed" }
  | { readonly kind: "signin" }
  | { readonly kind: "unavailable"; readonly detail: string };

function loginCommand(login: Login): string | null {
  if (findOnPath(login.cli)) return [login.cli, ...login.args].join(" ");
  if (login.npx && findOnPath("npx")) return ["npx", "-y", login.npx, ...login.args].join(" ");
  return null;
}

function missingDetail(agent: AgentEntry): string {
  switch (agent.distribution.kind) {
    case "npx":
      return "Needs Node.js, which isn't on this Mac";
    case "uvx":
      return "Needs uv, which isn't on this Mac";
    case "binary":
    case "command":
      return "Not found on this Mac";
    default: {
      const unhandled: never = agent.distribution;
      return unhandled;
    }
  }
}

export type AgentFacts = { readonly native: NativeCommand | null; readonly downloaded: boolean; readonly installing: boolean; readonly failed: boolean };

export function agentStatus(agent: AgentEntry, facts: AgentFacts): AgentStatus {
  if (facts.installing) return { kind: "installing" };
  if (agent.distribution.kind === "binary" && !facts.native && !facts.downloaded) return facts.failed ? { kind: "failed" } : { kind: "install" };
  if (!readyToRun(agent, facts.native)) return { kind: "unavailable", detail: missingDetail(agent) };
  const login = LOGINS[agent.id];
  const where = facts.native ? "On this Mac" : null;
  if (!login) return { kind: "ready", detail: where ?? "Ready" };
  if (login.signedIn()) return { kind: "ready", detail: where ? `${where}, signed in` : "Signed in" };
  return loginCommand(login) ? { kind: "signin" } : { kind: "ready", detail: where ?? "Ready" };
}

export function agentDetail(status: AgentStatus): string {
  switch (status.kind) {
    case "ready":
    case "unavailable":
      return status.detail;
    case "install":
      return "Not installed";
    case "installing":
      return "Installing";
    case "failed":
      return "The download stopped. Check your connection, then try again.";
    case "signin":
      return "Installed. Sign in to use it.";
  }
}

export async function downloaded(agent: AgentEntry): Promise<boolean> {
  return binaryInstalled(agent);
}

export async function installAgent(agent: AgentEntry): Promise<void> {
  await resolveLaunch(agent, null);
}

/** Whether the agent is signed in, or null when Eleven doesn't know how to tell. */
export function signedIn(agent: AgentEntry): boolean | null {
  return LOGINS[agent.id]?.signedIn() ?? null;
}

export function canSignOut(agent: AgentEntry): boolean {
  return LOGINS[agent.id]?.logout !== undefined;
}

/** Opens Terminal on the agent's own login command; it signs in there and comes back. */
export function signIn(agent: AgentEntry): void {
  const login = LOGINS[agent.id];
  runInTerminal(login ? loginCommand(login) : null);
}

export function signOut(agent: AgentEntry): void {
  const login = LOGINS[agent.id];
  runInTerminal(login?.logout ? loginCommand({ ...login, args: login.logout }) : null);
}

function runInTerminal(command: string | null): void {
  if (!command) return;
  execFile("osascript", ["-e", `tell application "Terminal" to do script "${command}"`, "-e", 'tell application "Terminal" to activate'], () => undefined);
}
