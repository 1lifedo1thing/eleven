import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { createContext, useContext } from "react";

import { isRecord } from "../../lib/guards";
import { supportDir } from "../../lib/support";
import { isNavSection, type NavSection } from "../state";

/** Which sections are folded, and which folders the user flipped from how they start, kept per project. */
export type Folds = { readonly closed: readonly NavSection[] | null; readonly flipped: readonly string[] };

function file(projectId: string): string {
  return join(supportDir(), "sidebar", `${projectId}.json`);
}

const strings = (value: unknown): readonly string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

export function loadFolds(projectId: string): Folds {
  try {
    const json: unknown = JSON.parse(readFileSync(file(projectId), "utf8"));
    if (!isRecord(json)) return { closed: null, flipped: [] };
    return { closed: Array.isArray(json.closed) ? strings(json.closed).filter(isNavSection) : null, flipped: strings(json.flipped) };
  } catch {
    return { closed: null, flipped: [] };
  }
}

export function saveFolds(projectId: string, folds: Folds): void {
  try {
    mkdirSync(dirname(file(projectId)), { recursive: true });
    writeFileSync(file(projectId), JSON.stringify(folds));
  } catch {
    return;
  }
}

/** Folders start closed unless they're alone at their level; clicking one flips it from that start. */
export type FolderState = { readonly isOpen: (key: string, byDefault?: boolean) => boolean; readonly toggle: (key: string) => void };

export const FolderContext = createContext<FolderState>({ isOpen: (_key, byDefault = false) => byDefault, toggle: () => {} });

export function useFolders(): FolderState {
  return useContext(FolderContext);
}
