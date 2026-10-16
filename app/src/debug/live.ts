export type DebugAction = "continue" | "pause" | "step_over" | "step_into" | "step_out" | "step_instruction";

export const DEBUG_ACTIONS: readonly DebugAction[] = ["continue", "pause", "step_over", "step_into", "step_out", "step_instruction"];

export function isDebugAction(value: string): value is DebugAction {
  return DEBUG_ACTIONS.some((action) => action === value);
}

/** What the open debug session lets an agent do. Every answer is plain text for the agent to read. */
export type DebugControl = {
  readonly describe: () => Promise<string>;
  readonly act: (action: DebugAction) => Promise<string>;
  readonly evaluate: (expression: string) => Promise<string>;
};

let control: DebugControl | null = null;

/** The debug view claims this while a session is open in it. */
export function claimDebug(next: DebugControl | null): void {
  control = next;
}

export function debugControl(): DebugControl | null {
  return control;
}
