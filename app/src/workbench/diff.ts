import type { Fn } from "./model";

export type FnStatus = "added" | "removed" | "both";

export type FnMatch = { readonly name: string; readonly status: FnStatus; readonly left: string | null; readonly right: string | null };

export type DiffOp = "same" | "add" | "del";

export type DiffLine = { readonly op: DiffOp; readonly text: string };

/** Pairs two binaries' functions by name: in both, only in the old one (removed), or only in the new one (added). */
export function classifyFunctions(left: readonly Fn[], right: readonly Fn[]): readonly FnMatch[] {
  const rightByName = new Map(right.map((fn) => [fn.name, fn.addr]));
  const seen = new Set<string>();
  const matched: FnMatch[] = left.map((fn) => {
    seen.add(fn.name);
    const other = rightByName.get(fn.name) ?? null;
    return { name: fn.name, status: other ? "both" : "removed", left: fn.addr, right: other };
  });
  const added: FnMatch[] = right.filter((fn) => !seen.has(fn.name)).map((fn) => ({ name: fn.name, status: "added", left: null, right: fn.addr }));
  return [...matched, ...added];
}

/** A line-by-line diff of two texts: which lines are shared, removed from the old, or added in the new. */
export function lineDiff(before: string, after: string): readonly DiffLine[] {
  const a = before.length === 0 ? [] : before.split("\n");
  const b = after.length === 0 ? [] : after.split("\n");
  const n = a.length;
  const m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    const rowBelow = lcs[i + 1] ?? [];
    const row = lcs[i] ?? [];
    for (let j = m - 1; j >= 0; j--) {
      row[j] = a[i] === b[j] ? (rowBelow[j + 1] ?? 0) + 1 : Math.max(rowBelow[j] ?? 0, row[j + 1] ?? 0);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ op: "same", text: a[i] ?? "" });
      i++;
      j++;
    } else if ((lcs[i + 1]?.[j] ?? 0) >= (lcs[i]?.[j + 1] ?? 0)) {
      out.push({ op: "del", text: a[i] ?? "" });
      i++;
    } else {
      out.push({ op: "add", text: b[j] ?? "" });
      j++;
    }
  }
  for (; i < n; i++) out.push({ op: "del", text: a[i] ?? "" });
  for (; j < m; j++) out.push({ op: "add", text: b[j] ?? "" });
  return out;
}

/** The part of an edited line that actually changed, so a review can mark just those characters. */
export type Span = { readonly start: number; readonly end: number };

export type ReviewRow =
  | { readonly kind: "line"; readonly op: DiffOp; readonly text: string; readonly before: number | null; readonly after: number | null; readonly changed: Span | null }
  | { readonly kind: "fold"; readonly at: number; readonly count: number };

export type DiffStats = { readonly added: number; readonly removed: number };

export function diffStats(lines: readonly DiffLine[]): DiffStats {
  return { added: lines.filter((line) => line.op === "add").length, removed: lines.filter((line) => line.op === "del").length };
}

/** Where two versions of a line differ, after their shared start and end; null when nothing is shared. */
export function changedSpan(line: string, other: string): Span | null {
  let start = 0;
  while (start < line.length && start < other.length && line[start] === other[start]) start++;
  let end = 0;
  while (end < line.length - start && end < other.length - start && line[line.length - 1 - end] === other[other.length - 1 - end]) end++;
  if (start === 0 && end === 0) return null;
  return { start, end: line.length - end };
}

/** Pairs each removed line with the added line in the same spot of the change that replaced it. */
function partners(lines: readonly DiffLine[]): ReadonlyMap<number, number> {
  const pairs = new Map<number, number>();
  let i = 0;
  while (i < lines.length) {
    if (lines[i]?.op !== "del") {
      i++;
      continue;
    }
    const dels = i;
    while (lines[i]?.op === "del") i++;
    const adds = i;
    while (lines[i]?.op === "add") i++;
    for (let k = 0; k < Math.min(adds - dels, i - adds); k++) {
      pairs.set(dels + k, adds + k);
      pairs.set(adds + k, dels + k);
    }
  }
  return pairs;
}

/** A diff as a code review shows it: numbers on both sides, edited words marked, long unchanged stretches folded unless opened. */
export function reviewRows(lines: readonly DiffLine[], opened: ReadonlySet<number>, context = 3): readonly ReviewRow[] {
  const pairs = partners(lines);
  const near = lines.map(() => false);
  lines.forEach((line, ix) => {
    if (line.op === "same") return;
    for (let k = Math.max(0, ix - context); k <= Math.min(lines.length - 1, ix + context); k++) near[k] = true;
  });
  const rows: ReviewRow[] = [];
  let before = 0;
  let after = 0;
  let ix = 0;
  while (ix < lines.length) {
    const start = ix;
    while (ix < lines.length && !near[ix] && lines[ix]?.op === "same") ix++;
    const hidden = ix - start;
    if (hidden > 1 && !opened.has(start)) {
      rows.push({ kind: "fold", at: start, count: hidden });
      before += hidden;
      after += hidden;
      continue;
    }
    ix = start + Math.max(hidden, 1);
    for (let k = start; k < ix; k++) {
      const line = lines[k];
      if (!line) continue;
      if (line.op !== "add") before++;
      if (line.op !== "del") after++;
      const other = pairs.get(k);
      const partner = other === undefined ? undefined : lines[other];
      rows.push({
        kind: "line",
        op: line.op,
        text: line.text,
        before: line.op === "add" ? null : before,
        after: line.op === "del" ? null : after,
        changed: partner ? changedSpan(line.text, partner.text) : null,
      });
    }
  }
  return rows;
}
