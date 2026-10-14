import { type ChildProcess, type ChildProcessWithoutNullStreams, type ExecFileOptions, type ExecFileSyncOptions, execFile, execFileSync, type SpawnOptions, type SpawnOptionsWithoutStdio, spawn } from "node:child_process";
import { promisify } from "node:util";

/** Every program Eleven starts goes through here, so on Windows none of them opens a console window of its own. */
const HIDDEN = { windowsHide: true } as const;

const exec = promisify(execFile);

/** Runs a program to completion and returns its text output. */
export function run(file: string, args: readonly string[] = [], options: ExecFileOptions = {}): Promise<{ readonly stdout: string; readonly stderr: string }> {
  return exec(file, [...args], { ...options, ...HIDDEN, encoding: "utf8" });
}

/** The same, for programs whose output is binary. */
export function runBytes(file: string, args: readonly string[] = [], options: ExecFileOptions = {}): Promise<{ readonly stdout: Buffer; readonly stderr: Buffer }> {
  return exec(file, [...args], { ...options, ...HIDDEN, encoding: "buffer" });
}

/** Runs a program to completion, blocking, and returns its text output. */
export function runSync(file: string, args: readonly string[] = [], options: ExecFileSyncOptions = {}): string {
  return execFileSync(file, [...args], { ...options, ...HIDDEN, encoding: "utf8" });
}

/** Starts a long-running program with its input and output piped to Eleven. */
export function start(command: string, args: readonly string[] = [], options: SpawnOptionsWithoutStdio = {}): ChildProcessWithoutNullStreams {
  return spawn(command, [...args], { ...options, ...HIDDEN });
}

/** Starts a program with its own stdio setup, like a detached helper or one whose output is ignored. */
export function startWith(command: string, args: readonly string[], options: SpawnOptions): ChildProcess {
  return spawn(command, [...args], { ...options, ...HIDDEN });
}

/** Stops a program and everything it started. On Windows killing the parent leaves its children running, like an agent behind an npm launcher. */
export function stop(child: ChildProcess): void {
  if (process.platform === "win32" && child.pid !== undefined) {
    startWith("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" }).on("error", () => child.kill());
    return;
  }
  child.kill();
}
