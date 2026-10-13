import { homedir } from "node:os";

import { currentSettings } from "../settings/store";

/** With "Hide my folder paths" on, the home folder reads as ~ in anything Eleven hands an agent. */
export function hidePaths(text: string, hide: boolean = currentSettings().hidePaths): string {
  const home = homedir();
  return hide && home.length > 1 ? text.split(home).join("~") : text;
}
