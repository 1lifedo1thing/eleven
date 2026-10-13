import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

import { isElevenFile, openDocument } from "./document";
import { isAndroidCode } from "./jadx";

export type TargetKind = "binary" | "app" | "gpu" | "model";

export type Target = {
  /** What the user picked: an app bundle or a file. */
  readonly original: string;
  /** The single-architecture binary REA analyzes. */
  readonly path: string;
  readonly name: string;
  readonly meta: string;
  readonly arch: string;
  readonly kind: TargetKind;
};

const KINDS: readonly TargetKind[] = ["binary", "app", "gpu", "model"];

function isKind(value: string): value is TargetKind {
  return KINDS.some((kind) => kind === value);
}

const HOST_SLICES = ["arm64e", "arm64"] as const;
const SLICE_DIR = join(homedir(), "Library", "Caches", "eleven", "slices");

const ARCH_WORDS = ["arm64e", "arm64", "aarch64", "x86_64", "x86-64", "i386", "80386", "armv7", "arm", "ppc64", "ppc", "mips", "riscv"] as const;

function tool(command: string, args: readonly string[]): string {
  try {
    return execFileSync(command, [...args], { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function bundleExecutable(app: string): string {
  const name = tool("plutil", ["-extract", "CFBundleExecutable", "raw", join(app, "Contents", "Info.plist")]);
  const exe = join(app, "Contents", "MacOS", name);
  return name && existsSync(exe) ? exe : app;
}

function kindOf(name: string, isApp: boolean): TargetKind {
  if (isApp) return "app";
  if (/\.(metallib|spv|air)$/i.test(name)) return "gpu";
  if (/\.(mlmodelc|gguf|safetensors|onnx|pt|tflite)$/i.test(name)) return "model";
  return "binary";
}

function formatOf(info: string): string {
  if (info.startsWith("Mach-O")) return "Mach-O";
  if (info.startsWith("ELF")) return "ELF";
  if (info.startsWith("PE32")) return "PE";
  return info.split(/[ ,]/)[0] || "File";
}

/** The CPU from a `file` description, for ELF and PE where lipo reads nothing. */
function archFromFile(info: string): string {
  const word = ARCH_WORDS.find((a) => info.toLowerCase().includes(a));
  if (word === "x86-64" || word === "x86_64") return "x86_64";
  if (word === "80386") return "i386";
  if (word === "aarch64") return "arm64";
  return word ?? "";
}

function thinSlice(executable: string, slice: string): string {
  const digest = createHash("sha256").update(readFileSync(executable)).digest("hex").slice(0, 16);
  const dir = join(SLICE_DIR, digest);
  const thin = join(dir, `${basename(executable)}-${slice}`);
  if (existsSync(thin)) return thin;
  mkdirSync(dir, { recursive: true });
  execFileSync("lipo", [executable, "-thin", slice, "-output", thin]);
  return thin;
}

/** Resolves an app bundle to its executable, a universal Mach-O to this Mac's slice, and reads the arch of ELF and PE files. */
export function prepareTarget(original: string, pick: string | null = null): Target {
  if (isElevenFile(original)) {
    const { manifest, binary } = openDocument(original);
    return { original, path: binary, name: manifest.name, meta: manifest.meta, arch: manifest.arch, kind: isKind(manifest.kind) ? manifest.kind : "binary" };
  }
  const isApp = original.endsWith(".app") && statSync(original).isDirectory();
  const executable = isApp ? bundleExecutable(original) : original;
  const info = tool("file", ["-b", executable]);
  const format = formatOf(info);
  const base = { original, name: basename(original), kind: kindOf(basename(original), isApp) };
  if (!isApp && isAndroidCode(executable)) return { ...base, path: executable, arch: "dalvik", meta: "Android · Dalvik" };
  const archs = format === "Mach-O" ? tool("lipo", ["-archs", executable]).split(/\s+/).filter(Boolean) : [];
  if (archs.length > 1) {
    const slice = pick !== null && archs.includes(pick) ? pick : HOST_SLICES.find((a) => archs.includes(a)) ?? archs[0] ?? "";
    return { ...base, path: thinSlice(executable, slice), arch: slice, meta: `${format} · universal · ${archs.length} slices` };
  }
  const arch = archs[0] ?? archFromFile(info);
  return { ...base, path: executable, arch, meta: [format, arch].filter(Boolean).join(" · ") };
}
