import { chime, inFront, notify } from "../lib/platform";
import { currentSettings } from "../settings/store";

/** A desktop notification when an agent finishes while you are in another app. */
export async function notifyDone(agent: string): Promise<void> {
  if (!currentSettings().notifyWhenDone || (await inFront())) return;
  await notify("Eleven", `${agent} finished.`);
}

/** A short sound when an agent needs an answer from you. */
export async function chimeForAnswer(): Promise<void> {
  if (!currentSettings().soundWhenAsked) return;
  await chime();
}
