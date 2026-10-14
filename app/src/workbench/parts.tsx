import type { StyleDesc } from "@gpuix/react";
import { createContext, type ReactElement, useContext } from "react";

import { DARK, MONO, type Palette, useTheme } from "../theme";
import { Button, type ButtonTone, Tooltip } from "../components/kit";
import { Icon } from "../components/ui";
import type { GpuSource } from "../gpu/source";
import type { GpuData } from "../gpu/useGpu";
import type { Target } from "../engine/target";
import type { Chat } from "../chat/useChat";
import type { Loaded } from "../lib/useLoaded";
import type { Program } from "./model";
import type { Workbench } from "./state";

export const HOVER = { opacity: 0.72 } as const;

export const MONO_STYLE = { fontFamily: MONO } as const;

export const ELLIPSIS = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;

export function overlay(p: Palette): { readonly shadow: string; readonly scrim: string } {
  return p.card === DARK.card ? { shadow: "rgba(0,0,0,0.6)", scrim: "rgba(0,0,0,0.5)" } : { shadow: "rgba(0,0,0,0.16)", scrim: "rgba(0,0,0,0.25)" };
}

export type Bench = {
  readonly program: Program;
  readonly compare: Program | null;
  readonly openCompare: () => void;
  readonly wb: Workbench;
  readonly nameOf: (addr: string) => string;
  readonly addrOf: (name: string) => string | null;
  readonly openFn: (addr: string, preview: boolean) => void;
  readonly focusAddr: string;
  readonly agentName: string;
  readonly agentColor: string;
  readonly onBack: () => void;
  /** Swaps the workbench to another file, keeping the chat. */
  readonly openTarget: (target: Target) => void;
  readonly chat: Chat;
  readonly gpu: GpuSource;
  readonly gpuData: Loaded<GpuData>;
  /** Re-reads shaders, models and recordings, after a new recording. */
  readonly refreshGpu: () => void;
};

export const BenchContext = createContext<Bench | null>(null);

export function useBench(): Bench {
  const bench = useContext(BenchContext);
  if (!bench) throw new Error("useBench needs a BenchContext provider.");
  return bench;
}

export function IconButton({ icon, label, onClick, tip = true, size = 28, iconSize = 15, radius = 7, color, on = false }: {
  readonly icon: string;
  readonly label?: string;
  readonly onClick: () => void;
  /** Off where the icon says enough on its own: no hover card, the label stays as the accessible name. */
  readonly tip?: boolean;
  readonly size?: number;
  readonly iconSize?: number;
  readonly radius?: number;
  readonly color?: string;
  readonly on?: boolean;
}): ReactElement {
  const { p } = useTheme();
  if (label && tip) {
    return (
      <Tooltip label={label}>
        <div onClick={onClick} aria-label={label} role="button" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: radius, flexShrink: 0, cursor: "pointer", hover: HOVER }}>
          <Icon name={icon} size={iconSize} color={color ?? p.muted} on={on} />
        </div>
      </Tooltip>
    );
  }
  return (
    <div onClick={onClick} aria-label={label ?? ""} role="button" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: radius, flexShrink: 0, cursor: "pointer", hover: HOVER }}>
      <Icon name={icon} size={iconSize} color={color ?? p.muted} on={on} />
    </div>
  );
}

export type { ButtonTone } from "../components/kit";

export function TextButton({ label, tone, onClick }: { readonly label: string; readonly tone: ButtonTone; readonly onClick: () => void }): ReactElement {
  return <Button label={label} tone={tone} size="compact" onClick={onClick} />;
}

/** One option of a segmented control: its label, an icon before it, or only the icon when `words` is false. */
export function SegItem({ label, on, onBg, padding, onClick, icon = null, words = true, name = label }: {
  readonly label: string;
  readonly name?: string;
  readonly on: boolean;
  readonly onBg: string;
  readonly padding: number;
  readonly onClick: () => void;
  readonly icon?: string | null;
  readonly words?: boolean;
}): ReactElement {
  const { p } = useTheme();
  return (
    <div onClick={onClick} role="radio" aria-selected={on} aria-label={name} style={{ display: "flex", alignItems: "center", gap: 6, height: 24, paddingLeft: padding, paddingRight: padding, borderRadius: 6, fontSize: 12, color: on ? p.text : p.muted, cursor: "pointer", ...(on ? { backgroundColor: onBg } : {}) }}>
      {icon && <Icon name={icon} size={13} color={on ? p.text : p.muted} />}
      {words && <div style={{ whiteSpace: "nowrap" }}>{label}</div>}
    </div>
  );
}

export function Square({ color, size, radius }: { readonly color: string; readonly size: number; readonly radius: number }): ReactElement {
  return <div style={{ width: size, height: size, borderRadius: radius, backgroundColor: color, flexShrink: 0 }} />;
}

/** Text with hard line breaks, like CSS `white-space: pre-line`. */
export function Lines({ text, style = {} }: { readonly text: string; readonly style?: StyleDesc }): ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", ...style }}>
      {text.split("\n").map((line, ix) => <div key={ix}>{line || " "}</div>)}
    </div>
  );
}

/** A model or weights file: the workbench reads its headers, so there is no code, engine or debugger. */
export function isModelBench(b: Bench): boolean {
  return b.chat.target?.kind === "model";
}

/** A standalone shader or kernel file (PTX, cubin, fatbin, AMD code object, metallib): GPU code with no program around it. */
export function isGpuBench(b: Bench): boolean {
  return b.chat.target?.kind === "gpu";
}

/** A program the engine decompiles, so the debugger and code views apply. */
export function hasCodeBench(b: Bench): boolean {
  return !isModelBench(b) && !isGpuBench(b);
}
