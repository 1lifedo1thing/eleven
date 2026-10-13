import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readlinkSync } from "node:fs";
import { homedir, totalmem } from "node:os";
import { dirname, join } from "node:path";

import { supportPath } from "../lib/support";
import { currentSettings, type Settings } from "../settings/store";

const HOME = homedir();

/** Where Eleven puts the Java and Ghidra it downloads for you. */
export function enginesDir(): string {
  return supportPath("engines");
}

const GHIDRA_PARENTS = [
  enginesDir(),
  join(HOME, ".local", "share"),
  join(HOME, "Applications"),
  HOME,
  "/Applications",
  "/opt",
  "/opt/homebrew/Caskroom/ghidra",
  "/usr/local/Caskroom/ghidra",
] as const;

const JDK_GLOBS: readonly (readonly [parent: string, suffix: string])[] = [
  [enginesDir(), "Contents/Home"],
  ["/Library/Java/JavaVirtualMachines", "Contents/Home"],
  ["/opt/homebrew/Cellar/openjdk@21", "libexec/openjdk.jdk/Contents/Home"],
  ["/opt/homebrew/Cellar/openjdk", "libexec/openjdk.jdk/Contents/Home"],
  ["/usr/local/Cellar/openjdk", "libexec/openjdk.jdk/Contents/Home"],
  ["/opt/zerobrew/prefix/Cellar/openjdk", "libexec/openjdk.jdk/Contents/Home"],
  [join(HOME, "Library", "Java", "JavaVirtualMachines"), "Contents/Home"],
];

function children(dir: string): readonly string[] {
  try {
    return readdirSync(dir).map((name) => join(dir, name));
  } catch {
    return [];
  }
}

function versionOf(path: string): readonly number[] {
  return (path.match(/\d+(\.\d+)*/g)?.at(-1) ?? "0").split(".").map(Number);
}

