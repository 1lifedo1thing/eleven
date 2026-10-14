import { join } from "node:path";

import type { EventPayload } from "@gpuix/react";
import { type ReactElement, useState, useSyncExternalStore } from "react";

import { ASSETS } from "../lib/assets";
import { SANS, useTheme } from "../theme";
import { Icon } from "./ui";

export type MenuAction = {
  readonly kind: "action";
  readonly label: string;
  readonly icon?: string;
  /** A multi-color logo from assets/icons, drawn as is instead of tinted like `icon`. */
  readonly logo?: string;
  readonly keys?: string;
  /** Why it can't run yet, shown in place of the shortcut; null or absent when it can. */
  readonly unavailable?: string | null;
  readonly run: () => void;
};

export type MenuSubmenu = { readonly kind: "submenu"; readonly label: string; readonly icon?: string; readonly items: readonly MenuEntry[] };

export type MenuEntry = MenuAction | MenuSubmenu | { readonly kind: "separator" };

type OpenMenu = { readonly x: number; readonly y: number; readonly entries: readonly MenuEntry[]; readonly seq: number };

const RADIUS = 10;
const SEPARATOR: MenuEntry = { kind: "separator" };

let current: OpenMenu | null = null;
let seq = 0;
/** A submenu sits outside the main menu's bounds, so a press inside it must not count as a press outside. */
let pointerInSubmenu = false;
const listeners = new Set<() => void>();

