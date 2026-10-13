export type MentionKind = "bookmark" | "note" | "function" | "string";

/** Something in the open file you can point the agent at by typing @. */
export type Mention = {
  readonly kind: MentionKind;
  /** What the picker shows, and what follows the @ in the message. */
  readonly label: string;
  readonly addr: string;
  readonly detail: string;
};

/** Mentions with their lowercased labels and addresses, worked out once per file instead of on every keystroke. */
export type MentionIndex = { readonly all: readonly Mention[]; readonly labels: readonly string[]; readonly addrs: readonly string[] };

const MAX_SHOWN = 50;
const KIND_ORDER: Readonly<Record<MentionKind, number>> = { bookmark: 0, note: 1, function: 2, string: 3 };
const WORD_EDGE = /[\s._:$[\]/()<>"-]/;
const IN_ORDER = 4;

export function indexMentions(all: readonly Mention[]): MentionIndex {
  return { all, labels: all.map((mention) => mention.label.toLowerCase()), addrs: all.map((mention) => mention.addr.toLowerCase()) };
}

/** 0 exact, 1 prefix, 2 at the start of a word, 3 inside; null when the label doesn't contain the text. */
function containedRank(hay: string, needle: string): number | null {
  if (hay === needle) return 0;
  if (hay.startsWith(needle)) return 1;
  let at = hay.indexOf(needle);
  if (at < 0) return null;
  for (; at > 0; at = hay.indexOf(needle, at + 1)) if (WORD_EDGE.test(hay.charAt(at - 1))) return 2;
  return 3;
}

function inOrder(hay: string, needle: string): boolean {
  let next = 0;
  for (let ix = 0; ix < hay.length && next < needle.length; ix += 1) if (hay.charCodeAt(ix) === needle.charCodeAt(next)) next += 1;
  return next === needle.length;
}

type Hit = { readonly ix: number; readonly rank: number; readonly order: number; readonly length: number };

function before(a: Hit, b: Hit): boolean {
  return a.rank !== b.rank ? a.rank < b.rank : a.order !== b.order ? a.order < b.order : a.length < b.length;
}

/** Keeps the best `limit` hits in order, so a broad query never sorts the whole file. */
function keep(best: Hit[], hit: Hit, limit: number): void {
  const last = best[best.length - 1];
  if (best.length >= limit && last && !before(hit, last)) return;
  let at = best.length;
  while (at > 0 && before(hit, best[at - 1] ?? hit)) at -= 1;
  best.splice(at, 0, hit);
  if (best.length > limit) best.pop();
}

/** One search: every item that matches at all (so the next, longer query only looks at these) and the best few to show. */
export type MentionResult = { readonly index: MentionIndex; readonly needle: string; readonly matched: readonly number[]; readonly shown: readonly Mention[] };

function rankOf(index: MentionIndex, ix: number, needle: string): number | null {
  const hay = index.labels[ix] ?? "";
  return containedRank(hay, needle) ?? (index.addrs[ix]?.startsWith(needle) ? 1 : inOrder(hay, needle) ? IN_ORDER : null);
}

/**
 * The mentions that match what was typed after the @, best first: bookmarks and notes ahead of functions and strings.
 * Pass the previous result while the query only grows, and only what matched before is searched again.
 */
export function searchMentions(index: MentionIndex, query: string, previous: MentionResult | null = null, limit = MAX_SHOWN): MentionResult {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return { index, needle, matched: [], shown: index.all.slice(0, limit) };
  const narrows = previous !== null && previous.index === index && previous.needle.length > 0 && needle.startsWith(previous.needle);
  const pool = narrows ? previous.matched : index.all.keys();
  const best: Hit[] = [];
  const matched: number[] = [];
  for (const ix of pool) {
    const rank = rankOf(index, ix, needle);
    const mention = index.all[ix];
    if (rank === null || !mention) continue;
    matched.push(ix);
    keep(best, { ix, rank, order: KIND_ORDER[mention.kind], length: index.labels[ix]?.length ?? 0 }, limit);
  }
  return { index, needle, matched, shown: best.flatMap((hit) => index.all[hit.ix] ?? []) };
}

/** The draft without an @ that was just typed to start a mention, or null when the @ is part of other text like an email. */
export function startedMention(before: string, after: string): string | null {
  if (after !== `${before}@`) return null;
  return before.length === 0 || /\s$/.test(before) ? before : null;
}

const SAID: Readonly<Record<MentionKind, string>> = { bookmark: "the bookmark", note: "the note", function: "the function", string: "the string" };

/** The message plus where each mention it still contains lives, so the agent can go straight there. */
export function withMentions(text: string, picked: readonly Mention[]): string {
  const used = picked.filter((mention, ix) => text.includes(`@${mention.label}`) && picked.findIndex((other) => other.label === mention.label) === ix);
  if (used.length === 0) return text;
  return `${text}\n\n${used.map((mention) => `@${mention.label} is ${SAID[mention.kind]} at ${mention.addr}.`).join("\n")}`;
}
