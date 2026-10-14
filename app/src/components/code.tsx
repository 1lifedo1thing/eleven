import type { ReactElement } from "react";

import { type Syntax as Colors, syntaxFor, useCodeLook } from "../settings/look";
import { useSettings } from "../settings/store";
import { type Palette, useTheme } from "../theme";
import type { Span } from "./highlight";

export type Syntax = "c" | "asm" | "code" | "ptx";

type Part =
  | { readonly kind: "text"; readonly text: string; readonly color: string }
  | { readonly kind: "link"; readonly text: string };

type Role = "comment" | "string" | "keyword" | "type" | "link" | "call" | "scope" | "data" | "number" | "address" | "mnemonic" | "register" | "label" | "predicate" | "variable" | "memory";

const C_KEYWORDS = "if|else|while|do|for|return|goto|break|continue|switch|case|default|sizeof|struct|union|enum|typedef|const|unsigned|signed|volatile|static|extern|true|false|NULL|self|super|nil";
const JAVA_KEYWORDS = "package|import|public|private|protected|class|interface|extends|implements|final|abstract|native|synchronized|transient|new|this|throws|throw|try|catch|finally|instanceof|null";
const C_TYPES = "void|int|uint|char|uchar|long|ulong|longlong|ulonglong|short|ushort|byte|bool|BOOL|float|double|size_t|ssize_t|undefined\\d*|code|ID|SEL|Class|class_t|IMP|NSInteger|NSUInteger|CGFloat|u?int\\d+_t|wchar_t|FILE|FTS|FTSENT|uid_t|gid_t|pid_t|off_t|dword|qword|word";

/** Ghidra's C: calls and their Class:: scopes, Objective-C and Ghidra types, globals by prefix. Order matters: earlier wins. */
const C_RULES: readonly (readonly [Role, string])[] = [
  ["comment", "\\/\\*.*?(?:\\*\\/|$)|\\/\\/.*$"],
  ["string", "\"(?:[^\"\\\\]|\\\\.)*\"|'(?:[^'\\\\]|\\\\.)*'"],
  ["keyword", `\\b(?:${C_KEYWORDS}|${JAVA_KEYWORDS})\\b`],
  ["type", `\\b(?:${C_TYPES})\\b`],
  ["link", "\\bFUN_[0-9a-fA-F]+\\b"],
  ["call", "(?:\\b\\w+::)*~?\\b\\w+(?=\\s*\\()"],
  ["scope", "\\b\\w+(?=::)"],
  ["type", "(?<=::)[A-Z]\\w*"],
  ["call", "(?<=::)~?[a-z_]\\w*"],
  ["data", "\\b(?:DAT|PTR|LAB|switchD|caseD|s|u)_\\w+|\\b_?OBJC_\\w+"],
  ["number", "\\b(?:0x[0-9a-fA-F]+|\\d+(?:\\.\\d+)?)[uUlLfF]*\\b"],
  ["type", "\\b[A-Z]\\w*(?=\\s*\\*|\\s+\\**[A-Za-z_]\\w*\\s*[;,=)\\[])"],
];

const CODE_KEYWORDS = "fn|let|mut|pub|use|mod|impl|trait|struct|enum|match|if|else|while|for|loop|in|return|break|continue|where|as|ref|move|async|await|dyn|unsafe|crate|self|Self|super|const|static|type|func|go|defer|chan|select|package|import|var|range|interface|map|def|class|lambda|with|yield|from|pass|elif|not|and|or|is|None|True|False|try|catch|except|finally|raise|throw|throws|new|this|null|nil|true|false|guard|init|deinit|extension|protocol|public|private|internal|fileprivate|override|final|open|inout|some|any|export|function|undefined|readonly|namespace|using|void|virtual|sealed|partial|switch|case|default|do|comptime|errdefer|orelse|test";
/** Keywords that take parentheses but aren't calls. */
const CODE_CONTROL = "if|elif|while|for|match|switch|return|catch|except|guard|sizeof|typeof|await|yield|not|and|or|in|with|assert";
const CODE_TYPES = "i8|i16|i32|i64|i128|isize|u8|u16|u32|u64|u128|usize|f32|f64|bool|char|str|int|uint|float|double|long|short|byte|rune|string|number|boolean|object|bigint";

