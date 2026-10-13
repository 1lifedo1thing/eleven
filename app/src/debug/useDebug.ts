import { useEffect, useRef, useState } from "react";

import { isRecord } from "../lib/guards";
import { currentSettings } from "../settings/store";
import { findLldbDap } from "./adapter";
import { splitArgs } from "./args";
import { DapClient, type StackFrame, type Variable } from "./dap";

export type LoadedScope = { readonly name: string; readonly reference: number; readonly vars: readonly Variable[] };

export type DebugStatus =
  | { readonly kind: "idle" }
  | { readonly kind: "starting" }
  | { readonly kind: "running" }
  | { readonly kind: "stopped"; readonly reason: string; readonly thread: number; readonly frames: readonly StackFrame[]; readonly scopes: readonly LoadedScope[] }
  | { readonly kind: "exited"; readonly code: number | null }
  | { readonly kind: "error"; readonly message: string };

export type Debug = {
  readonly status: DebugStatus;
  readonly launch: (program: string, breakAt: readonly string[]) => void;
  readonly attach: (pid: number, breakAt: readonly string[]) => void;
  readonly cont: () => void;
  readonly stepOver: () => void;
  readonly stepIn: () => void;
  readonly stepOut: () => void;
  readonly stepInstruction: () => void;
  readonly stop: () => void;
  readonly loadVars: (reference: number) => Promise<readonly Variable[]>;
};

function stoppedReason(body: unknown): string {
  return isRecord(body) && typeof body.reason === "string" ? body.reason : "stopped";
}

function threadOf(body: unknown): number {
  return isRecord(body) && typeof body.threadId === "number" ? body.threadId : 1;
}

function exitCode(body: unknown): number | null {
  return isRecord(body) && typeof body.exitCode === "number" ? body.exitCode : null;
}

/** Drives one lldb-dap debug session for the workbench: launch, breakpoints, stepping, and the stack and locals when stopped. */
export function useDebug(): Debug {
  const [status, setStatus] = useState<DebugStatus>({ kind: "idle" });
  const client = useRef<DapClient | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      void client.current?.disconnect();
      client.current = null;
    };
  }, []);

  const set = (next: DebugStatus): void => {
    if (alive.current) setStatus(next);
  };

  const onStopped = (dap: DapClient, body: unknown): void => {
    const thread = threadOf(body);
    void (async (): Promise<void> => {
      try {
        const frames = await dap.stackTrace(thread);
        const scopeList = frames[0] ? await dap.scopes(frames[0].id) : [];
        const scopes = await Promise.all(scopeList.map(async (scope) => ({ name: scope.name, reference: scope.reference, vars: await dap.variables(scope.reference) })));
        if (client.current === dap) set({ kind: "stopped", reason: stoppedReason(body), thread, frames, scopes });
      } catch {
        if (client.current === dap) set({ kind: "stopped", reason: stoppedReason(body), thread, frames: [], scopes: [] });
      }
    })();
  };

  const begin = (startRequest: (dap: DapClient) => Promise<void>, breakAt: readonly string[]): void => {
    if (status.kind === "starting" || status.kind === "running") return;
    const adapter = findLldbDap();
    if (!adapter) {
      set({ kind: "error", message: "Eleven needs lldb-dap to debug. Install Xcode's command line tools, or choose lldb-dap in Settings." });
      return;
    }
    set({ kind: "starting" });
    void client.current?.disconnect();
    const dap = new DapClient(adapter);
    client.current = dap;
    dap.on((event) => {
      if (client.current !== dap) return;
      if (event.event === "stopped") onStopped(dap, event.body);
      else if (event.event === "exited") set({ kind: "exited", code: exitCode(event.body) });
      else if (event.event === "terminated" && alive.current) setStatus((s) => (s.kind === "exited" ? s : { kind: "exited", code: null }));
    });
    void (async (): Promise<void> => {
      try {
        const initialized = dap.once("initialized");
        await dap.initialize();
        const started = startRequest(dap);
        await initialized;
        const addresses = breakAt.filter((at) => /^0x[0-9a-f]+$/i.test(at));
        const names = breakAt.filter((at) => !addresses.includes(at));
        if (names.length > 0) await dap.setFunctionBreakpoints(names);
        if (addresses.length > 0) await dap.setInstructionBreakpoints(addresses);
        await dap.configurationDone();
        await started;
        if (client.current === dap) set({ kind: "running" });
      } catch (err) {
        if (client.current === dap) set({ kind: "error", message: err instanceof Error ? err.message : String(err) });
      }
    })();
  };

  const launch = (program: string, breakAt: readonly string[]): void => {
    const { stopAtFunction, stopAtEntry, programArgs } = currentSettings();
    begin((dap) => dap.launch({ program, args: splitArgs(programArgs), stopOnEntry: stopAtEntry }), stopAtFunction ? breakAt : []);
  };
  const attach = (pid: number, breakAt: readonly string[]): void => begin((dap) => dap.attach(pid), breakAt);

  const step = (verb: "cont" | "over" | "in" | "out" | "instr"): void => {
    const dap = client.current;
    if (!dap || status.kind !== "stopped") return;
    const thread = status.thread;
    set({ kind: "running" });
    const call =
      verb === "cont" ? dap.continue(thread)
      : verb === "over" ? dap.next(thread)
      : verb === "in" ? dap.stepIn(thread)
      : verb === "out" ? dap.stepOut(thread)
      : dap.next(thread, "instruction");
    void call.catch((err: unknown) => set({ kind: "error", message: err instanceof Error ? err.message : String(err) }));
  };

  const stop = (): void => {
    void client.current?.disconnect();
    client.current = null;
    set({ kind: "idle" });
  };

  const loadVars = (reference: number): Promise<readonly Variable[]> => client.current?.variables(reference) ?? Promise.resolve([]);

  return { status, launch, attach, cont: () => step("cont"), stepOver: () => step("over"), stepIn: () => step("in"), stepOut: () => step("out"), stepInstruction: () => step("instr"), stop, loadVars };
}
