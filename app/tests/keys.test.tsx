import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestRoot, type TestRoot } from "@gpuix/react/testing";
import { type ReactElement, useState } from "react";

const dir = mkdtempSync(join(tmpdir(), "eleven-keys-"));
process.env.ELEVEN_SUPPORT = dir;

const { comboFor, comboKeys, commandFor } = await import("../src/keys/keymaps");
const { importShortcutFile } = await import("../src/keys/tools");
const { dispatchShortcut, TYPING, useCommand } = await import("../src/lib/shortcuts");
const { SettingsScreen } = await import("../src/settings/SettingsScreen");
const { currentSettings, saveSettings, SETTINGS_FILE } = await import("../src/settings/store");
const { DARK, ThemeContext } = await import("../src/theme");
const { KeymapStep } = await import("../src/welcome/KeymapStep");

test("keys: settings are written to a throwaway folder", () => {
  expect(SETTINGS_FILE.startsWith(dir)).toBe(true);
});

type Json = { readonly id?: number; readonly customProps?: Record<string, unknown>; readonly children?: readonly Json[] };

function byLabel(node: unknown, label: string): number | null {
  if (typeof node !== "object" || node === null) return null;
  const json: Json = node;
  if (json.customProps?.["aria-label"] === label && typeof json.id === "number") return json.id;
  for (const child of json.children ?? []) {
    const found = byLabel(child, label);
    if (found !== null) return found;
  }
  return null;
}

function settle(root: TestRoot): void {
  for (let i = 0; i < 4; i++) {
    root.renderer.dispatchNativeEvents();
    root.renderer.flush();
  }
}

async function tick(root: TestRoot): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    settle(root);
  }
}

function click(root: TestRoot, label: string): void {
  const id = byLabel(root.renderer.toJSON(), label);
  if (id === null) throw new Error(`nothing labelled "${label}"`);
  root.renderer.scrollIntoView(id);
  root.renderer.flush();
  const box = root.renderer.getElementBounds(id);
  if (!box) throw new Error(`"${label}" has no box`);
  root.renderer.nativeSimulateClick(box.x + box.width / 2, box.y + box.height / 2);
  settle(root);
}

function press(root: TestRoot, label: string, keys: string): void {
  const id = byLabel(root.renderer.toJSON(), label);
  if (id === null) throw new Error(`nothing labelled "${label}"`);
  root.renderer.nativeSimulateKeystrokes(id, keys);
  settle(root);
}

test("keys: presets resolve and read back as Apple-ordered keycaps", () => {
  expect(comboFor("rename", "ghidra", {})).toBe("l");
  expect(comboFor("pseudo", "ida", {})).toBe("f5");
  expect(comboFor("rename", "hopper", { rename: "cmd-r" })).toBe("cmd-r");
  expect(commandFor("shift-cmd-p", "hopper", {})).toBe("palette");
  expect(comboKeys("ctrl-shift--")).toEqual(["⌃", "⇧", "-"]);
  expect(comboKeys("shift-cmd-s")).toEqual(["⇧", "⌘", "S"]);
});

test("keys: imports VS Code, Zed and Ghidra shortcut files", async () => {
  const vscode = join(dir, "keybindings.json");
  writeFileSync(vscode, `// mine\n[{ "key": "cmd+shift+g", "command": "workbench.action.quickOpen" }, { "key": "cmd+k cmd+s", "command": "editor.action.rename" }, { "key": "f6", "command": "editor.action.rename" }, { "key": "ctrl+-", "command": "-workbench.action.navigateBack" },]`);
  const zed = join(dir, "keymap.json");
  writeFileSync(zed, `[{ "context": "Editor", "bindings": { "ctrl--": "pane::GoBack", "cmd-shift-r": ["editor::Rename", {}] } }]`);
  const ghidra = join(dir, "bindings.kbxml");
  writeFileSync(ghidra, `<CATEGORY NAME="Key Bindings"><WRAPPED_OPTION NAME="Go To Address/Label (GoToAddressLabelPlugin)" CLASS="x"><STATE NAME="KeyCode" TYPE="int" VALUE="74" /><STATE NAME="Modifiers" TYPE="int" VALUE="256" /></WRAPPED_OPTION></CATEGORY>`);
  expect((await importShortcutFile(vscode))?.overrides).toEqual({ palette: "shift-cmd-g", rename: "f6" });
  expect((await importShortcutFile(zed))?.overrides).toEqual({ back: "ctrl--", rename: "shift-cmd-r" });
  expect((await importShortcutFile(ghidra))?.overrides).toEqual({ goto: "cmd-j" });
});

