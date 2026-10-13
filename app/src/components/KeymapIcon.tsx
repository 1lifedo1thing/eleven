import { join } from "node:path";
import type { ReactElement } from "react";

import { useTheme } from "../theme";
import { appIcon } from "./ui";
import { type KeymapId, keymapOf } from "../keys/keymaps";
import type { KeyTools } from "../keys/useKeyTools";
import { ASSETS } from "../lib/assets";

const BUNDLED: Readonly<Partial<Record<KeymapId, string>>> = { ida: "ida.png", hopper: "hopper.png", ghidra: "ghidra.png" };

function bundledIcon(id: KeymapId): string | undefined {
  const file = BUNDLED[id];
  return file === undefined ? undefined : join(ASSETS, "engines", file);
}

/** A keymap's tool icon from this Mac, Eleven's own icon, a bundled logo, or its initials. */
export function KeymapIcon({ id, tools, size }: { readonly id: KeymapId; readonly tools: KeyTools; readonly size: number }): ReactElement {
  const { p } = useTheme();
  const icon = id === "eleven" ? appIcon(p.icon) : (tools.icons.get(id) ?? bundledIcon(id));
  if (icon) return <img src={icon} objectFit="contain" style={{ width: size, height: size, flexShrink: 0 }} />;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: size / 4, flexShrink: 0, backgroundColor: p.fill2, fontSize: size * 0.36, fontWeight: 600, color: p.text3, pointerEvents: "none" }}>
      {keymapOf(id).letters}
    </div>
  );
}
