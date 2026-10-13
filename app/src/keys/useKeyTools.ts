import { useEffect, useState } from "react";

import { fileIcon } from "../lib/fileIcon";
import type { KeymapId } from "./keymaps";
import { findCustomShortcuts, findTools, type Imported } from "./tools";

export type KeyTools = {
  readonly icons: ReadonlyMap<KeymapId, string>;
  readonly installed: ReadonlySet<KeymapId>;
  readonly custom: readonly Imported[];
};

const CUSTOM_KEYMAP: Readonly<Record<string, KeymapId>> = { Cursor: "vscode", "VS Code": "vscode", Zed: "zed", Xcode: "xcode", Ghidra: "ghidra" };

/** Shortcuts you changed in the tool behind a keymap, when any of them match Eleven's commands. */
export function customFor(tools: KeyTools, keymap: KeymapId): Imported | null {
  return tools.custom.find((item) => CUSTOM_KEYMAP[item.from] === keymap && Object.keys(item.overrides).length > 0) ?? null;
}

/** The tools on this Mac whose shortcuts Eleven can copy, their icons, and any shortcuts you changed in them. */
export function useKeyTools(): KeyTools {
  const [tools, setTools] = useState<KeyTools>({ icons: new Map(), installed: new Set(), custom: [] });
  useEffect(() => {
    let live = true;
    const load = async (): Promise<void> => {
      const found = findTools();
      const icons = await Promise.all(found.map(async (tool) => [tool.keymap, await fileIcon(tool.iconSource)] as const));
      const custom = await findCustomShortcuts();
      if (!live) return;
      setTools({
        icons: new Map(icons.filter((pair): pair is readonly [KeymapId, string] => pair[1] !== null)),
        installed: new Set(found.map((tool) => tool.keymap)),
        custom,
      });
    };
    void load();
    return () => {
      live = false;
    };
  }, []);
  return tools;
}
