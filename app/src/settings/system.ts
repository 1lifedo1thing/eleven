import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { promisify } from "node:util";

import { findOnPath } from "../agents/detect";
import { stringField } from "../lib/guards";
import { reaLaunch } from "../engine/rea";
import { currentSettings, type PathKey, pathSetting } from "./store";

export type Found =
  | { readonly kind: "found"; readonly path: string; readonly source: string }
  | { readonly kind: "missing"; readonly fix: string };

export function tildePath(path: string): string {
  const home = homedir();
  return path.startsWith(home) ? `~${path.slice(home.length)}` : path;
}

export function showInFinder(path: string): void {
  execFile("open", ["-R", path], () => {});
}

export function openLink(url: string): void {
  execFile("open", [url], () => {});
}

function fromEnv(key: PathKey, name: string, fix: string): Found {
  const path = pathSetting(key, name);
  if (path && existsSync(path)) return { kind: "found", path, source: currentSettings()[key] ? "Chosen in Settings" : "In use" };
  return { kind: "missing", fix };
}

export function findGhidraFolder(): Found {
  return fromEnv("ghidraDir", "GHIDRA_INSTALL_DIR", "Install Ghidra into ~/Applications or /Applications, or choose its folder here.");
}

export function findJavaFolder(): Found {
  return fromEnv("javaHome", "JAVA_HOME", "Install a Java 21 JDK, for example with brew install openjdk@21, or choose its folder here.");
}

function reaProgram(): string {
  const { command, args } = reaLaunch();
  return command === "node" ? (args[0] ?? command) : command;
}

export function findRea(): Found {
  const program = reaProgram();
  const source = currentSettings().reaPath ? "Chosen in Settings" : process.env.ELEVEN_REA ? "Set by ELEVEN_REA" : "Found on your PATH";
  const path = isAbsolute(program) ? (existsSync(program) ? program : null) : findOnPath(program);
  if (path) return { kind: "found", path, source };
  return { kind: "missing", fix: "Install REA so the rea command works in Terminal, or choose it here." };
}

function versionFromPackage(): string | null {
  try {
    return stringField(JSON.parse(readFileSync(join(import.meta.dir, "..", "..", "package.json"), "utf8")), "version") ?? null;
  } catch {
    return null;
  }
}

function versionFromBundle(): string | null {
  try {
    const plist = readFileSync(join(dirname(process.execPath), "..", "Info.plist"), "utf8");
    return /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/.exec(plist)?.[1] ?? null;
  } catch {
    return null;
  }
}

export function appVersion(): string {
  return versionFromPackage() ?? versionFromBundle() ?? "Unknown";
}

const execFileAsync = promisify(execFile);

/** Asks for a folder or a file with the macOS panel; null when you cancel. */
export async function pickPath(kind: "folder" | "file", prompt: string): Promise<string | null> {
  const script = `POSIX path of (choose ${kind} with prompt "${prompt.replace(/"/g, "")}")`;
  try {
    const { stdout } = await execFileAsync("osascript", ["-e", script]);
    const chosen = stdout.trim().replace(/(.)\/$/, "$1");
    return chosen === "" ? null : chosen;
  } catch {
    return null;
  }
}
