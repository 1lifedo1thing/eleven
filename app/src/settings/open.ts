import type { Page } from "./pages";

type Listener = (page: Page) => void;

const listeners = new Set<Listener>();

/** Opens Settings at a given page, from anywhere in the app. */
export function openSettings(page: Page): void {
  for (const listener of listeners) listener(page);
}

export function onOpenSettings(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
