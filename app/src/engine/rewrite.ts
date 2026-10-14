import { createHash, randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { engineHint } from "../analysis/hint";
import { doing } from "../agents/describe";
import type { NativeCommand } from "../agents/detect";
import { isReadOnly } from "../agents/permissions";
import type { AgentEntry } from "../agents/registry";
import { AgentSession } from "../agents/session";
import { cacheRoot } from "../lib/platform";
import { CODE_LANGUAGES, type CodeLanguage } from "../settings/store";

export type RewriteLanguage = Exclude<CodeLanguage, "Pseudocode">;

const REWRITE_LANGUAGES = CODE_LANGUAGES.filter((language): language is RewriteLanguage => language !== "Pseudocode");

/** Everything Eleven knows about one function, handed to the agent so the rewrite isn't a guess from the pseudocode alone. */
export type RewriteRequest = {
  readonly language: RewriteLanguage;
  readonly agent: AgentEntry;
  readonly native: NativeCommand | null;
  readonly projectId: string;
  readonly binary: { readonly path: string; readonly name: string; readonly arch: string };
  readonly fn: { readonly name: string; readonly addr: string };
  readonly pseudocode: string;
  readonly callers: readonly string[];
  readonly callees: readonly string[];
  readonly notes: readonly string[];
};

const FENCE: Readonly<Record<RewriteLanguage, string>> = { C: "c", "C++": "cpp", Rust: "rust", Go: "go", Swift: "swift", Python: "python", TypeScript: "typescript", Java: "java", "C#": "csharp", Zig: "zig" };
const MAX_NAMES = 40;

function listed(label: string, names: readonly string[]): readonly string[] {
  if (names.length === 0) return [];
  const shown = names.slice(0, MAX_NAMES).join(", ");
  return [`${label}: ${shown}${names.length > MAX_NAMES ? `, and ${names.length - MAX_NAMES} more` : ""}`];
}

/** A rewrite of the same function already done in another language, which the next one translates from. */
export type Earlier = { readonly language: RewriteLanguage; readonly code: string };

/** First time: read around the function and rewrite it. With an earlier rewrite: translate that, which skips the reading. */
export function rewritePrompt(req: RewriteRequest, earlier: Earlier | null = null): string {
  const context = earlier
    ? [
      `You already rewrote it in ${earlier.language} after reading the code around it. Translate that version: keep its names, types and structure, and use ${req.language}'s own idioms. You shouldn't need to read anything else; check the pseudocode below only where the ${earlier.language} version leaves something unclear.`,
      "",
      `\`\`\`${FENCE[earlier.language]}`,
      earlier.code,
      "```",
    ]
    : [
      engineHint(req.binary.path, req.binary.arch),
      "Read whatever helps you get it right: the functions it calls, its callers, the strings and data it touches. Only read; don't rename, comment or patch anything.",
    ];
  return [
    `Rewrite the decompiled function ${req.fn.name} (at ${req.fn.addr}) as idiomatic ${req.language}.`,
    "",
    `It comes from ${req.binary.name} (${req.binary.arch}), at ${req.binary.path}.`,
    ...context,
    "",
    ...listed("Called by", req.callers),
    ...listed("Calls", req.callees),
    ...req.notes.map((note) => `Note from the user: ${note}`),
    "",
    "Keep the behavior exactly. Give variables, types and helpers meaningful names when the code makes them clear, and keep unknown calls as calls by their current names. Use the language's normal types and error handling instead of raw pointers where that is safe.",
    `Reply with one \`\`\`${FENCE[req.language]} code block holding the whole rewrite, and nothing else.`,
    "",
    "The pseudocode:",
    "```c",
    req.pseudocode,
    "```",
  ].join("\n");
}

const OPEN_FENCE = /```[\w+#-]*[ \t]*\n/;
/** A closing fence sits alone on its line, so a ``` inside a doc comment or string doesn't end the code. */
const CLOSE_FENCE = /^```[ \t]*$/m;

/** The code written so far while the reply is still arriving; null until the code block opens. */
export function codeSoFar(reply: string): string | null {
  const open = OPEN_FENCE.exec(reply);
  if (!open) return null;
  const rest = reply.slice(open.index + open[0].length);
  const close = CLOSE_FENCE.exec(rest);
  return close ? rest.slice(0, close.index) : rest;
}

/** The code inside the reply's fenced block, or the whole reply when the agent left the fence out. */
export function codeFrom(reply: string): string {
  return (codeSoFar(reply) ?? reply).replace(/\s+$/, "");
}

/** What the agent is doing while it works: the step it's on, and the code it has written so far. */
export type RewriteProgress = { readonly step: string | null; readonly code: string | null; readonly reply: string };

/** Who answers a quiet prompt, and the binary its session opens in. */
export type QuietAsk = Pick<RewriteRequest, "agent" | "native" | "projectId"> & { readonly binary: { readonly path: string } };

/** One prompt in a session nobody sees: the reply's text comes back, then the session stops. */
export function askQuietly(req: QuietAsk, prompt: string, onProgress: (progress: RewriteProgress) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    let reply = "";
    let step: string | null = null;
    const session: AgentSession = new AgentSession(req.agent, req.native, dirname(req.binary.path), (event) => {
      switch (event.kind) {
        case "text":
          reply += event.text;
          onProgress({ step, code: codeSoFar(reply), reply });
          return;
        case "step":
          if (event.status === "running") {
            step = doing(event.tool, event.input);
            onProgress({ step, code: codeSoFar(reply), reply });
          }
          return;
        case "permission":
          session.answer(event.id, isReadOnly(event.tool) ? (event.choices.find((choice) => choice.allows)?.id ?? null) : null);
          return;
        case "turnEnded":
          session.stop();
          if (reply.trim()) resolve(reply);
          else reject(new Error(`${req.agent.name} didn't send anything back.`));
          return;
        case "failed":
          session.stop();
          reject(new Error(event.reason));
          return;
        default:
          return;
      }
    }, `quiet-${randomUUID()}`, req.projectId, req.binary.path);
    void (async (): Promise<void> => {
      try {
        await session.prompt(prompt);
      } catch (err) {
        session.stop();
        reject(err);
      }
    })();
  });
}

