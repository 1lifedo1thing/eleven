import { useEffect, useRef, useState } from "react";

import { isRecord } from "../lib/guards";
import { currentSettings } from "../settings/store";
import { findLldbDap } from "./adapter";
import { splitArgs } from "./args";
import { DapClient, type StackFrame, type Thread, type Variable } from "./dap";

export type OutputLine = { readonly kind: "program" | "error" | "asked" | "answer"; readonly text: string };

const OUTPUT_LIMIT = 2000;

export type LoadedScope = { readonly name: string; readonly reference: number; readonly vars: readonly Variable[] };

export type DebugStatus =
  | { readonly kind: "idle" }
  | { readonly kind: "starting" }
  | { readonly kind: "running" }
  | { readonly kind: "stopped"; readonly reason: string; readonly thread: number; readonly frames: readonly StackFrame[]; readonly scopes: readonly LoadedScope[]; readonly threads: readonly Thread[] }
  | { readonly kind: "exited"; readonly code: number | null }
  | { readonly kind: "error"; readonly message: string };

export type Debug = {
  readonly status: DebugStatus;
  /** What the program printed, and expressions you evaluated with their results. */
  readonly output: readonly OutputLine[];
  readonly launch: (program: string, breakAt: readonly string[]) => void;
  readonly attach: (pid: number, breakAt: readonly string[]) => void;
  readonly cont: () => void;
  readonly stepOver: () => void;
  readonly stepIn: () => void;
  readonly stepOut: () => void;
  readonly stepInstruction: () => void;
  readonly stop: () => void;
  readonly pause: () => void;
  /** Stops the session and starts it again the same way. */
  readonly restart: () => void;
  readonly evaluate: (expression: string) => void;
  /** Starts the last session again the same way, launched or attached. */
  readonly retry: () => void;
  /** Replaces the breakpoints of the running session, if there is one. */
  readonly syncBreakpoints: (breakAt: readonly string[]) => void;
  readonly loadVars: (reference: number) => Promise<readonly Variable[]>;
};

function stoppedReason(body: unknown): string {
  return isRecord(body) && typeof body.reason === "string" ? body.reason : "stopped";
}

function threadOf(body: unknown): number {
  return isRecord(body) && typeof body.threadId === "number" ? body.threadId : 1;
}

async function sendBreakpoints(dap: DapClient, breakAt: readonly string[]): Promise<void> {
  const addresses = breakAt.filter((at) => /^0x[0-9a-f]+$/i.test(at));
  await dap.setFunctionBreakpoints(breakAt.filter((at) => !addresses.includes(at)));
  await dap.setInstructionBreakpoints(addresses);
}

function outputOf(body: unknown): OutputLine | null {
  if (!isRecord(body) || typeof body.output !== "string") return null;
  if (body.category === "telemetry" || body.category === "console") return null;
  return { kind: body.category === "stderr" ? "error" : "program", text: body.output.replace(/\r?\n$/, "") };
}

function exitCode(body: unknown): number | null {
  return isRecord(body) && typeof body.exitCode === "number" ? body.exitCode : null;
}

