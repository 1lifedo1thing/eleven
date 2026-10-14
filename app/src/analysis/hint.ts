import { DALVIK, jadxCommand } from "../engine/jadx";
import { rizinProgram } from "../engine/rizin";
import { activeBackend, activeProvider } from "./engines";

/** How the agent should read a binary with the engine chosen in Settings, so it never starts Ghidra behind a Rizin choice. */
export function engineHint(path: string, arch: string): string {
  if (arch === DALVIK) return androidHint(path);
  if (activeBackend() === "rizin") {
    return `Eleven reads this with Rizin, not Ghidra. Don't call open_binary, which would start Ghidra. Run the rizin command line instead (${rizinProgram()}), for example: rizin -q -c "aaa; afl" ${path}`;
  }
  const provider = activeProvider();
  if (!provider) return "No analysis engine is on in Eleven. Ask the user to turn one on in Settings before reading the file.";
  return `Use the eleven-rea MCP tools (REA): call open_binary with ${path} and provider_id "${provider}" first.`;
}

/** Android apps are read with jadx, the way the workbench reads them, never Ghidra. */
export function androidHint(path: string): string {
  const jadx = jadxCommand() ?? "jadx";
  return `Eleven reads this Android app with jadx, not Ghidra. Don't call open_binary on it, which would start Ghidra. Use the eleven tools to show methods to the user, and run the jadx command line to read code, for example: ${jadx} -d <output folder> ${path}. Only native .so libraries unpacked from the app go to open_binary.`;
}
