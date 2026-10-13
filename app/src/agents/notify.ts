import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { currentSettings } from "../settings/store";

const run = promisify(execFile);
const ASK_SOUND = "/System/Library/Sounds/Glass.aiff";

async function elevenInFront(): Promise<boolean> {
  try {
    const { stdout } = await run("osascript", ["-e", 'tell application "System Events" to get unix id of first application process whose frontmost is true']);
    return Number(stdout.trim()) === process.pid;
  } catch {
    return false;
  }
}

function quoted(text: string): string {
  return `"${text.replace(/["\\]/g, "\\$&")}"`;
}

/** A macOS notification when an agent finishes while you are in another app. */
export async function notifyDone(agent: string): Promise<void> {
  if (process.platform !== "darwin" || !currentSettings().notifyWhenDone || (await elevenInFront())) return;
  try {
    await run("osascript", ["-e", `display notification ${quoted(`${agent} finished.`)} with title "Eleven"`]);
  } catch {
    return;
  }
}

/** A short sound when an agent needs an answer from you. */
export async function chimeForAnswer(): Promise<void> {
  if (process.platform !== "darwin" || !currentSettings().soundWhenAsked) return;
  try {
    await run("afplay", [ASK_SOUND]);
  } catch {
    return;
  }
}
