import { basename } from "node:path";

import { hostSlice, kindOf } from "./files";
import type { Slice, SliceChoice } from "./SliceDialog";

const COUNTS = ["", "one", "two", "three", "four"] as const;

function isIntel(arch: string): boolean {
  return arch === "x86_64" || arch === "x86_64h" || arch === "i386";
}

function sliceName(arch: string): string {
  if (arch === "arm64e" || arch === "arm64") return "Apple silicon";
  if (arch === "i386") return "Intel, 32-bit";
  return isIntel(arch) ? "Intel" : arch;
}

function sliceNote(arch: string, host: string | null): string {
  if (arch === host) return "Matches this Mac";
  if (isIntel(arch) && process.arch === "arm64") return "Runs under Rosetta here";
  if (!isIntel(arch) && process.arch === "arm64") return "Runs on this Mac";
  return "Won't run here, but you can still read it";
}

/** The dialog contents for a universal file, with this Mac's slice first and picked. */
export function sliceChoice(path: string, archs: readonly string[], matchThisMac: boolean): SliceChoice {
  const host = hostSlice(archs);
  const ordered = [...archs].sort((a, b) => Number(b === host) - Number(a === host));
  const slices: readonly Slice[] = ordered.map((arch) => ({ arch, name: sliceName(arch), note: sliceNote(arch, host) }));
  const stem = basename(path).replace(/\.app$/, "");
  const count = COUNTS[archs.length] ?? String(archs.length);
  const what = kindOf(path) === "app" ? "app" : "binary";
  return {
    title: `${stem} has ${count} versions inside`,
    note: `It's a universal ${what}. Pick the one to take apart.`,
    slices,
    chosen: host ?? ordered[0] ?? "",
    matchThisMac,
  };
}
