import { type ReactElement, useMemo } from "react";

import { tokenize } from "../components/code";
import { ErrorCard } from "../components/kit";
import { useListWindow } from "../lib/useListWindow";
import { useLoaded } from "../lib/useLoaded";
import { syntaxFor, useCodeLook } from "../settings/look";
import { useSettings } from "../settings/store";
import { useTheme } from "../theme";
import type { SourceText } from "./model";
import { HOVER, useBench } from "./parts";

const NEARBY = 40;

function SourceLine({ text, number, addr }: { readonly text: string; readonly number: number; readonly addr: string | null }): ReactElement {
  const { p } = useTheme();
  const { openFn, nameOf } = useBench();
  const { settings } = useSettings();
  const look = useCodeLook();
  const parts = text.length === 0 ? [] : tokenize(text, "c", p, syntaxFor(settings.colorScheme, p));
  const link = addr === null ? {} : { onClick: () => openFn(addr, false), role: "link", "aria-label": `Open ${nameOf(addr)}` };
  return (
    <div role="row" aria-label={`Line ${number}`} style={{ display: "flex", height: look.lineHeight, flexShrink: 0, fontFamily: look.family, fontSize: look.size, lineHeight: look.lineHeight }}>
      <div style={{ display: "flex", justifyContent: "flex-end", width: 50, flexShrink: 0, paddingRight: 16, color: p.gutter, userSelect: "none" }}>{String(number)}</div>
      <div {...link} style={{ display: "flex", whiteSpace: "nowrap", userSelect: "text", ...(addr === null ? {} : { cursor: "pointer", hover: HOVER }) }}>
        {parts.map((part, ix) => <div key={ix} style={{ color: part.kind === "text" ? part.color : p.call, whiteSpace: "nowrap", pointerEvents: "none" }}>{part.text}</div>)}
      </div>
    </div>
  );
}

function Lines({ source }: { readonly source: SourceText }): ReactElement {
  const look = useCodeLook();
  const lines = useMemo(() => source.text.split("\n"), [source]);
  const starts = useMemo(() => new Map(source.starts.map((start) => [start.line, start.addr])), [source]);
  const shown = useListWindow(lines.length, NEARBY);
  return (
    <virtual-list itemCount={lines.length} windowStart={shown.start} estimatedItemHeight={look.lineHeight} onVisibleRange={shown.onVisibleRange} style={{ flexGrow: 1, minHeight: 0, paddingTop: 10, paddingBottom: 28 }}>
      {lines.slice(shown.start, shown.end).map((line, ix) => {
        const number = shown.start + ix + 1;
        return <SourceLine key={number} text={line} number={number} addr={starts.get(number) ?? null} />;
      })}
    </virtual-list>
  );
}

/** A whole decompiled source file; a function's signature line opens that function. */
export function SourceView({ file }: { readonly file: string }): ReactElement {
  const { p } = useTheme();
  const { program } = useBench();
  const read = program.source;
  const source = useLoaded(() => (read ? read(file) : Promise.reject(new Error("This engine reads functions one at a time, not whole files."))), `${program.id}:${file}`);
  switch (source.kind) {
    case "loading":
      return <div style={{ padding: 16, color: p.muted }}>{`Reading ${file}…`}</div>;
    case "failed":
      return <div style={{ padding: 16 }}><ErrorCard title={`Couldn't open ${file}`} detail="The rest of the app still reads. Try a function inside it instead." raw={source.message} /></div>;
    case "ready":
      return <Lines source={source.value} />;
    default: {
      const unhandled: never = source;
      return unhandled;
    }
  }
}
