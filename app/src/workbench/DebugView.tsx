import { useCommand } from "../lib/shortcuts";
import { type ReactElement, useState } from "react";

import { useTheme } from "../theme";
import { useDebug, type DebugStatus, type LoadedScope } from "../debug/useDebug";
import type { StackFrame, Variable } from "../debug/dap";
import { ask } from "./actions";
import { TYPING } from "../lib/shortcuts";
import { useSettings } from "../settings/store";
import { HOVER, MONO_STYLE, TextButton, useBench } from "./parts";

function useVarLimit(): number {
  return Number(useSettings().settings.variableLimit.replace(",", ""));
}

function Frames({ frames }: { readonly frames: readonly StackFrame[] }): ReactElement {
  const { p } = useTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ fontSize: 11.5, color: p.muted, marginBottom: 2 }}>Call stack</div>
      {frames.length === 0 && <div style={{ color: p.muted }}>No frames.</div>}
      {frames.map((frame, ix) => (
        <div key={frame.id} style={{ display: "flex", userSelect: "text", gap: 10, fontSize: 12, ...MONO_STYLE }}>
          <div style={{ flexGrow: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: ix === 0 ? p.text : p.text3 }}>{frame.name || "??"}</div>
          <div style={{ flexShrink: 0, color: p.faint }}>{frame.line > 0 ? `:${frame.line}` : ""}</div>
        </div>
      ))}
    </div>
  );
}

function VarRow({ v, load, depth }: { readonly v: Variable; readonly load: (reference: number) => Promise<readonly Variable[]>; readonly depth: number }): ReactElement {
  const { p } = useTheme();
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<readonly Variable[] | null>(null);
  const limit = useVarLimit();
  const expandable = v.reference > 0;
  const toggle = (): void => {
    if (!expandable) return;
    if (children === null) void (async (): Promise<void> => setChildren((await load(v.reference)).slice(0, limit)))();
    setOpen((was) => !was);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div onClick={toggle} style={{ display: "flex", userSelect: "text", gap: 8, fontSize: 12, paddingLeft: depth * 14, ...(expandable ? { cursor: "pointer", hover: HOVER } : {}), ...MONO_STYLE }}>
        <div style={{ flexShrink: 0, width: 10, color: p.muted }}>{expandable ? (open ? "▾" : "▸") : ""}</div>
        <div style={{ flexShrink: 0, color: p.text }}>{v.name}</div>
        <div style={{ flexGrow: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: p.string }}>{v.value}</div>
      </div>
      {open && children?.map((child, ix) => <VarRow key={`${child.name}:${ix}`} v={child} load={load} depth={depth + 1} />)}
    </div>
  );
}

function Scopes({ scopes, load }: { readonly scopes: readonly LoadedScope[]; readonly load: (reference: number) => Promise<readonly Variable[]> }): ReactElement {
  const { p } = useTheme();
  const limit = useVarLimit();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
      {scopes.map((scope) => (
        <div key={scope.name} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontSize: 11.5, color: p.muted, marginBottom: 2 }}>{scope.name}</div>
          {scope.vars.length === 0 && <div style={{ color: p.muted }}>Nothing here.</div>}
          {scope.vars.slice(0, limit).map((v, ix) => <VarRow key={`${v.name}:${ix}`} v={v} load={load} depth={0} />)}
          {scope.vars.length > limit && <div style={{ fontSize: 11.5, color: p.faint }}>{`${(scope.vars.length - limit).toLocaleString()} more`}</div>}
        </div>
      ))}
    </div>
  );
}

