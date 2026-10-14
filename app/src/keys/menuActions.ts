import { useEffect, useRef } from "react";

/** Menu bar items that are not keyboard commands; the screen that can do one registers it. */
export const MENU_ACTION_IDS = ["exportPseudocode", "exportAssembly", "exportAllPseudocode", "exportObjc", "compare", "writePatched", "sidebar"] as const;

export type MenuActionId = (typeof MENU_ACTION_IDS)[number];

type Handler = () => void;

const handlers = new Map<MenuActionId, Handler>();
const watchers = new Set<() => void>();

function changed(): void {
  for (const watcher of watchers) watcher();
}

export function isMenuActionId(value: string): value is MenuActionId {
  return MENU_ACTION_IDS.some((id) => id === value);
}

export function hasMenuAction(id: MenuActionId): boolean {
  return handlers.has(id);
}

export function runMenuAction(id: MenuActionId): void {
  handlers.get(id)?.();
}

export function onMenuActionsChange(watcher: () => void): () => void {
  watchers.add(watcher);
  return () => {
    watchers.delete(watcher);
  };
}

/** Offers a menu bar item while mounted; null greys it out. */
export function useMenuAction(id: MenuActionId, handler: Handler | null): void {
  const latest = useRef(handler);
  latest.current = handler;
  const offered = handler !== null;
  useEffect(() => {
    if (!offered) return;
    handlers.set(id, () => latest.current?.());
    changed();
    return () => {
      handlers.delete(id);
      changed();
    };
  }, [id, offered]);
}
