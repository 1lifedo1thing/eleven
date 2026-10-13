import type { ReactElement } from "react";

import { useLoaded } from "../lib/useLoaded";
import { TYPING } from "../lib/shortcuts";
import { useTheme } from "../theme";
import { Icon } from "../components/ui";
import { ask, BLOCK_COLORS } from "./actions";
import type { HexRow, Refs } from "./model";
import { fileOffset } from "./patch";
import { ELLIPSIS, MONO_STYLE, TextButton, useBench } from "./parts";
import { currentAddr, placeIn, segmentOf } from "./where";

function Heading({ text }: { readonly text: string }): ReactElement {
  const { p } = useTheme();
  return <div style={{ marginBottom: 8, fontSize: 11.5, fontWeight: 600, color: p.muted }}>{text}</div>;
}

function Pair({ label, value, mono = false }: { readonly label: string; readonly value: string; readonly mono?: boolean }): ReactElement {
  const { p } = useTheme();
  return (
    <div style={{ display: "flex", gap: 12, minHeight: 22, fontSize: 12.5 }}>
      <div style={{ width: 84, flexShrink: 0, color: p.muted }}>{label}</div>
      <div style={{ flexGrow: 1, minWidth: 0, color: p.text3, userSelect: "text", ...(mono ? { fontSize: 12, ...MONO_STYLE } : {}), ...ELLIPSIS }}>{value}</div>
    </div>
  );
}

function bytesAt(rows: readonly HexRow[], addr: string): string {
  const at = Number.parseInt(addr, 16);
  const row = rows.find((r) => {
    const start = Number.parseInt(r.addr, 16);
    return at >= start && at < start + 16;
  });
  if (!row) return "";
  const offset = at - Number.parseInt(row.addr, 16);
  return row.bytes.split(" ").slice(offset, offset + 4).join(" ");
}

/** What is selected: where it is in memory and in the file, its bytes, its function, your tag and note. */
export function Inspector(): ReactElement {
  const { p } = useTheme();
  const bench = useBench();
  const { wb, program, focusAddr, nameOf } = bench;
  const at = currentAddr(bench);
  const offset = useLoaded<number | null>(() => (program.dossier ? fileOffset(program.path, at) : Promise.resolve(null)), `${program.path}:${at}:offset`);
  const hex = useLoaded<readonly HexRow[]>(() => program.hex(at), `${program.id}:${at}:hex`);
  const refs = useLoaded<Refs>(() => program.refs(focusAddr), `${program.name}:${focusAddr}:refs`);
  const color = wb.s.colors.get(focusAddr) ?? "";
  const callers = refs.kind === "ready" ? refs.value.callers.length : null;
  const calls = refs.kind === "ready" ? refs.value.callees.map(nameOf).join(", ") : "";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, flexGrow: 1, minHeight: 0, overflowY: "scroll", paddingTop: 4, paddingLeft: 14, paddingRight: 14, paddingBottom: 18 }}>
      <div role="region" aria-label="Selection" style={{ display: "flex", flexDirection: "column" }}>
        <Heading text="Selection" />
        <Pair label="Address" value={at} mono />
        <Pair label="In file at" value={offset.kind === "ready" && offset.value !== null ? `0x${offset.value.toString(16)}` : "Not in the file"} mono />
        <Pair label="Segment" value={segmentOf(program.segments, at) ?? "Unknown"} />
        <Pair label="Bytes" value={hex.kind === "ready" ? bytesAt(hex.value, at) || "None" : "Reading…"} mono />
      </div>
      <div role="region" aria-label="Function" style={{ display: "flex", flexDirection: "column" }}>
        <Heading text="Function" />
        <Pair label="Name" value={placeIn(nameOf(focusAddr), focusAddr, at)} mono />
        <Pair label="Called by" value={callers === null ? "Finding…" : callers === 1 ? "1 place" : `${callers} places`} />
        <Pair label="Calls" value={refs.kind === "ready" ? calls || "Nothing" : "Finding…"} />
      </div>
      <div role="region" aria-label="Your notes" style={{ display: "flex", flexDirection: "column" }}>
        <Heading text="Tag and note" />
        <div role="radiogroup" aria-label="Colour tag" style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {[{ name: "None", color: "" }, ...BLOCK_COLORS].map((c) => (
            <div key={c.name} onClick={() => wb.setColor(focusAddr, c.color)} role="radio" aria-label={c.name} aria-selected={color === c.color} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: 10, backgroundColor: c.color || p.fill, cursor: "pointer" }}>
              {color === c.color && <Icon name="check" size={12} color={c.color ? "#ffffff" : p.text} />}
            </div>
          ))}
        </div>
        <textarea {...TYPING} value={wb.s.notes.get(focusAddr) ?? ""} minRows={3} maxRows={8} placeholder="What this function does, in your words" aria-label="Note" onChange={(e) => wb.setNote(focusAddr, e.value ?? "")} style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 9, paddingRight: 9, borderWidth: 1, borderColor: p.line3, borderRadius: 8, backgroundColor: p.deep, fontSize: 12.5, color: p.text3 }} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <TextButton label="Patch this line…" tone="outline" onClick={() => wb.patch({ patching: at, patchDraft: "" })} />
        <TextButton label="Ask about this line" tone="outline" onClick={() => ask(bench, `What does the code at ${at} in ${nameOf(focusAddr)} do?`)} />
      </div>
    </div>
  );
}
