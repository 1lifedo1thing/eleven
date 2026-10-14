import type { RewriteProgress } from "./rewrite";
import { askWarm, type QuickAsk } from "./warm";

/** The lines someone picked, the code around them, what they come from, and the language to quote them in. */
export type Quote = {
  readonly about: string;
  readonly from: number;
  readonly to: number;
  readonly lines: readonly string[];
  /** Every line of the view, numbered from 1, so a blank or partial pick still has its context. */
  readonly code: readonly string[];
  readonly fence: string;
};

export type Exchange = { readonly question: string; readonly answer: string };

/** A rename the agent suggests at the end of an answer; the user accepts or declines it. */
export type Rename = { readonly from: string; readonly to: string };

const RENAME_LINE = /^\s*RENAME\s+(\S+)\s*(?:->|→)\s*([A-Za-z_]\w*)\s*$/m;

const AROUND = 150;

/** The code around the pick, numbered, with the picked lines marked ">", capped so a huge view stays readable. */
export function numbered(quote: Quote): readonly string[] {
  const first = Math.max(1, quote.from - AROUND);
  const last = Math.min(quote.code.length, quote.to + AROUND);
  const width = String(last).length;
  return quote.code.slice(first - 1, last).map((line, ix) => {
    const number = first + ix;
    return `${number >= quote.from && number <= quote.to ? ">" : " "} ${String(number).padStart(width)} | ${line}`;
  });
}

export function askPrompt(quote: Quote, earlier: readonly Exchange[], question: string): string {
  const range = quote.from === quote.to ? `line ${quote.from}` : `lines ${quote.from} to ${quote.to}`;
  return [
    `Answer a question about ${range} of ${quote.about}.`,
    `Here is the code, numbered, with ${range} marked ">". It is already decompiled and open in Eleven.`,
    "",
    `\`\`\`${quote.fence}`,
    ...numbered(quote),
    "```",
    "",
    ...earlier.flatMap((turn) => [`Earlier question: ${turn.question}`, `Your answer: ${turn.answer}`, ""]),
    `Question: ${question}`,
    "",
    "Answer from the code above. If the marked lines are blank or trivial, explain them in the context of the lines around them.",
    "Answer straight away without using any tools: don't open, extract or decompile the binary and don't run shell commands. If the question needs a function that isn't shown, say in one sentence which one.",
    "Reply with only the answer, in plain language, in one or two short paragraphs. No headings, lists or bold. Put names, registers, numbers and code in `backticks`, and use one small fenced code block only when it really helps.",
    "Don't rename, comment or patch anything yourself.",
    "If the question asks to name something, or one name in these lines clearly deserves a better one, end with one line exactly like: RENAME old_name -> new_name",
  ].join("\n");
}

/** The answer as shown, and the rename it ends with, if any. */
export function splitAnswer(reply: string): { readonly text: string; readonly rename: Rename | null } {
  const found = RENAME_LINE.exec(reply);
  if (!found?.[1] || !found[2]) return { text: reply.trim(), rename: null };
  return { text: reply.replace(found[0], "").trim(), rename: { from: found[1], to: found[2] } };
}

/** The answer while it streams, without a rename line that is still arriving. */
export function answerSoFar(reply: string): string {
  return splitAnswer(reply).text.replace(/\n?[ \t]*RENAME\b[^\n]*$/, "").trim();
}

/** One question about some lines, answered by the chat's agent in a warm session nobody sees, streamed as it writes. */
export async function askAbout(req: QuickAsk, quote: Quote, earlier: readonly Exchange[], question: string, onProgress: (progress: RewriteProgress) => void): Promise<string> {
  return await askWarm(req, askPrompt(quote, earlier, question), onProgress);
}

/** Prose and fenced code, in order, so code blocks can be drawn with Eleven's own highlighting; an unclosed fence still shows while it streams. */
export type Piece = { readonly kind: "prose"; readonly text: string } | { readonly kind: "code"; readonly fence: string; readonly lines: readonly string[] };

export function pieces(text: string): readonly Piece[] {
  const out: Piece[] = [];
  let rest = text;
  while (rest.length > 0) {
    const open = /^```([\w+#-]*)[ \t]*$/m.exec(rest);
    if (!open) {
      if (rest.trim()) out.push({ kind: "prose", text: rest.trim() });
      break;
    }
    const before = rest.slice(0, open.index);
    if (before.trim()) out.push({ kind: "prose", text: before.trim() });
    const body = rest.slice(open.index + open[0].length).replace(/^\n/, "");
    const close = /^```[ \t]*$/m.exec(body);
    const code = (close ? body.slice(0, close.index) : body).replace(/\n$/, "");
    out.push({ kind: "code", fence: open[1] ?? "", lines: code.split("\n") });
    rest = close ? body.slice(close.index + close[0].length) : "";
  }
  return out;
}

export type Run = { readonly code: boolean; readonly bold: boolean; readonly text: string };

/** Prose split at `backticks` and **bold**, so names and numbers can be drawn as highlighted code. */
export function inlineRuns(text: string): readonly Run[] {
  return text.split("`").flatMap((part, ix): readonly Run[] => {
    if (ix % 2 === 1) return part ? [{ code: true, bold: false, text: part }] : [];
    return part.split("**").flatMap((piece, n) => (piece ? [{ code: false, bold: n % 2 === 1, text: piece }] : []));
  });
}

export type Block = { readonly kind: "para"; readonly text: string } | { readonly kind: "item"; readonly marker: string; readonly text: string };

const ITEM = /^\s*([-*•]|\d+[.)])\s+(.*)$/;

/** Paragraphs and list items, one per row, from prose that may carry a little markdown. */
export function proseBlocks(text: string): readonly Block[] {
  const out: Block[] = [];
  let para: string[] = [];
  const close = (): void => {
    if (para.length > 0) out.push({ kind: "para", text: para.join(" ") });
    para = [];
  };
  for (const line of text.split("\n")) {
    const item = ITEM.exec(line);
    if (item?.[1] && item[2] !== undefined) {
      close();
      out.push({ kind: "item", marker: /\d/.test(item[1]) ? item[1] : "•", text: item[2] });
    } else if (line.trim()) {
      para.push(line.trim());
    } else {
      close();
    }
  }
  close();
  return out;
}