const running = new Map<string, Promise<string>>();
const LANGUAGE_OF: ReadonlyMap<string, RewriteLanguage> = new Map(Object.entries(FENCE).flatMap(([language, fence]) => {
  const known = REWRITE_LANGUAGES.find((candidate) => candidate === language);
  return known ? [[fence, known] as const] : [];
}));

/** One folder per function (and its pseudocode and note), holding every language each agent wrote it in. */
function functionDir(req: RewriteKey): string {
  const key = createHash("sha256").update(JSON.stringify([req.fn.addr, req.pseudocode, req.notes])).digest("hex");
  return join(cacheRoot(), "rewrites", req.projectId, key);
}

/** What a saved rewrite is keyed by: everything but the callers and callees, which take the engine to look up. */
export type RewriteKey = Pick<RewriteRequest, "projectId" | "agent" | "language" | "fn" | "pseudocode" | "notes">;

function cacheFile(req: RewriteKey): string {
  return join(functionDir(req), `${req.agent.id}.${FENCE[req.language]}.txt`);
}

/** A rewrite saved earlier, read straight from disk with no agent and no engine call; null when there's none. */
export async function savedRewrite(key: RewriteKey): Promise<string | null> {
  try {
    return await readFile(cacheFile(key), "utf8");
  } catch {
    return null;
  }
}

/** The most recent rewrite of this function in another language, if there is one. */
async function earlierRewrite(req: RewriteRequest): Promise<Earlier | null> {
  const dir = functionDir(req);
  let names: readonly string[];
  try {
    names = await readdir(dir);
  } catch {
    return null;
  }
  const others = await Promise.all(names.flatMap((name) => {
    const language = LANGUAGE_OF.get(name.split(".").at(-2) ?? "");
    return language && language !== req.language ? [(async () => ({ language, file: join(dir, name), at: (await stat(join(dir, name))).mtimeMs }))()] : [];
  }));
  const newest = others.sort((a, b) => b.at - a.at)[0];
  return newest ? { language: newest.language, code: await readFile(newest.file, "utf8") } : null;
}

async function rewriteFresh(req: RewriteRequest, file: string, onProgress: (progress: RewriteProgress) => void): Promise<string> {
  const code = codeFrom(await askQuietly(req, rewritePrompt(req, await earlierRewrite(req)), onProgress));
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, code);
  return code;
}

/** The function rewritten in `language` by the chosen agent; saved, so reopening it is instant. */
export async function rewrite(req: RewriteRequest, onProgress: (progress: RewriteProgress) => void = () => {}): Promise<string> {
  const file = cacheFile(req);
  try {
    return await readFile(file, "utf8");
  } catch {
    const pending = running.get(file) ?? rewriteFresh(req, file, onProgress);
    running.set(file, pending);
    try {
      return await pending;
    } finally {
      running.delete(file);
    }
  }
}

/** Throws away a saved rewrite so the next look asks the agent again. */
export async function forgetRewrite(req: RewriteKey): Promise<void> {
  await rm(cacheFile(req), { force: true });
}
