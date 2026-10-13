import type { StyleDesc } from "@gpuix/react";

import { DARK, type Palette } from "../theme";

export const OK_WASH = "rgba(152,195,121,0.14)";
export const PROBLEM_WASH = "rgba(224,108,117,0.14)";

/** The board sets every line at 1.5 times its font size. */
export function lineHeight(fontSize: number): number {
  return fontSize * 1.5;
}

export function scrim(p: Palette): string {
  return p === DARK ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.25)";
}

export type Glass = { readonly card: string; readonly edge: string; readonly line: string; readonly tile: string };

/** In dark mode the welcome cards let the frosted window show through; in light mode they are solid white. */
export function glass(p: Palette): Glass {
  return p === DARK
    ? { card: "rgba(255,255,255,0.045)", edge: "rgba(255,255,255,0.09)", line: "rgba(255,255,255,0.06)", tile: "rgba(255,255,255,0.07)" }
    : { card: "#ffffff", edge: "rgba(0,0,0,0.07)", line: "rgba(0,0,0,0.06)", tile: "rgba(0,0,0,0.05)" };
}

export function dialogShadow(p: Palette): NonNullable<StyleDesc["boxShadow"]> {
  return { offsetX: 0, offsetY: 24, blurRadius: 60, spreadRadius: 0, color: p === DARK ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.16)" };
}

export const HOVER = { opacity: 0.72 } as const;