function Probe(): ReactElement {
  const [count, setCount] = useState(0);
  useCommand("rename", () => setCount((n) => n + 1));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 10 }}>
      <input {...TYPING} aria-label="field" value="" onChange={() => {}} style={{ width: 200, height: 24 }} />
      <div tabIndex={0} aria-label="code" style={{ width: 100, height: 20 }} />
      <div>{`Renamed ${count}`}</div>
    </div>
  );
}

test("keys: a one-key shortcut runs from the code view but not while typing", () => {
  saveSettings({ ...currentSettings(), keymap: "eleven", shortcuts: {} });
  const root = createTestRoot({ width: 400, height: 200, onKeyDown: dispatchShortcut });
  root.render(<Probe />);
  settle(root);
  press(root, "field", "n");
  expect(root.renderer.getAllText().join(" ")).toContain("Renamed 0");
  press(root, "code", "n");
  expect(root.renderer.getAllText().join(" ")).toContain("Renamed 1");
  root.unmount();
});

test("keys: settings records a new shortcut, flags a clash and resets", async () => {
  saveSettings({ ...currentSettings(), keymap: "hopper", shortcuts: {} });
  const root = createTestRoot({ width: 1200, height: 1400, onKeyDown: dispatchShortcut });
  root.render(
    <ThemeContext.Provider value={{ p: DARK, appearance: "Dark", setAppearance: () => {} }}>
      <SettingsScreen initial="keyboard" onBack={() => {}} onSetup={() => {}} />
    </ThemeContext.Provider>,
  );
  for (let i = 0; i < 10 && !root.renderer.getAllText().join(" ").includes("Bookmark"); i++) {
    settle(root);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  expect(root.renderer.getAllText().join(" ")).toContain("Click a shortcut to change it.");
  click(root, "Change shortcut for Bookmark");
  await tick(root);
  expect(root.renderer.getAllText().join(" ")).toContain("Press keys…");
  press(root, "Change shortcut for Bookmark", "cmd-b");
  await tick(root);
  expect(currentSettings().shortcuts.bookmark).toBe("cmd-b");
  click(root, "Change shortcut for Comment");
  await tick(root);
  press(root, "Change shortcut for Comment", "n");
  await tick(root);
  expect(root.renderer.getAllText().join(" ")).toContain("N is already Rename.");
  click(root, "Use here");
  await tick(root);
  expect(currentSettings().shortcuts).toEqual({ bookmark: "cmd-b", comment: "n", rename: "" });
  click(root, "Reset Bookmark");
  await tick(root);
  expect(currentSettings().shortcuts.bookmark).toBeUndefined();
  root.unmount();
});

test("keys: first run picks a keymap, previews it and saves it", async () => {
  saveSettings({ ...currentSettings(), keymap: null, shortcuts: {} });
  let done = false;
  const root = createTestRoot({ width: 1200, height: 900, onKeyDown: dispatchShortcut });
  root.render(
    <ThemeContext.Provider value={{ p: DARK, appearance: "Dark", setAppearance: () => {} }}>
      <KeymapStep onDone={() => { done = true; }} onBack={() => {}} pill={null} />
    </ThemeContext.Provider>,
  );
  await tick(root);
  expect(root.renderer.getAllText().join(" ")).toContain("With Eleven");
  click(root, "Ghidra");
  await tick(root);
  const text = root.renderer.getAllText().join(" ");
  expect(text).toContain("With Ghidra");
  expect(text).toContain("Rename L");
  click(root, "Continue");
  await tick(root);
  expect(done).toBe(true);
  expect(currentSettings().keymap).toBe("ghidra");
  root.unmount();
});
