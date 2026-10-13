import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";

import { isRecord } from "../lib/guards";
import { createOnigScanner, createOnigString, loadWASM } from "../../vendor/oniguruma/main.js";
import { EncodedTokenMetadata, type IGrammar, INITIAL, type IRawGrammar, type IRawTheme, type IRawThemeSetting, Registry, type StateStack } from "../../vendor/textmate/index.js";

/** [start, end, color] for one run of text in one color. */
export type WireSpan = readonly [number, number, string];

export type Look = "dark" | "light";

const THEMES: Readonly<Record<Look, string>> = { dark: "one-dark-pro.json", light: "one-light.json" };
const GRAMMARS: Readonly<Record<string, string>> = { "source.cpp": "cpp.json", "source.cpp.embedded.macro": "cpp-macro.json" };
const LINE_MS = 200;

function vendorDir(): string {
  const bundled = join(dirname(process.execPath), "..", "Resources", "vendor");
  return existsSync(bundled) ? bundled : join(import.meta.dir, "..", "..", "vendor");
}

function readJson(...parts: readonly string[]): unknown {
  return JSON.parse(readFileSync(join(vendorDir(), ...parts), "utf8"));
}

function isRawGrammar(value: unknown): value is IRawGrammar {
  return isRecord(value) && typeof value.scopeName === "string" && Array.isArray(value.patterns);
}

function themeSetting(value: unknown): readonly IRawThemeSetting[] {
  if (!isRecord(value) || !isRecord(value.settings)) return [];
  const { foreground, fontStyle } = value.settings;
  const scope = typeof value.scope === "string" || Array.isArray(value.scope) ? value.scope.toString() : undefined;
  return [{ ...(scope ? { scope } : {}), settings: { ...(typeof foreground === "string" ? { foreground } : {}), ...(typeof fontStyle === "string" ? { fontStyle } : {}) } }];
}

/** A VS Code theme file as the engine wants it: the editor's own colors first, then every token rule. */
function rawTheme(look: Look): IRawTheme {
  const json = readJson("themes", THEMES[look]);
  const colors = isRecord(json) && isRecord(json.colors) ? json.colors : {};
  const foreground = typeof colors["editor.foreground"] === "string" ? colors["editor.foreground"] : undefined;
  const background = typeof colors["editor.background"] === "string" ? colors["editor.background"] : undefined;
  const rules = isRecord(json) && Array.isArray(json.tokenColors) ? json.tokenColors.flatMap(themeSetting) : [];
  return { settings: [{ settings: { ...(foreground ? { foreground } : {}), ...(background ? { background } : {}) } }, ...rules] };
}

type Painter = { readonly grammar: IGrammar; readonly colors: readonly string[] };

function painter(look: Look): Painter {
  const registry = new Registry({
    onigLib: { createOnigScanner, createOnigString },
    loadGrammar: (scope) => {
      const file = GRAMMARS[scope];
      const json = file ? readJson("grammars", file) : null;
      return isRawGrammar(json) ? json : null;
    },
  });
  registry.setTheme(rawTheme(look));
  const grammar = registry.loadGrammar("source.cpp");
  if (!grammar) throw new Error("The C++ grammar didn't load.");
  return { grammar, colors: registry.getColorMap() };
}

/** The grammar colors a hex prefix apart from its digits; one number should read as one color. */
function joinHexPrefix(line: string, spans: readonly WireSpan[]): readonly WireSpan[] {
  return spans.map((span, ix) => {
    const next = spans[ix + 1];
    return next && next[0] === span[1] && /^0[xX]$/.test(line.slice(span[0], span[1])) ? [span[0], span[1], next[2]] : span;
  });
}

/** TextMate state carries from line to line, so a whole function is painted in order. */
function paint(source: Painter, lines: readonly string[]): readonly (readonly WireSpan[])[] {
  let state: StateStack = INITIAL;
  return lines.map((line) => {
    const result = source.grammar.tokenizeLine2(line, state, LINE_MS);
    state = result.ruleStack;
    const spans: WireSpan[] = [];
    for (let ix = 0; ix < result.tokens.length; ix += 2) {
      const start = result.tokens[ix] ?? 0;
      const end = result.tokens[ix + 2] ?? line.length;
      const color = source.colors[EncodedTokenMetadata.getForeground(result.tokens[ix + 1] ?? 0)];
      if (end > start && color) spans.push([start, end, color]);
    }
    return joinHexPrefix(line, spans);
  });
}

function isLook(value: unknown): value is Look {
  return value === "dark" || value === "light";
}

/**
 * Runs as `--eleven-highlight`: one JSON request per stdin line, one reply per stdout line.
 * The grammar's regex engine is WebAssembly, and Bun can crash when JavaScriptCore's Wasm
 * compiler threads exit, so it lives in this process and the window just restarts it.
 */
export async function runHighlighter(): Promise<void> {
  await loadWASM(readFileSync(join(vendorDir(), "oniguruma", "onig.wasm")));
  const painters: Readonly<Record<Look, Painter>> = { dark: painter("dark"), light: painter("light") };
  for await (const line of createInterface({ input: process.stdin })) {
    const request: unknown = JSON.parse(line);
    if (!isRecord(request) || typeof request.id !== "number" || !isLook(request.look) || !Array.isArray(request.lines)) continue;
    const lines = request.lines.map((text) => (typeof text === "string" ? text : ""));
    process.stdout.write(`${JSON.stringify({ id: request.id, spans: paint(painters[request.look], lines) })}\n`);
  }
}