/** Runs the open binary under lldb-dap, breaking at the function in focus, with the stack, locals and step controls. */
export function DebugView(): ReactElement {
  const { p } = useTheme();
  const bench = useBench();
  const { program, nameOf, focusAddr } = bench;
  const debug = useDebug();
  const stopped = debug.status.kind === "stopped";
  useCommand("continue", () => stopped && debug.cont());
  useCommand("stepOver", () => stopped && debug.stepOver());
  useCommand("stepIn", () => stopped && debug.stepIn());
  useCommand("stepOut", () => stopped && debug.stepOut());
  const breakFn = nameOf(focusAddr);
  const [pid, setPid] = useState("");
  const breakAt = [...(breakFn ? [breakFn] : []), ...bench.wb.s.breakpoints];
  const start = (): void => debug.launch(program.path, breakAt);
  const attach = (): void => {
    const id = Number(pid.trim());
    if (Number.isInteger(id) && id > 0) debug.attach(id, breakAt);
  };
  const askStopped = (stopped: Extract<DebugStatus, { kind: "stopped" }>): void => {
    const stack = stopped.frames.slice(0, 8).map((f) => `  ${f.name}${f.line > 0 ? `:${f.line}` : ""}`).join("\n");
    const localScope = stopped.scopes.find((s) => /local/i.test(s.name)) ?? stopped.scopes[0];
    const locals = (localScope?.vars ?? []).slice(0, 20).map((v) => `  ${v.name} = ${v.value}`).join("\n");
    ask(bench, `The debugger stopped (${stopped.reason}) in ${program.name}.\n\nCall stack:\n${stack}\n\nLocals:\n${locals || "  (none)"}\n\nExplain where it is and what is happening here.`);
  };
  const { status } = debug;
  const pad = { display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflow: "scroll", padding: 16, gap: 12 } as const;
  return (
    <div style={pad}>
      {status.kind === "idle" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
          <div style={{ color: p.muted, maxWidth: 520 }}>{`Run ${program.name} under the debugger and stop when it reaches ${breakFn}. It runs the file as it is on disk, so it has to be a native ${program.arch} program.`}</div>
          <TextButton label={`Debug, breaking at ${breakFn}`} tone="primary" onClick={start} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <div style={{ color: p.muted }}>Or attach to a running process</div>
            <input {...TYPING} value={pid} placeholder="pid" aria-label="Process id" onChange={(e) => setPid(e.value ?? "")} onSubmit={attach} style={{ width: 80, height: 28, paddingLeft: 10, paddingRight: 10, borderWidth: 1, borderColor: p.line3, borderRadius: 7, backgroundColor: p.deep, fontSize: 12.5, color: p.text, ...MONO_STYLE }} />
            <TextButton label="Attach" tone="outline" onClick={attach} />
          </div>
        </div>
      )}
      {status.kind === "starting" && <div style={{ color: p.muted }}>Starting the debugger…</div>}
      {status.kind === "running" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flexGrow: 1, color: p.muted }}>Running…</div>
          <TextButton label="Stop" tone="outline" onClick={debug.stop} />
        </div>
      )}
      {status.kind === "stopped" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <TextButton label="Continue" tone="primary" onClick={debug.cont} />
            <TextButton label="Step over" tone="outline" onClick={debug.stepOver} />
            <TextButton label="Step into" tone="outline" onClick={debug.stepIn} />
            <TextButton label="Step out" tone="outline" onClick={debug.stepOut} />
            <TextButton label="Step instruction" tone="outline" onClick={debug.stepInstruction} />
            <TextButton label="Stop" tone="outline" onClick={debug.stop} />
            <TextButton label="Ask AI why it stopped" tone="outline" onClick={() => askStopped(status)} />
          </div>
          <Frames frames={status.frames} />
          <Scopes scopes={status.scopes} load={debug.loadVars} />
        </div>
      )}
      {status.kind === "exited" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
          <div style={{ color: p.muted }}>{status.code === null ? "The program finished." : `The program exited with code ${status.code}.`}</div>
          <TextButton label="Run again" tone="primary" onClick={start} />
        </div>
      )}
      {status.kind === "error" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
          <div style={{ color: p.error, maxWidth: 520 }}>{status.message}</div>
          <TextButton label="Try again" tone="outline" onClick={start} />
        </div>
      )}
    </div>
  );
}
