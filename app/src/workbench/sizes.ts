import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { isRecord } from "../lib/guards";
import { supportPath } from "../lib/support";
import { currentSettings } from "../settings/store";
import { clearThreadTabs } from "./threadTabs";

export type Edge = "sidebar" | "dock" | "details";

export type Sizes = Readonly<Record<Edge, number>>;

const FILE = supportPath("layout.json");
export const DEFAULT_SIZES: Sizes = { sidebar: 268, dock: 480, details: 173 };
const LIMITS: Readonly<Record<Edge, readonly [number, number]>> = { sidebar: [200, 480], dock: [400, 760], details: [96, 560] };

export function clampSize(edge: Edge, size: number): number {
  const [min, max] = LIMITS[edge];
  return Math.round(Math.min(max, Math.max(min, size)));
}

export function loadSizes(): Sizes {
  if (!currentSettings().restoreLayout) return DEFAULT_SIZES;
  try {
    const json: unknown = JSON.parse(readFileSync(FILE, "utf8"));
    if (!isRecord(json)) return DEFAULT_SIZES;
    const read = (edge: Edge): number => {
      const value = json[edge];
      return typeof value === "number" ? clampSize(edge, value) : DEFAULT_SIZES[edge];
    };
    return { sidebar: read("sidebar"), dock: read("dock"), details: read("details") };
  } catch {
    return DEFAULT_SIZES;
  }
}

export function saveSizes(sizes: Sizes): void {
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, `${JSON.stringify(sizes, null, 2)}\n`);
  } catch {
    return;
  }
}

const resetListeners = new Set<() => void>();

/** Runs when the saved layout is reset, so open workbenches go back to the default sizes. */
export function onLayoutReset(listener: () => void): () => void {
  resetListeners.add(listener);
  return () => {
    resetListeners.delete(listener);
  };
}

export function resetWorkbenchLayout(): void {
  try {
    rmSync(FILE, { force: true });
  } catch {
    return;
  }
  clearThreadTabs();
  for (const listener of resetListeners) listener();
}
