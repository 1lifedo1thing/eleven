import type { EventPayload } from "@gpuix/react";
import { useEffect, useRef } from "react";

import { type CommandId, TEXT_COMMANDS } from "../keys/commands";
import { type Combo, commandFor, isBareCombo, makeCombo } from "../keys/keymaps";
import { currentSettings } from "../settings/store";
import { OS } from "./platform";

type Handler = () => void;

const bound = new Map<CommandId, Handler[]>();
const typed = new Set<number>();
const MODIFIER_KEYS = new Set(["shift", "control", "ctrl", "alt", "option", "cmd", "command", "meta", "platform", "function", "fn", "capslock"]);

let recorder: ((combo: Combo | null) => void) | null = null;

/** The combo a key event makes, like "shift-cmd-p" or "g", or null for a modifier pressed alone. Off the Mac, Ctrl plays ⌘'s part. */
export function comboOf(event: EventPayload): Combo | null {
  const key = event.key?.toLowerCase();
  if (!key || MODIFIER_KEYS.has(key)) return null;
  const mods = event.modifiers;
  const ctrl = OS === "mac" ? mods?.ctrl : mods?.cmd;
  const cmd = OS === "mac" ? mods?.cmd : mods?.ctrl;
  const held = [ctrl ? "ctrl" : null, mods?.alt ? "alt" : null, mods?.shift ? "shift" : null, cmd ? "cmd" : null] as const;
  return makeCombo(held.filter((mod) => mod !== null), key);
}

/** Text fields call this from their key handler, so a plain letter typed there never runs a one-key shortcut. */
export function noteTyping(event: EventPayload): void {
  if (event.keystrokeId === undefined) return;
  typed.add(event.keystrokeId);
  if (typed.size > 64) typed.delete(typed.values().next().value ?? 0);
}

export const TYPING = { onKeyDown: noteTyping } as const;

/** Hands the next key combo to `take` instead of running it; Esc hands back null. */
export function recordNextCombo(take: (combo: Combo | null) => void): () => void {
  recorder = take;
  return () => {
    if (recorder === take) recorder = null;
  };
}

/** The window's key listener: finds the command bound to the combo and runs the most recently mounted handler for it. */
export function dispatchShortcut(event: EventPayload): void {
  const combo = comboOf(event);
  if (!combo) return;
  if (recorder) {
    const take = recorder;
    recorder = null;
    take(combo === "escape" ? null : combo);
    return;
  }
  const typing = event.keystrokeId !== undefined && typed.has(event.keystrokeId);
  if (typing && isBareCombo(combo)) return;
  const settings = currentSettings();
  const command = commandFor(combo, settings.keymap ?? "eleven", settings.shortcuts);
  if (command && !(typing && TEXT_COMMANDS.has(command))) runCommand(command);
}

/** Runs a command by id from a button, the way its keyboard shortcut would. */
export function runCommand(id: CommandId): void {
  bound.get(id)?.at(-1)?.();
}

export function useCommand(id: CommandId, handler: Handler): void {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    const call: Handler = () => latest.current();
    bound.set(id, [...(bound.get(id) ?? []), call]);
    return () => {
      bound.set(id, (bound.get(id) ?? []).filter((h) => h !== call));
    };
  }, [id]);
}
