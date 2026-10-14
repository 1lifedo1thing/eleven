import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { StyleDesc } from "@gpuix/react";
import { type ReactElement, type ReactNode, useRef, useState } from "react";

import type { AgentIcon } from "../agents/icons";
import type { CommandId } from "../keys/commands";
import { type Combo, comboFor, comboKeys } from "../keys/keymaps";
import { ASSETS } from "../lib/assets";
import { useSettings } from "../settings/store";
import { DARK, SANS, useTheme } from "../theme";

const sources = new Map<string, string>();

function readIcon(name: string): string | null {
  const known = sources.get(name);
  if (known) return known;
  try {
    const svg = readFileSync(join(ASSETS, "icons", `${name}.svg`), "utf8");
    sources.set(name, svg);
    return svg;
  } catch {
    return null;
  }
}

/** One of Eleven's hand-drawn icons. `on` picks the filled variant where one exists. */
export function Icon({ name, size = 16, color, on = false }: {
  readonly name: string;
  readonly size?: number;
  readonly color?: string;
  readonly on?: boolean;
}): ReactElement | null {
  const { p } = useTheme();
  const svg = (on ? readIcon(`${name}-on`) : null) ?? readIcon(name);
  if (!svg) return null;
  return <svg source={svg} style={{ width: size, height: size, color: color ?? p.muted, flexShrink: 0 }} />;
}

/** An agent's logo in its brand colors, its one-color registry glyph, or a quiet square when it has neither. */
export function AgentLogo({ icon, size = 14 }: { readonly icon: AgentIcon | null; readonly size?: number }): ReactElement {
  const { p } = useTheme();
  const box = { width: size, height: size, flexShrink: 0 };
  if (!icon) return <div style={{ ...box, borderRadius: 4, backgroundColor: p.line3, pointerEvents: "none" }} />;
  switch (icon.kind) {
    case "color":
      return <img src={p === DARK ? icon.dark : icon.light} objectFit="contain" style={box} />;
    case "mono":
      return <svg source={icon.svg} style={{ ...box, color: p.text }} />;
  }
}

export function Dot({ color, size = 6 }: { readonly color: string; readonly size?: number }): ReactElement {
  return <div style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, flexShrink: 0, pointerEvents: "none" }} />;
}

export function Spacer(): ReactElement {
  return <div style={{ flexGrow: 1 }} />;
}

export function Row({ children, gap = 8, style = {} }: {
  readonly children: ReactNode;
  readonly gap?: number;
  readonly style?: StyleDesc;
}): ReactElement {
  return <div style={{ display: "flex", alignItems: "center", gap, ...style }}>{children}</div>;
}

export function appIcon(icon: string): string {
  return join(ASSETS, icon);
}

/** Also set on the `anchored` around a menu: GPUIX fills that layer dark unless it shares the radius. */
export const MENU_RADIUS = 12;

export type PopoverState = {
  readonly open: boolean;
  readonly close: () => void;
  readonly dismiss: () => void;
  readonly onTriggerDown: () => void;
  readonly onTriggerClick: () => void;
};

/** Open state for a menu trigger; pressing the trigger while open closes it instead of reopening. */
export function usePopover(): PopoverState {
  const [open, setOpen] = useState(false);
  const shown = useRef(false);
  const dismissed = useRef(false);
  const wasOpen = useRef(false);
  const set = (next: boolean): void => {
    shown.current = next;
    setOpen(next);
  };
  return {
    open,
    close: () => set(false),
    dismiss: () => {
      dismissed.current = true;
      setTimeout(() => {
        dismissed.current = false;
      }, 0);
      set(false);
    },
    onTriggerDown: () => {
      wasOpen.current = shown.current || dismissed.current;
    },
    onTriggerClick: () => {
      set(!wasOpen.current);
      wasOpen.current = false;
      dismissed.current = false;
    },
  };
}

