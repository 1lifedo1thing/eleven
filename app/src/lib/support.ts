import { join } from "node:path";
import { dataRoot } from "./platform";

/**
 * Eleven's data directory: renames, bookmarks, notes, saved threads and settings.
 * `ELEVEN_SUPPORT` overrides it, so tests can point at a throwaway dir and never
 * touch the user's real data.
 */
export function supportDir(): string {
  return process.env.ELEVEN_SUPPORT ?? dataRoot();
}

export function supportPath(...parts: readonly string[]): string {
  return join(supportDir(), ...parts);
}