/** Modern languages a rewrite can be in: shared keywords, capitalized names as types, calls and macros. Order matters: earlier wins. */
const CODE_RULES: readonly (readonly [Role, string])[] = [
  ["comment", "\\/\\*.*?(?:\\*\\/|$)|\\/\\/.*$|#(?![\\[!]).*$"],
  ["string", "\"(?:[^\"\\\\]|\\\\.)*\"|'(?:[^'\\\\]|\\\\.)*'|`(?:[^`\\\\]|\\\\.)*`"],
  ["call", `\\b(?!(?:${CODE_CONTROL})\\b)[a-z_]\\w*!?(?=\\s*\\()|\\b[a-z_]\\w*!(?=\\s*[\\[{])`],
  ["keyword", `\\b(?:${CODE_KEYWORDS})\\b`],
  ["type", `\\b(?:${CODE_TYPES})\\b|\\b[A-Z]\\w*`],
  ["number", "\\b(?:0x[0-9a-fA-F_]+|\\d[\\d_]*(?:\\.\\d+)?)(?:[iuf]\\d+|usize|isize|[uUlLfF]*)\\b"],
];

const ASM_RULES: readonly (readonly [Role, string])[] = [
  ["comment", ";.*$|\\/\\/.*$"],
  ["address", "^\\s*0x[0-9a-fA-F]+:"],
  ["mnemonic", "(?<=^\\s*(?:0x[0-9a-fA-F]+:)?\\s*)[a-z][a-z0-9]*(?:\\.[a-z0-9]+)*\\b"],
  ["link", "\\b0x[0-9a-fA-F]{9,}\\b"],
  ["register", "\\b(?:[wxbhsdqv]\\d{1,2}|sp|fp|lr|pc|xzr|wzr|[re]?[abcd]x|[re]?[sd]i|[re]?[sb]p|r\\d{1,2}[dwb]?)\\b"],
  ["number", "#?-?\\b(?:0x[0-9a-fA-F]+|\\d+)\\b"],
];

/** NVIDIA PTX: opcodes like ld.param.u64, %registers, @%p predicates, $L__ labels, .directives and [memory] operands. */
const PTX_RULES: readonly (readonly [Role, string])[] = [
  ["comment", "\\/\\/.*$|\\/\\*.*?(?:\\*\\/|$)"],
  ["string", "\"(?:[^\"\\\\]|\\\\.)*\""],
  ["label", "\\$[\\w$]+:?"],
  ["predicate", "@!?%\\w+"],
  ["variable", "%[a-z]+\\d*(?:\\.[xyzw])?(?:<\\d+>)?"],
  ["memory", "\\[[^\\]]*\\]"],
  ["mnemonic", "(?<=^\\s*(?:@!?%\\w+\\s+)?)[a-z][\\w]*(?:\\.[\\w]+)*"],
  ["type", "\\.[a-z_][\\w]*"],
  ["number", "-?\\b(?:0[xX][0-9a-fA-F]+|0[fFdD][0-9a-fA-F]+|\\d+(?:\\.\\d+)?)\\b"],
];

function compile(rules: readonly (readonly [Role, string])[]): RegExp {
  return new RegExp(rules.map(([, source]) => `(${source})`).join("|"), "g");
}

const C_TOKENS = compile(C_RULES);
const ASM_TOKENS = compile(ASM_RULES);
const CODE_TOKENS = compile(CODE_RULES);
const PTX_TOKENS = compile(PTX_RULES);

const GRAMMARS: Readonly<Record<Syntax, { readonly rules: readonly (readonly [Role, string])[]; readonly tokens: RegExp }>> = {
  c: { rules: C_RULES, tokens: C_TOKENS },
  asm: { rules: ASM_RULES, tokens: ASM_TOKENS },
  code: { rules: CODE_RULES, tokens: CODE_TOKENS },
  ptx: { rules: PTX_RULES, tokens: PTX_TOKENS },
};

function roleColor(role: Role, p: Palette, c: Colors): string {
  switch (role) {
    case "comment":
      return c.comment;
    case "string":
      return c.string;
    case "keyword":
    case "mnemonic":
      return c.keyword;
    case "type":
    case "scope":
      return c.kind;
    case "link":
      return p.link;
    case "call":
      return c.call;
    case "data":
      return p.data;
    case "number":
      return c.number;
    case "address":
      return p.gutter;
    case "register":
      return p.text2;
    case "label":
      return c.call;
    case "predicate":
      return p.error;
    case "variable":
      return p.data;
    case "memory":
      return c.string;
    default: {
      const unhandled: never = role;
      return unhandled;
    }
  }
}

function partFor(match: RegExpMatchArray, rules: readonly (readonly [Role, string])[], p: Palette, c: Colors): Part {
  const group = match.slice(1).findIndex((g) => g !== undefined);
  const role = rules[group]?.[0];
  if (role === "link" || role === "call") return { kind: "link", text: match[0] };
  return { kind: "text", text: match[0], color: role ? roleColor(role, p, c) : p.text3 };
}