/** Drives one lldb-dap debug session for the workbench: launch, breakpoints, stepping, and the stack and locals when stopped. */
export function useDebug(): Debug {
  const [status, setStatus] = useState<DebugStatus>({ kind: "idle" });
  const [output, setOutput] = useState<readonly OutputLine[]>([]);
  const client = useRef<DapClient | null>(null);
  const alive = useRef(true);
  const last = useRef<(() => void) | null>(null);
  const now = useRef<DebugStatus>(status);
  const lastThread = useRef(1);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      void client.current?.disconnect();
      client.current = null;
    };
  }, []);

  const set = (next: DebugStatus): void => {
    now.current = next;
    if (next.kind === "stopped") lastThread.current = next.thread;
    if (alive.current) setStatus(next);
  };
  const print = (line: OutputLine): void => {
    if (alive.current) setOutput((lines) => [...lines, line].slice(-OUTPUT_LIMIT));
  };

  const onStopped = (dap: DapClient, body: unknown): void => {
    const thread = threadOf(body);
    void (async (): Promise<void> => {
      try {
        const [frames, threads] = await Promise.all([dap.stackTrace(thread), dap.threads().catch(() => [])]);
        const scopeList = frames[0] ? await dap.scopes(frames[0].id) : [];
        const scopes = await Promise.all(scopeList.map(async (scope) => ({ name: scope.name, reference: scope.reference, vars: await dap.variables(scope.reference) })));
        if (client.current === dap) set({ kind: "stopped", reason: stoppedReason(body), thread, frames, scopes, threads });
      } catch {
        if (client.current === dap) set({ kind: "stopped", reason: stoppedReason(body), thread, frames: [], scopes: [], threads: [] });
      }
    })();
  };

  const begin = (startRequest: (dap: DapClient) => Promise<void>, breakAt: readonly string[]): void => {
    if (now.current.kind === "starting" || now.current.kind === "running") return;
    const adapter = findLldbDap();
    if (!adapter) {
      set({ kind: "error", message: "Eleven needs lldb-dap to debug. Install Xcode's command line tools, or choose lldb-dap in Settings." });
      return;
    }
    set({ kind: "starting" });
    setOutput([]);
    void client.current?.disconnect();
    const dap = new DapClient(adapter);
    client.current = dap;
    dap.on((event) => {
      if (client.current !== dap) return;
      if (event.event === "stopped") onStopped(dap, event.body);
      else if (event.event === "output") {
        const line = outputOf(event.body);
        if (line) print(line);
      }
      else if (event.event === "exited") set({ kind: "exited", code: exitCode(event.body) });
      else if (event.event === "terminated" && now.current.kind !== "exited") set({ kind: "exited", code: null });
    });
    void (async (): Promise<void> => {
      try {
        const initialized = dap.once("initialized");
        await dap.initialize();
        const started = startRequest(dap);
        await initialized;
        await sendBreakpoints(dap, breakAt);
        await dap.configurationDone();
        await started;
        if (client.current === dap) set({ kind: "running" });
      } catch (err) {
        if (client.current === dap) set({ kind: "error", message: err instanceof Error ? err.message : String(err) });
      }
    })();
  };

  const launch = (program: string, breakAt: readonly string[]): void => {
    last.current = () => launch(program, breakAt);
    const { stopAtEntry, programArgs } = currentSettings();
    begin((dap) => dap.launch({ program, args: splitArgs(programArgs), stopOnEntry: stopAtEntry }), breakAt);
  };
  const attach = (pid: number, breakAt: readonly string[]): void => {
    last.current = () => attach(pid, breakAt);
    begin((dap) => dap.attach(pid), breakAt);
  };
  const retry = (): void => last.current?.();
  const syncBreakpoints = (breakAt: readonly string[]): void => {
    const dap = client.current;
    if (!dap || status.kind === "idle" || status.kind === "starting" || status.kind === "exited" || status.kind === "error") return;
    void sendBreakpoints(dap, breakAt).catch(() => undefined);
  };

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

  const pause = (): void => {
    if (status.kind === "running") void client.current?.pause(lastThread.current).catch(() => undefined);
  };

  const restart = (): void => {
    void client.current?.disconnect();
    client.current = null;
    set({ kind: "idle" });
    retry();
  };

  const evaluate = (expression: string): void => {
    const dap = client.current;
    if (!dap || !expression.trim()) return;
    print({ kind: "asked", text: expression });
    const frameId = status.kind === "stopped" ? (status.frames[0]?.id ?? null) : null;
    void (async (): Promise<void> => {
      try {
        print({ kind: "answer", text: await dap.evaluate(expression, frameId) });
      } catch (err) {
        print({ kind: "error", text: err instanceof Error ? err.message : String(err) });
      }
    })();
  };

  const loadVars = (reference: number): Promise<readonly Variable[]> => client.current?.variables(reference) ?? Promise.resolve([]);

  return { status, output, launch, attach, cont: () => step("cont"), stepOver: () => step("over"), stepIn: () => step("in"), stepOut: () => step("out"), stepInstruction: () => step("instr"), stop, pause, restart, evaluate, retry, syncBreakpoints, loadVars };
}
