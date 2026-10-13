import type { ReactElement } from "react";

import { useTheme } from "../theme";
import { appIcon } from "./ui";
import { type KeymapId, keymapOf } from "../keys/keymaps";
import type { KeyTools } from "../keys/useKeyTools";

/** A keymap's tool icon from this Mac, Eleven's own icon, or its initials when the tool isn't installed. */
export function KeymapIcon({ id, tools, size }: { readonly id: KeymapId; readonly tools: KeyTools; readonly size: number }): ReactElement {
  const { p } = useTheme();
  const icon = id === "eleven" ? appIcon(p.icon) : tools.icons.get(id);
  if (icon) return <img src={icon} objectFit="contain" style={{ width: size, height: size, flexShrink: 0 }} />;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: size / 4, flexShrink: 0, backgroundColor: p.fill2, fontSize: size * 0.36, fontWeight: 600, color: p.text3, pointerEvents: "none" }}>
      {keymapOf(id).letters}
    </div>
  );
}
