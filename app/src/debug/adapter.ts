import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

import { pathSetting } from "../settings/store";

/** Where lldb-dap lives: the lldb-dap chosen in Settings (or ELEVEN_LLDB_DAP), Xcode's copy via xcrun, or one on PATH. Null when none is installed. */
export function findLldbDap(): string | null {
  const override = pathSetting("lldbDap", "ELEVEN_LLDB_DAP");
  if (override) return existsSync(override) ? override : null;
  try {
    const viaXcrun = execFileSync("xcrun", ["-f", "lldb-dap"], { encoding: "utf8" }).trim();
    if (viaXcrun && existsSync(viaXcrun)) return viaXcrun;
  } catch {
    // fall through to PATH
  }
  try {
    return execFileSync("which", ["lldb-dap"], { encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
}
