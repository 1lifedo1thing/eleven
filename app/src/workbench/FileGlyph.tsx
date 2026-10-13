import type { ReactElement } from "react";

import { fileIcon } from "../lib/fileIcon";
import { useLoaded } from "../lib/useLoaded";
import { useTheme } from "../theme";
import { Icon } from "../components/ui";
import { useBench } from "./parts";

/** The real Finder icon for the open file (an app's own icon), falling back to the generic binary glyph. */
export function FileGlyph({ size = 18 }: { readonly size?: number }): ReactElement {
  const { p } = useTheme();
  const { program } = useBench();
  const source = program.origin || program.path;
  const icon = useLoaded<string | null>(() => (!source ? Promise.resolve(null) : fileIcon(source)), `icon:${source}`);
  if (icon.kind === "ready" && icon.value) return <img src={icon.value} style={{ width: size, height: size, borderRadius: size / 4.5 }} />;
  return <Icon name="binary" size={Math.round(size * 0.8)} color={p.muted} />;
}
