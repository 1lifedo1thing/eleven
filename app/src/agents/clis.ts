/** The agent's own command-line tool, for the agents that ship one. Eleven runs these through their ACP adapter. */
export const AGENT_CLI: Readonly<Record<string, string>> = {
  "claude-acp": "claude",
  "codex-acp": "codex",
  gemini: "gemini",
  opencode: "opencode",
  goose: "goose",
};
