import type { ReactElement } from "react";

import { type Syntax, syntaxFor, useCodeLook } from "../settings/look";
import { useSettings } from "../settings/store";
import { type Palette, SANS, useTheme } from "../theme";
import { text } from "./look";
import type { Binding, LoadedBy, ShaderFunction } from "./types";
import type { Loaded } from "./useGpu";

type IrTone = "plain" | "label" | "branch" | "call" | "comment";

function toneOf(line: string): IrTone {
  const trimmed = line.trim();
  if (trimmed.startsWith(";")) return "comment";
  if (/^[\w.]+:$/.test(trimmed)) return "label";
  if (/^(br|ret|switch|unreachable)\b/.test(trimmed)) return "branch";
  if (/\bcall\b/.test(trimmed)) return "call";
  return "plain";
}

function toneColor(tone: IrTone, p: Palette, c: Syntax): string {
  switch (tone) {
    case "plain":
      return p.text2;
    case "label":
      return p.data;
    case "branch":
      return c.keyword;
    case "call":
      return c.call;
    case "comment":
      return c.comment;
    default: {
      const unhandled: never = tone;
      return unhandled;
    }
  }
}

function IrLine({ line, number }: { readonly line: string; readonly number: number }): ReactElement {
  const { p } = useTheme();
  const { colorScheme, lineNumbers } = useSettings().settings;
  return (
    <div style={{ display: "flex", flexShrink: 0, userSelect: "text" }}>
      {lineNumbers ? <div style={{ display: "flex", justifyContent: "flex-end", width: 62, flexShrink: 0, paddingRight: 14, color: p.gutter, userSelect: "none" }}>{String(number)}</div> : <div style={{ width: 18, flexShrink: 0 }} />}
      <div style={{ whiteSpace: "nowrap", color: toneColor(toneOf(line), p, syntaxFor(colorScheme, p)) }}>{line}</div>
    </div>
  );
}

function LoadedByCard({ loadedBy, onOpen }: { readonly loadedBy: Loaded<LoadedBy | null>; readonly onOpen: (symbol: string) => void }): ReactElement {
  const { p } = useTheme();
  const look = useCodeLook();
  const body = ((): ReactElement => {
    if (loadedBy.kind === "loading") return <div style={{ color: p.muted, ...text(12) }}>Finding the code that loads it…</div>;
    if (loadedBy.kind === "failed") return <div style={{ color: p.muted, ...text(12) }}>{`Couldn't search the app's code. ${loadedBy.message}`}</div>;
    if (!loadedBy.value) return <div style={{ color: p.muted, ...text(12) }}>Nothing in the app names this shader directly.</div>;
    const { symbol } = loadedBy.value;
    return (
      <>
        <div onClick={() => onOpen(symbol)} role="link" style={{ fontFamily: look.family, color: p.link, textDecoration: "underline", fontSize: 12, lineHeight: 18.85, cursor: "pointer", hover: { color: p.text } }}>{symbol}</div>
        <div style={{ marginTop: 4, color: p.muted, ...text(12) }}>{loadedBy.value.note}</div>
      </>
    );
  })();
  return (
    <div style={{ display: "flex", flexDirection: "column", padding: 12, borderWidth: 1, borderColor: p.line3, borderRadius: 10, backgroundColor: p.raised }}>
      <div style={{ marginBottom: 4, color: p.muted, ...text(11.5) }}>Loaded by</div>
      {body}
    </div>
  );
}

function Bindings({ bindings }: { readonly bindings: readonly Binding[] }): ReactElement {
  const { p } = useTheme();
  const { family } = useCodeLook();
  return (
    <div style={{ display: "flex", flexDirection: "column", padding: 12, borderWidth: 1, borderColor: p.sel, borderRadius: 10 }}>
      <div style={{ marginBottom: 6, color: p.muted, ...text(11.5) }}>Inputs</div>
      {bindings.map((b) => (
        <div key={b.slot} style={{ display: "flex", justifyContent: "space-between" }}>
          <div>{b.slot}</div>
          <div style={{ fontFamily: family, color: p.text4 }}>{b.type}</div>
        </div>
      ))}
    </div>
  );
}

function IrBody({ ir, name }: { readonly ir: Loaded<string>; readonly name: string }): ReactElement {
  const { p } = useTheme();
  switch (ir.kind) {
    case "loading":
      return <div style={{ paddingLeft: 18, fontFamily: SANS, color: p.muted }}>{`Reading ${name}…`}</div>;
    case "failed":
      return <div style={{ paddingLeft: 18, fontFamily: SANS, color: p.error }}>{`Couldn't read ${name}. ${ir.message}`}</div>;
    case "ready":
      return <>{ir.value.split("\n").map((line, ix) => <IrLine key={ix} line={line} number={ix + 1} />)}</>;
    default: {
      const unhandled: never = ir;
      return unhandled;
    }
  }
}

/** One function's IR on the left, where the app loads it and what it takes on the right. */
function stageOf(fn: ShaderFunction, format: string): string {
  const what = fn.kind === "compute" ? "compute kernel" : `${fn.kind} shader`;
  const reads = format.split(" · ")[1];
  return reads ? `Metal ${what} · ${reads}` : `Metal ${what}`;
}

export function ShaderView({ fn, stage, ir, loadedBy, onOpen, onAsk }: {
  readonly fn: ShaderFunction;
  readonly stage: string;
  readonly onOpen: (symbol: string) => void;
  readonly ir: Loaded<string>;
  readonly loadedBy: Loaded<LoadedBy | null>;
  readonly onAsk: () => void;
}): ReactElement {
  const { p } = useTheme();
  const look = useCodeLook();
  return (
    <div style={{ display: "flex", flexGrow: 1, minHeight: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 999, flexBasis: 420, minWidth: 0, overflow: "scroll", paddingTop: 14, paddingBottom: 14, fontFamily: look.family, fontSize: look.size, lineHeight: look.lineHeight }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, flexShrink: 0, paddingLeft: 18, paddingRight: 18, paddingBottom: 10 }}>
          <div style={{ fontFamily: SANS, fontWeight: 600, ...text(14) }}>{fn.name}</div>
          <div style={{ paddingBottom: 0.4, fontFamily: SANS, color: p.muted, ...text(13) }}>{stageOf(fn, stage)}</div>
        </div>
        <IrBody ir={ir} name={fn.name} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, flexGrow: 1, flexBasis: 280, maxWidth: 340, padding: 14, borderLeftWidth: 1, borderColor: p.sel }}>
        <LoadedByCard loadedBy={loadedBy} onOpen={onOpen} />
        {fn.bindings.length > 0 && <Bindings bindings={fn.bindings} />}
        <div onClick={onAsk} style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 30, borderWidth: 1, borderColor: p.line3, borderRadius: 8, backgroundColor: p.sel, color: p.text, cursor: "pointer", hover: { opacity: 0.72 } }}>
          <div>Ask why it's slow</div>
        </div>
      </div>
    </div>
  );
}
