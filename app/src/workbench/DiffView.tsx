import { type ReactElement, useMemo, useState } from "react";

import { useTheme } from "../theme";
import { useLoaded } from "../lib/useLoaded";
import { ask } from "./actions";
import { classifyFunctions, lineDiff, type FnMatch, type FnStatus } from "./diff";
import { HOVER, MONO_STYLE, TextButton, useBench } from "./parts";
import type { Program } from "./model";

const ASK_CHARS = 4000;

const STATUS_LABEL: Readonly<Record<FnStatus, string>> = { added: "added", removed: "removed", both: "in both" };

const MAX_ROWS = 300;

const RANK: Readonly<Record<FnStatus, number>> = { added: 0, removed: 1, both: 2 };

function statusColor(status: FnStatus, p: ReturnType<typeof useTheme>["p"]): string {
  if (status === "added") return p.string;
  if (status === "removed") return p.error;
  return p.muted;
}

function DiffLines({ name, left, right, program, compare }: { readonly name: string; readonly left: string; readonly right: string; readonly program: Program; readonly compare: Program }): ReactElement {
  const { p } = useTheme();
  const bench = useBench();
  const before = useLoaded<string>(() => program.code(left, "pseudo"), `${program.id}:${left}:diff`);
  const after = useLoaded<string>(() => compare.code(right, "pseudo"), `${compare.id}:${right}:diff`);
  if (before.kind !== "ready" || after.kind !== "ready") {
    const failed = before.kind === "failed" ? before.message : after.kind === "failed" ? after.message : null;
    return <div style={{ marginTop: 8, color: failed ? p.error : p.muted }}>{failed ? `Couldn't read both sides. ${failed}` : "Reading both sides…"}</div>;
  }
  const lines = lineDiff(before.value, after.value);
  const identical = lines.every((line) => line.op === "same");
  const tint = (op: string): string | undefined => (op === "add" ? p.string : op === "del" ? p.error : undefined);
  const sign = (op: string): string => (op === "add" ? "+ " : op === "del" ? "- " : "  ");
  const askChange = (): void =>
    ask(bench, `The function ${name} changed between ${program.name} and ${compare.name}.\n\nOld (${program.name}):\n${before.value.slice(0, ASK_CHARS)}\n\nNew (${compare.name}):\n${after.value.slice(0, ASK_CHARS)}\n\nExplain what changed and why it matters.`);
  return (
    <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ flexGrow: 1, color: p.muted }}>{identical ? "These two are identical." : `${name} changed.`}</div>
        <TextButton label="Ask AI what changed" tone="outline" onClick={askChange} />
      </div>
      {!identical && (
        <div style={{ display: "flex", flexDirection: "column", userSelect: "text", fontSize: 12, lineHeight: 18, whiteSpace: "nowrap", ...MONO_STYLE }}>
          {lines.map((line, ix) => <div key={ix} style={{ color: tint(line.op) ?? p.text3 }}>{`${sign(line.op)}${line.text}`}</div>)}
        </div>
      )}
    </div>
  );
}

/** Compares the open binary with another one: which functions were added, removed, or changed, and the line diff of one. */
export function DiffView(): ReactElement {
  const { p } = useTheme();
  const { program, compare, openCompare } = useBench();
  const [selected, setSelected] = useState<FnMatch | null>(null);
  const matches = useMemo(() => {
    if (!compare) return [];
    return [...classifyFunctions(program.functions, compare.functions)].sort((a, b) => RANK[a.status] - RANK[b.status]);
  }, [program, compare]);
  if (!compare) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, padding: 16 }}>
        <div style={{ color: p.muted, maxWidth: 520 }}>{`Pick another build of ${program.name} to see what changed: which functions were added or removed, and the lines that differ in the ones that stayed.`}</div>
        <TextButton label="Choose a binary to compare" tone="primary" onClick={openCompare} />
      </div>
    );
  }
  const added = matches.filter((m) => m.status === "added").length;
  const removed = matches.filter((m) => m.status === "removed").length;
  const row = { display: "flex", alignItems: "center", gap: 10, height: 26, paddingLeft: 8, paddingRight: 8, borderRadius: 6, cursor: "pointer", hover: HOVER, ...MONO_STYLE } as const;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 12, paddingRight: 12, height: 36, flexShrink: 0 }}>
        <div style={{ flexGrow: 1, color: p.muted }}>{`${program.name} vs ${compare.name}: ${added} added, ${removed} removed`}</div>
        <TextButton label="Pick another" tone="outline" onClick={openCompare} />
      </div>
      <div style={{ display: "flex", flexGrow: 1, minHeight: 0 }}>
        <div style={{ width: 280, flexShrink: 0, overflow: "scroll", paddingLeft: 6, paddingRight: 6, paddingBottom: 8 }}>
          {matches.slice(0, MAX_ROWS).map((match) => (
            <div key={`${match.name}:${match.status}`} onClick={() => setSelected(match)} role="option" style={{ ...row, ...(selected?.name === match.name && selected.status === match.status ? { backgroundColor: p.sel } : {}) }}>
              <div style={{ flexGrow: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: p.text }}>{match.name}</div>
              <div style={{ flexShrink: 0, fontSize: 11, color: statusColor(match.status, p) }}>{STATUS_LABEL[match.status]}</div>
            </div>
          ))}
          {matches.length > MAX_ROWS && <div style={{ paddingLeft: 8, paddingTop: 6, fontSize: 11.5, color: p.faint }}>{`Showing the first ${MAX_ROWS} of ${matches.length}. Added and removed are listed first.`}</div>}
        </div>
        <div style={{ flexGrow: 1, minWidth: 0, overflow: "scroll", paddingLeft: 12, paddingRight: 12, paddingBottom: 12, borderLeftWidth: 1, borderColor: p.fill }}>
          {!selected && <div style={{ marginTop: 8, color: p.muted }}>Pick a function to see what changed.</div>}
          {selected?.status === "added" && <div style={{ marginTop: 8, color: p.muted }}>{`${selected.name} is new in ${compare.name}.`}</div>}
          {selected?.status === "removed" && <div style={{ marginTop: 8, color: p.muted }}>{`${selected.name} is gone from ${compare.name}.`}</div>}
          {selected?.status === "both" && selected.left && selected.right && (
            <DiffLines name={selected.name} left={selected.left} right={selected.right} program={program} compare={compare} />
          )}
        </div>
      </div>
    </div>
  );
}
