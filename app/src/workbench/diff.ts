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