function publish(next: OpenMenu | null): void {
  current = next;
  pointerInSubmenu = false;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Drops leading, trailing and doubled separators, so menus can be built from optional groups. */
export function tidy(entries: readonly MenuEntry[]): readonly MenuEntry[] {
  const kept: MenuEntry[] = [];
  for (const entry of entries) {
    if (entry.kind === "separator" && (kept.length === 0 || kept.at(-1)?.kind === "separator")) continue;
    kept.push(entry);
  }
  return kept.at(-1)?.kind === "separator" ? kept.slice(0, -1) : kept;
}

/** Groups joined by separators, skipping empty ones. */
export function groups(...parts: readonly (readonly MenuEntry[])[]): readonly MenuEntry[] {
  return tidy(parts.flatMap((part) => (part.length > 0 ? [...part, SEPARATOR] : [])));
}

export function openMenu(x: number, y: number, entries: readonly MenuEntry[]): void {
  const shown = tidy(entries);
  if (shown.length > 0) publish({ x, y, entries: shown, seq: ++seq });
}

export function closeMenu(): void {
  if (current) publish(null);
}

function dismiss(): void {
  if (!pointerInSubmenu) closeMenu();
}

/** The open menu's entries, for tests and the agent bridge. */
export function openMenuEntries(): readonly MenuEntry[] {
  return current?.entries ?? [];
}

type Handlers = { readonly onAuxClick: (event: EventPayload) => void; readonly onClick: (event: EventPayload) => void };

/** Right-click (or Control-click) opens the menu `build` returns; a plain click still runs `onClick`. */
export function menuOn(build: () => readonly MenuEntry[], onClick?: (event: EventPayload) => void): Handlers {
  const show = (event: EventPayload): void => openMenu(event.x ?? 0, event.y ?? 0, build());
  return {
    onAuxClick: (event) => {
      if (event.isRightClick) show(event);
    },
    onClick: (event) => {
      if (event.modifiers?.ctrl) show(event);
      else onClick?.(event);
    },
  };
}

function runnable(entry: MenuEntry | undefined): boolean {
  if (!entry || entry.kind === "separator") return false;
  return entry.kind === "submenu" || !entry.unavailable;
}

function nextIndex(entries: readonly MenuEntry[], from: number, by: number): number {
  for (let step = 1; step <= entries.length; step++) {
    const at = (from + by * step + entries.length * step) % entries.length;
    if (runnable(entries[at])) return at;
  }
  return from;
}

function Row({ entry, active, open, onRun, onHover, onCloseSub }: {
  readonly entry: MenuAction | MenuSubmenu;
  readonly active: boolean;
  readonly open: boolean;
  readonly onRun: () => void;
  readonly onHover: () => void;
  readonly onCloseSub: () => void;
}): ReactElement {
  const { p } = useTheme();
  const off = entry.kind === "action" && Boolean(entry.unavailable);
  const look = off ? {} : { cursor: "pointer" as const, hover: { opacity: 0.72 } };
  const press = (): void => {
    if (entry.kind === "submenu") onHover();
    else if (!off) onRun();
  };
  const hint = entry.kind === "action" ? (entry.unavailable ?? entry.keys ?? "") : "";
  return (
    <div onClick={press} onMouseEnter={onHover} role="menuitem" aria-label={entry.label} aria-disabled={off} style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, height: 30, flexShrink: 0, paddingLeft: 8, paddingRight: 8, borderRadius: 6, color: off ? p.faint : p.text, ...((active || open) ? { backgroundColor: p.sel } : {}), ...look }}>
      {entry.icon && <Icon name={entry.icon} size={14} color={off ? p.faint : p.text3} />}
      {entry.kind === "action" && !entry.icon && entry.logo && <img src={join(ASSETS, "icons", `${entry.logo}.svg`)} objectFit="contain" style={{ width: 14, height: 14, flexShrink: 0, opacity: off ? 0.6 : 1, pointerEvents: "none" }} />}
      <div style={{ flexGrow: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{entry.label}</div>
      {hint && <div style={{ flexShrink: 0, paddingLeft: 12, fontSize: 11, color: p.faint, fontFamily: SANS }}>{hint}</div>}
      {entry.kind === "submenu" && <Icon name="forward" size={11} color={p.faint} />}
      {entry.kind === "submenu" && open && (
        <anchored deferred occlude priority={3} side="right" align="start" gap={10} fit="switch" style={{ borderRadius: RADIUS }}>
          <List entries={entry.items} depth={1} onKeyClose={onCloseSub} />
        </anchored>
      )}
    </div>
  );
}

function List({ entries, depth, onKeyClose }: { readonly entries: readonly MenuEntry[]; readonly depth: number; readonly onKeyClose?: () => void }): ReactElement {
  const { p } = useTheme();
  const [active, setActive] = useState(-1);
  const [opened, setOpened] = useState(-1);
  const run = (entry: MenuAction): void => {
    closeMenu();
    entry.run();
  };
  const choose = (index: number): void => {
    const entry = entries[index];
    if (!entry || !runnable(entry)) return;
    if (entry.kind === "submenu") setOpened(index);
    else if (entry.kind === "action") run(entry);
  };
  const onKeyDown = (event: EventPayload): void => {
    switch (event.key) {
      case "escape":
        if (depth === 0) closeMenu();
        else onKeyClose?.();
        return;
      case "down":
        setActive(nextIndex(entries, active, 1));
        return;
      case "up":
        setActive(nextIndex(entries, active < 0 ? 0 : active, -1));
        return;
      case "enter":
      case "space":
      case "right":
        choose(active);
        return;
      case "left":
        onKeyClose?.();
        return;
      default: {
        const letter = event.keyChar?.toLowerCase();
        if (!letter || letter.length !== 1) return;
        const found = entries.findIndex((entry, ix) => ix > active && entry.kind !== "separator" && entry.label.toLowerCase().startsWith(letter));
        const wrapped = found >= 0 ? found : entries.findIndex((entry) => entry.kind !== "separator" && entry.label.toLowerCase().startsWith(letter));
        if (wrapped >= 0) setActive(wrapped);
      }
    }
  };
  const shadow = { offsetX: 0, offsetY: 16, blurRadius: 40, spreadRadius: 0, color: "rgba(0,0,0,0.35)" };
  return (
    <div tabIndex={-1} autoFocus onKeyDown={onKeyDown} {...(depth === 0 ? { onMouseDownOutside: dismiss } : { onMouseEnter: () => (pointerInSubmenu = true), onMouseLeave: () => (pointerInSubmenu = false) })} role="menu" style={{ display: "flex", flexDirection: "column", minWidth: 220, maxWidth: 380, padding: 6, borderWidth: 1, borderColor: p.sel2, borderRadius: RADIUS, backgroundColor: p.raised2, boxShadow: shadow }}>
      {entries.map((entry, index) =>
        entry.kind === "separator"
          ? <div key={index} style={{ height: 1, flexShrink: 0, marginTop: 4, marginBottom: 4, backgroundColor: p.sel }} />
          : <Row key={index} entry={entry} active={index === active} open={index === opened} onRun={() => entry.kind === "action" && run(entry)} onHover={() => setOpened(entry.kind === "submenu" ? index : -1)} onCloseSub={() => setOpened(-1)} />,
      )}
    </div>
  );
}

/** The one context menu on screen, placed where it was asked for. Shell renders it on every screen. */
export function ContextMenuLayer(): ReactElement | null {
  const menu = useSyncExternalStore(subscribe, () => current);
  if (!menu) return null;
  return (
    <anchored key={menu.seq} deferred occlude priority={2} position={{ x: menu.x, y: menu.y }} fit="snap" snapMargin={8} style={{ borderRadius: RADIUS }}>
      <List entries={menu.entries} depth={0} />
    </anchored>
  );
}
