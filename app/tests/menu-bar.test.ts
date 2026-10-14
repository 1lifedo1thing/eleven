import { expect, test } from "bun:test";

import type { MenuItemSpec, MenuSpec } from "@gpuix/native";

import { COMMAND_IDS, type CommandId } from "../src/keys/commands";
import { comboFor } from "../src/keys/keymaps";
import { choiceId, type MenuContext, menuBar, parseChoice } from "../src/keys/menus";

function context(over: Partial<MenuContext> = {}): MenuContext {
  return { combo: (id) => comboFor(id, "eleven", {}), bound: () => true, offered: () => true, recent: [], ...over };
}

function items(menus: readonly MenuSpec[]): readonly MenuItemSpec[] {
  const walk = (list: readonly MenuItemSpec[]): MenuItemSpec[] => list.flatMap((item) => [item, ...walk(item.items ?? [])]);
  return menus.flatMap((menu) => walk(menu.items));
}

function find(menus: readonly MenuSpec[], id: CommandId): MenuItemSpec | undefined {
  return items(menus).find((item) => item.id === choiceId({ kind: "command", id }));
}

test("menu bar: the macOS menus come in the usual order", () => {
  expect(menuBar(context()).map((menu) => menu.label)).toEqual(["Eleven", "File", "Edit", "Navigate", "Modify", "View", "Agent", "Debug", "Window", "Help"]);
});

test("menu bar: ⌘ and ⌃ shortcuts show beside their item, one-key shortcuts do not", () => {
  const menus = menuBar(context());
  expect(find(menus, "palette")?.keys).toBe("cmd-k");
  expect(find(menus, "terminal")?.keys).toBe("ctrl-`");
  expect(find(menus, "rename")?.keys).toBeUndefined();
  expect(find(menus, "showHex")?.keys).toBeUndefined();
  expect(find(menus, "stepOver")?.keys).toBeUndefined();
});

test("menu bar: shortcuts follow the keymap and your own changes", () => {
  const hopper = menuBar(context({ combo: (id) => comboFor(id, "hopper", { save: "alt-cmd-s" }) }));
  expect(find(hopper, "palette")?.keys).toBe("shift-cmd-p");
  expect(find(hopper, "save")?.keys).toBe("alt-cmd-s");
});

test("menu bar: a command nothing on screen handles is greyed out", () => {
  const menus = menuBar(context({ bound: (id) => id !== "debug" }));
  expect(find(menus, "debug")?.enabled).toBe(false);
  expect(find(menus, "palette")?.enabled).toBe(true);
});

test("menu bar: every command that belongs in a menu is in one", () => {
  const listed = new Set(items(menuBar(context())).map((item) => item.id));
  const offMenu = new Set<CommandId>(["confirm", "dismiss", "selectAll", "copy", "undo", "redo"]);
  const missing = COMMAND_IDS.filter((id) => !offMenu.has(id) && !listed.has(choiceId({ kind: "command", id })));
  expect(missing).toEqual([]);
});

test("menu bar: Edit presses the standard keys so text fields handle them", () => {
  const edit = menuBar(context()).find((menu) => menu.label === "Edit");
  expect(edit?.items.slice(0, 7).map((item) => item.keys ?? "-")).toEqual(["cmd-z", "shift-cmd-z", "-", "cmd-x", "cmd-c", "cmd-v", "cmd-a"]);
});

test("menu bar: Open Recent lists projects, and is greyed out without any", () => {
  const empty = items(menuBar(context())).find((item) => item.label === "Open Recent");
  expect(empty?.enabled).toBe(false);
  const some = items(menuBar(context({ recent: [{ id: "abc", name: "Signal" }] }))).find((item) => item.label === "Open Recent");
  expect(some?.items?.map((item) => [item.label, item.id])).toEqual([["Signal", "recent:abc"]]);
});

test("menu bar: item ids read back into what they ask for", () => {
  expect(parseChoice("command:palette")).toEqual({ kind: "command", id: "palette" });
  expect(parseChoice("action:compare")).toEqual({ kind: "action", id: "compare" });
  expect(parseChoice("recent:abc:def")).toEqual({ kind: "recent", id: "abc:def" });
  expect(parseChoice("app:about")).toEqual({ kind: "app", id: "about" });
  expect(parseChoice("command:fly")).toBeNull();
  expect(parseChoice("nonsense")).toBeNull();
});