function newestFirst(a: string, b: string): number {
  const [x, y] = [versionOf(a), versionOf(b)];
  for (let ix = 0; ix < Math.max(x.length, y.length); ix++) {
    const diff = (y[ix] ?? 0) - (x[ix] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function ghidraHomes(parent: string): readonly string[] {
  return children(parent).flatMap((dir) => [dir, ...children(dir)]).filter((dir) => /ghidra_[\d.]+_PUBLIC$/i.test(dir) && existsSync(join(dir, "support", "analyzeHeadless")));
}

function findGhidra(): string | null {
  return GHIDRA_PARENTS.flatMap(ghidraHomes).sort(newestFirst)[0] ?? null;
}

function findJdk(): string | null {
  const homes = JDK_GLOBS.flatMap(([parent, suffix]) => children(parent).map((dir) => join(dir, suffix)));
  return homes.filter((home) => existsSync(join(home, "bin", "java"))).sort(newestFirst)[0] ?? null;
}

/** Bun formats dates in UTC unless TZ is set, so take the Mac's own zone from /etc/localtime. */
function localZone(): string | null {
  try {
    return /zoneinfo\/(.+)$/.exec(readlinkSync("/etc/localtime"))?.[1] ?? null;
  } catch {
    return null;
  }
}

const BUNDLED_NODE = join(dirname(process.execPath), "..", "Resources", "node", "bin", "node");

const RIZINS = [join(dirname(process.execPath), "..", "Resources", "rizin", "bin", "rizin"), "/opt/homebrew/bin/rizin", "/usr/local/bin/rizin"] as const;

/** The Rizin inside Eleven.app, else one already on this Mac. */
function findRizin(): string | null {
  return RIZINS.find((path) => existsSync(path)) ?? null;
}

/** The Node that runs REA: the one inside Eleven.app when it ships one, otherwise the user's. */
export function nodeCommand(): string {
  return existsSync(BUNDLED_NODE) ? BUNDLED_NODE : "node";
}

const MIN_REA_MAJOR = 6;

const REA_CHECKOUTS = [
  join(dirname(process.execPath), "..", "Resources", "rea", "scripts", "rea.mjs"),
  join(import.meta.dir, "..", "..", "..", "..", "rea", "scripts", "rea.mjs"),
] as const;

function reaMajor(command: string, args: readonly string[]): number {
  try {
    const version = execFileSync(command, [...args, "--version"], { encoding: "utf8", timeout: 5000 }).trim();
    return Number(version.split(".")[0]) || 0;
  } catch {
    return 0;
  }
}

/** REA 6+ runs Ghidra on Apple Silicon; older `rea` builds on PATH refuse it, so a fork checkout wins over them. */
function findRea(): string | null {
  const checkout = REA_CHECKOUTS.find((path) => existsSync(path) && reaMajor(nodeCommand(), [path]) >= MIN_REA_MAJOR);
  if (checkout) return checkout;
  return reaMajor("rea", []) >= MIN_REA_MAJOR ? "rea" : null;
}

const DEFAULT_SKIPPED = ["Decompiler Parameter ID", "Decompiler Switch Analysis", "Aggressive Instruction Finder"] as const;

function ghidraMemory(choice: Settings["ghidraMemory"]): string | null {
  switch (choice) {
    case "Automatic":
      return null;
    case "4 GB":
      return "4G";
    case "8 GB":
      return "8G";
    case "16 GB":
      return "16G";
    default: {
      const unhandled: never = choice;
      return unhandled;
    }
  }
}

function skippedAnalyzers(settings: Settings): string | null {
  const wanted = [settings.findParameters, settings.rebuildSwitches, settings.hiddenCode];
  if (wanted.every((on) => !on)) return null;
  return DEFAULT_SKIPPED.filter((_name, ix) => !wanted[ix]).join(",");
}

/** Fills in GHIDRA_INSTALL_DIR, JAVA_HOME and ELEVEN_REA from the usual spots, so a Finder launch can still reach Ghidra. */
export function adoptToolchain(): void {
  const settings = currentSettings();
  const ghidra = settings.ghidraDir || INHERITED.GHIDRA_INSTALL_DIR || findGhidra();
  const jdk = settings.javaHome || INHERITED.JAVA_HOME || findJdk();
  setEnv("GHIDRA_INSTALL_DIR", ghidra);
  setEnv("JAVA_HOME", jdk);
  const zone = localZone();
  if (!process.env.TZ && zone) process.env.TZ = zone;
  const memory = ghidraMemory(currentSettings().ghidraMemory);
  if (memory) process.env.GHIDRA_HEADLESS_MAXMEM = memory;
  else if (!process.env.GHIDRA_HEADLESS_MAXMEM && !process.env.GHIDRA_MAXMEM) {
    const gb = Math.max(2, Math.min(4, Math.floor(totalmem() / 1024 ** 3 / 4)));
    process.env.GHIDRA_HEADLESS_MAXMEM = `${gb}G`;
  }
  const skipped = skippedAnalyzers(currentSettings());
  if (skipped !== null) process.env.REA_GHIDRA_DISABLED_ANALYZERS = skipped;
  else if (process.env.REA_GHIDRA_DISABLED_ANALYZERS === undefined) process.env.REA_GHIDRA_DISABLED_ANALYZERS = DEFAULT_SKIPPED.join(",");
  if (!process.env.REA_ANALYSIS_PROVIDER) process.env.REA_ANALYSIS_PROVIDER = "ghidra";
  setEnv("ELEVEN_REA", settings.reaPath || INHERITED.ELEVEN_REA || findRea());
  setEnv("ELEVEN_RIZIN", settings.rizinPath || INHERITED.ELEVEN_RIZIN || findRizin());
  setEnv("ELEVEN_LLDB_DAP", settings.lldbDap || INHERITED.ELEVEN_LLDB_DAP);
  setEnv("ELEVEN_EXPORT_DIR", settings.exportDir || INHERITED.ELEVEN_EXPORT_DIR);
}

const INHERITED: Readonly<Record<string, string | undefined>> = { ...process.env };

/** Sets or clears a variable, so resetting a folder in Settings takes effect without a restart. */
function setEnv(name: string, value: string | null | undefined): void {
  if (value) process.env[name] = value;
  else delete process.env[name];
}
