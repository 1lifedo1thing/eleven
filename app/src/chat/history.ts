import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { rememberProject } from "../engine/project";
import { prepareTarget } from "../engine/target";
import { z } from "zod";

import { isRecord } from "../lib/guards";
import { readOr } from "../lib/schema";
import { supportPath } from "../lib/support";
import type { Message } from "./thread";

const THREADS = supportPath("threads");
const MESSAGE_KINDS = new Set(["user", "agent", "permission", "note"]);

export type SavedThread = {
  readonly id: string;
  readonly title: string;
  readonly target: string | null;
  /** The project (app or binary) this chat belongs to; null while it has no file. */
  readonly project: string | null;
  readonly messages: readonly Message[];
  readonly updatedAt: number;
  /** The name you gave the thread; the first message names it until then. */
  readonly named?: string;
};

export type ThreadSummary = Omit<SavedThread, "messages">;

function file(id: string): string {
  return join(THREADS, `${id}.json`);
}

function isMessage(value: unknown): value is Message {
  return isRecord(value) && typeof value.kind === "string" && MESSAGE_KINDS.has(value.kind);
}

/** A thread saved mid-turn can't resume that turn, so it reopens as stopped. */
function settle(message: Message): Message {
  if (message.kind === "agent" && message.outcome === "running") return { ...message, outcome: "cancelled", endedAt: message.endedAt ?? message.startedAt };
  if (message.kind === "permission" && message.state.kind === "pending") return { ...message, state: { kind: "answered", label: "No answer" } };
  return message;
}

/** Chats saved before projects existed get the project of their file, or none if the file is gone. */
function projectOf(target: string, at: number): string | null {
  try {
    return rememberProject(prepareTarget(target), at);
  } catch {
    return null;
  }
}

/** `project` is undefined in chats saved before projects existed. */
const SAVED = z.object({
  id: z.string(),
  title: z.string(),
  target: z.string().nullable().catch(null),
  project: z.string().nullable().optional().catch(undefined),
  messages: z.array(z.unknown()).transform((messages) => messages.filter(isMessage).map(settle)),
  updatedAt: z.number(),
  named: z.string().catch(""),
});

function parse(json: unknown): { readonly thread: SavedThread; readonly migrated: boolean } | null {
  const saved = readOr(SAVED, json, null);
  if (!saved) return null;
  const { project, named, ...rest } = saved;
  const migrated = project === undefined;
  const owner = project ?? (migrated && rest.target ? projectOf(rest.target, rest.updatedAt) : null);
  const thread = { ...rest, project: owner };
  return { thread: named ? { ...thread, named } : thread, migrated };
}

export function loadThread(id: string): SavedThread | null {
  try {
    const parsed = parse(JSON.parse(readFileSync(file(id), "utf8")));
    if (parsed?.migrated) writeFileSync(file(id), `${JSON.stringify(parsed.thread)}\n`);
    return parsed?.thread ?? null;
  } catch {
    return null;
  }
}

export function listThreads(): readonly ThreadSummary[] {
  try {
    return readdirSync(THREADS)
      .filter((name) => name.endsWith(".json"))
      .flatMap((name) => {
        const saved = loadThread(name.slice(0, -5));
        return saved ? [{ id: saved.id, title: saved.named ?? saved.title, target: saved.target, project: saved.project, updatedAt: saved.updatedAt }] : [];
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

type Listener = () => void;

const listeners = new Set<Listener>();

function write(thread: SavedThread): void {
  try {
    mkdirSync(THREADS, { recursive: true });
    writeFileSync(file(thread.id), `${JSON.stringify(thread)}\n`);
  } catch {
    return;
  }
  for (const listener of listeners) listener();
}

/** Saves a thread, keeping any name you gave it. A chat stays in the first project it joined. */
export function saveThread(thread: SavedThread): void {
  const saved = loadThread(thread.id);
  const kept = { ...thread, project: saved?.project ?? thread.project };
  write(saved?.named ? { ...kept, named: saved.named } : kept);
}

export function renameThread(id: string, name: string): void {
  const saved = loadThread(id);
  if (saved) write({ ...saved, named: name.trim() });
}

export function deleteThread(id: string): void {
  try {
    rmSync(file(id), { force: true });
  } catch {
    return;
  }
  for (const listener of listeners) listener();
}

export function onThreadsChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