/** A menu layer above everything that takes its own clicks and closes on a press outside it. */
export function Popover({ side, align, gap = 8, onDismiss, children }: {
  readonly side: "top" | "bottom";
  readonly align: "start" | "end";
  readonly gap?: number;
  readonly onDismiss: () => void;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <anchored deferred occlude priority={1} side={side} align={align} gap={gap} fit="switch" style={{ borderRadius: MENU_RADIUS }}>
      <div onMouseDownOutside={onDismiss} style={{ display: "flex", borderRadius: MENU_RADIUS }}>
        {children}
      </div>
    </anchored>
  );
}

/** The raised card every popover menu sits on. */
export function MenuSurface({ children, width, maxHeight = 420, padX = 6 }: {
  readonly children: ReactNode;
  readonly width: number;
  readonly maxHeight?: number;
  readonly padX?: number;
}): ReactElement {
  const { p } = useTheme();
  const shadow = { offsetX: 0, offsetY: 16, blurRadius: 40, spreadRadius: 0, color: "rgba(0,0,0,0.35)" };
  return (
    <div style={{ display: "flex", flexDirection: "column", width, maxHeight, paddingTop: 6, paddingBottom: 6, paddingLeft: padX, paddingRight: padX, borderWidth: 1, borderColor: p.line2, borderRadius: MENU_RADIUS, backgroundColor: p.raised2, boxShadow: shadow, overflow: "hidden" }}>
      {children}
    </div>
  );
}

/** A shortcut as separate keycaps, the way macOS menus and launchers show it. */
export function Keys({ combo }: { readonly combo: Combo }): ReactElement | null {
  const { p } = useTheme();
  const caps = comboKeys(combo);
  if (caps.length === 0) return null;
  return (
    <div aria-label={caps.join("")} style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0, pointerEvents: "none" }}>
      {caps.map((cap, index) => (
        <div key={index} style={{ display: "flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18, paddingLeft: 4, paddingRight: 4, borderRadius: 4, backgroundColor: p.fill2, fontFamily: SANS, fontSize: 11, lineHeight: 18, color: p.muted, pointerEvents: "none" }}>
          {cap}
        </div>
      ))}
    </div>
  );
}

/** The keycaps for a command under the chosen keymap and your own changes. */
export function CommandKeys({ id }: { readonly id: CommandId }): ReactElement | null {
  const { settings } = useSettings();
  return <Keys combo={comboFor(id, settings.keymap ?? "eleven", settings.shortcuts)} />;
}

/** A quiet composer pill: an optional icon, a label and an optional disclosure caret. */
export function Chip({ icon = null, label, caret, active = false, onClick }: {
  readonly icon?: string | null;
  readonly label: string;
  readonly caret: boolean;
  readonly active?: boolean;
  readonly onClick: (() => void) | null;
}): ReactElement {
  const { p } = useTheme();
  const look = onClick ? { cursor: "pointer" as const, hover: { opacity: 0.72 } } : {};
  return (
    <div onClick={() => onClick?.()} aria-label={label} style={{ display: "flex", alignItems: "center", gap: 6, height: 30, paddingLeft: icon ? 8 : 10, paddingRight: caret ? 8 : 10, borderRadius: 15, fontSize: 12.5, color: p.text3, flexShrink: 0, ...(active ? { backgroundColor: p.fill2 } : {}), ...look }}>
      {icon && <Icon name={icon} size={15} color={p.text3} />}
      <div style={{ whiteSpace: "nowrap" }}>{label}</div>
      {caret && <Icon name="disclosure" size={11} color={p.faint} />}
    </div>
  );
}

export function Switch({ on }: { readonly on: boolean }): ReactElement {
  const { p } = useTheme();
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: on ? "flex-end" : "flex-start", width: 28, height: 16, padding: 2, borderRadius: 8, flexShrink: 0, backgroundColor: on ? p.primary : p.line3, pointerEvents: "none" }}>
      <div style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: on ? p.onPrimary : p.text3 }} />
    </div>
  );
}
