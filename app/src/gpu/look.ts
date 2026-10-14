import type { StyleDesc } from "@gpuix/react";

import { DARK, type Palette } from "../theme";
import type { SpanTone } from "./types";

export type View = "shaders" | "models" | "profile";

export const VIEWS: readonly { readonly id: View; readonly label: string }[] = [
  { id: "shaders", label: "Shaders" },
  { id: "models", label: "Models" },
  { id: "profile", label: "GPU profile" },
];

const LEADING = 1.45;

/** Font size with the board's 1.45 line height, which GPUIX does not inherit as a ratio. */
export function text(size: number): StyleDesc {
  return { fontSize: size, lineHeight: size * LEADING };
}

export type Alert = { readonly bg: string; readonly line: string };

export function alertColors(p: Palette): Alert {
  return p === DARK ? { bg: "#160f10", line: "#3d2226" } : { bg: "#fdeeee", line: "#f1c6ca" };
}

const SPAN_RGB: Readonly<Record<SpanTone, string>> = {
  cpu: "127,212,255",
  wait: "255,107,129",
  kernel: "124,138,255",
  light: "143,227,196",
};

export function spanFill(tone: SpanTone, selected: boolean): string {
  return `rgba(${SPAN_RGB[tone]},${selected ? 0.45 : 0.25})`;
}

/** A kernel's name without its return type and parameter list: acc_f32, not void acc_f32(float const*, …). */
export function shortName(name: string): string {
  const bare = name.replace(/^(?:void|static|extern "C")\s+/, "");
  let depth = 0;
  for (let ix = 0; ix < bare.length; ix++) {
    const c = bare[ix];
    if (c === "<") depth++;
    else if (c === ">") depth--;
    else if (c === "(" && depth === 0) return bare.slice(0, ix);
  }
  return bare;
}