export function tokenize(line: string, syntax: Syntax, p: Palette, c: Colors = syntaxFor("Eleven", p)): readonly Part[] {
  const { rules, tokens } = GRAMMARS[syntax];
  const parts: Part[] = [];
  let last = 0;
  for (const match of line.matchAll(new RegExp(tokens))) {
    const at = match.index ?? 0;
    if (match[0].length === 0) continue;
    if (at > last) parts.push({ kind: "text", text: line.slice(last, at), color: p.text3 });
    parts.push(partFor(match, rules, p, c));
    last = at + match[0].length;
  }
  if (last < line.length) parts.push({ kind: "text", text: line.slice(last), color: p.text3 });
  return parts;
}

type Range = { readonly start: number; readonly end: number };

function linkRanges(line: string): readonly Range[] {
  return [...line.matchAll(new RegExp(C_TOKENS))].flatMap((match) => {
    const role = C_RULES[match.slice(1).findIndex((g) => g !== undefined)]?.[0];
    const start = match.index ?? 0;
    return role === "link" || role === "call" ? [{ start, end: start + match[0].length }] : [];
  });
}

function painted(line: string, spans: readonly Span[], from: number, to: number, p: Palette): readonly Part[] {
  const parts: Part[] = [];
  let at = from;
  for (const span of spans) {
    const start = Math.max(span.start, at);
    const end = Math.min(span.end, to);
    if (end <= start) continue;
    if (start > at) parts.push({ kind: "text", text: line.slice(at, start), color: p.text3 });
    parts.push({ kind: "text", text: line.slice(start, end), color: span.color });
    at = end;
  }
  if (at < to) parts.push({ kind: "text", text: line.slice(at, to), color: p.text3 });
  return parts;
}

/** A line in the grammar's colors, with calls and FUN_ names still split out as links so they stay clickable. */
export function colorize(line: string, spans: readonly Span[], p: Palette): readonly Part[] {
  const parts: Part[] = [];
  let at = 0;
  for (const link of linkRanges(line)) {
    parts.push(...painted(line, spans, at, link.start, p), { kind: "link", text: line.slice(link.start, link.end) });
    at = link.end;
  }
  parts.push(...painted(line, spans, at, line.length, p));
  return parts;
}

function PartView({ part, onLink }: { readonly part: Part; readonly onLink: ((name: string) => void) | null }): ReactElement {
  const { p } = useTheme();
  if (part.kind === "text" || !onLink) {
    return <div style={{ color: part.kind === "text" ? part.color : p.link, whiteSpace: "nowrap" }}>{part.text}</div>;
  }
  return (
    <div onClick={() => onLink(part.text)} style={{ color: p.link, whiteSpace: "nowrap", cursor: "pointer", textDecoration: "underline", hover: { opacity: 0.72 } }}>
      {part.text}
    </div>
  );
}

function LineView({ line, number, focused, syntax, gutter, onLink }: {
  readonly line: string;
  readonly number: number;
  readonly focused: boolean;
  readonly syntax: Syntax;
  readonly gutter: boolean;
  readonly onLink: ((name: string) => void) | null;
}): ReactElement {
  const { p } = useTheme();
  const { colorScheme } = useSettings().settings;
  const parts = line.length > 0 ? tokenize(line, syntax, p, syntaxFor(colorScheme, p)) : [];
  return (
    <div style={{ display: "flex", ...(focused ? { backgroundColor: p.fill } : {}) }}>
      {gutter && <div style={{ width: 46, flexShrink: 0, paddingRight: 16, display: "flex", justifyContent: "flex-end", color: focused ? p.text : p.gutter }}>{String(number)}</div>}
      <div style={{ display: "flex", whiteSpace: "nowrap", ...(gutter ? {} : { paddingLeft: 16 }) }}>
        {parts.length === 0 ? <div> </div> : parts.map((part, n) => <PartView key={n} part={part} onLink={onLink} />)}
      </div>
    </div>
  );
}

/** Code exactly as the Eleven canvas draws it: quiet gutter, One Dark or One Light colors. */
export function CodeView({ code, syntax = "c", focusLine = -1, onLink = null }: {
  readonly code: string;
  readonly syntax?: Syntax;
  readonly focusLine?: number;
  readonly onLink?: ((name: string) => void) | null;
}): ReactElement {
  const look = useCodeLook();
  return (
    <div style={{ display: "flex", flexDirection: "column", userSelect: "text", paddingTop: 10, paddingBottom: 24, fontFamily: look.family, fontSize: look.size, lineHeight: look.lineHeight }}>
      {code.split("\n").map((line, ix) => (
        <LineView key={ix} line={line} number={ix + 1} focused={ix === focusLine} syntax={syntax} gutter={look.lineNumbers} onLink={onLink} />
      ))}
    </div>
  );
}
