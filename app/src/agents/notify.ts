import { chime } from "../lib/platform";
import { currentSettings } from "../settings/store";

/** A short sound when an agent needs an answer from you. */
export async function chimeForAnswer(): Promise<void> {
  if (!currentSettings().soundWhenAsked) return;
  await chime();
}
