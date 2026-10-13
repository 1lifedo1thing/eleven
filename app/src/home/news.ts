import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { isRecord } from "../lib/guards";
import { supportPath } from "../lib/support";
import type { Page } from "../settings/pages";

/** The picture at the top of a card: logos (paths under assets), or a screenshot from assets/news. */
export type NewsArt =
  | { readonly kind: "logos"; readonly files: readonly string[] }
  | { readonly kind: "shot"; readonly file: string };

/** What the card's button does: the agent hookup Home already wires, a Settings page, or nothing. */
export type NewsAction =
  | { readonly kind: "agents"; readonly label: string }
  | { readonly kind: "settings"; readonly label: string; readonly page: Page }
  | { readonly kind: "none" };

export type News = {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly art: NewsArt;
  readonly action: NewsAction;
};

/** Newest first; the card opens on the first one. */
export const NEWS: readonly News[] = [
  {
    id: "agents-first",
    title: "Your agents work in the code",
    body: "The workbench now opens on your agents. Run more than one on the same app, and each keeps its own chat next to the code.",
    art: { kind: "logos", files: ["agents/claude-acp.svg", "news/codex.svg", "agents/gemini.svg", "agents/cursor.svg"] },
    action: { kind: "agents", label: "Connect an agent" },
  },
  {
    id: "agents-ask-first",
    title: "Agents suggest, you decide",
    body: "When an agent wants to rename something or patch bytes, it asks you first. Anything you accept can be undone with ⌘Z.",
    art: { kind: "shot", file: "permissions.png" },
    action: { kind: "settings", label: "Choose what agents can do", page: "permissions" },
  },
  {
    id: "rizin-first",
    title: "Apps open in seconds",
    body: "Eleven now reads with Rizin first, so most apps open in a few seconds and there's no Java to install. Ghidra is still there for its deeper pseudocode.",
    art: { kind: "shot", file: "engines.png" },
    action: { kind: "settings", label: "Engine settings", page: "engines" },
  },
  {
    id: "eleven-projects",
    title: "Every app is a project",
    body: "Each app gets its own .eleven file in Documents/Eleven. Your chats, renames, notes and patches are all there when you open it again.",
    art: { kind: "shot", file: "projects.png" },
    action: { kind: "none" },
  },
];

export const LATEST_NEWS: News = NEWS[0] ?? {
  id: "none",
  title: "",
  body: "",
  art: { kind: "logos", files: ["agents/claude-acp.svg", "news/codex.svg", "agents/gemini.svg", "agents/cursor.svg"] },
  action: { kind: "none" },
};

function dismissed(): readonly string[] {
  try {
    const json: unknown = JSON.parse(readFileSync(supportPath("news.json"), "utf8"));
    if (!isRecord(json) || !Array.isArray(json.dismissed)) return [];
    return json.dismissed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export function isNewsDismissed(id: string): boolean {
  return dismissed().includes(id);
}

export function dismissNews(id: string): void {
  try {
    const file = supportPath("news.json");
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify({ dismissed: [...dismissed().filter((seen) => seen !== id), id] }, null, 2)}\n`);
  } catch {
    return;
  }
}
