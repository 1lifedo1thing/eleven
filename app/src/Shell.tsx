import type { EventPayload } from "@gpuix/react";
import { createContext, type ReactElement, type ReactNode, useContext } from "react";

import { ContextMenuLayer } from "./components/ContextMenu";
import { UI_SCALE } from "./settings/look";
import { useSettings } from "./settings/store";
import { glassTint, SANS, useTheme } from "./theme";

const TITLEBAR = 46;

type DropProps = { readonly onFileDrop?: (event: EventPayload) => void };

const DropContext = createContext<DropProps>({});

/** A filled element swallows file drops, so anything with a background spreads this to pass them on to the screen. */
export function useDropTarget(): DropProps {
  return useContext(DropContext);
}

/**
 * Every screen sits in this: the frosted window backdrop, an optional left column on it,
 * one solid rounded card for the content (when `bare`, a solid window instead), and the context menu. Screens never paint their own window background.
 */
export function Shell({ side, children, onDrop, overlay = null, bare = false }: {
  readonly side: ReactNode;
  readonly children: ReactNode;
  readonly overlay?: ReactNode;
  readonly onDrop?: (event: EventPayload) => void;
  readonly bare?: boolean;
}): ReactElement {
  const { p } = useTheme();
  const { settings } = useSettings();
  const scale = UI_SCALE[settings.uiSize];
  const drop: DropProps = onDrop ? { onFileDrop: onDrop } : {};
  const card = bare ? {} : { borderWidth: 1, borderColor: p.sel, borderRadius: 12, backgroundColor: p.card };
  return (
    <DropContext.Provider value={drop}>
      <div {...drop} style={{ display: "flex", userSelect: "none", width: "100%", height: "100%", backgroundColor: bare ? p.win : glassTint(p, settings.transparency), color: p.text, fontFamily: SANS, fontSize: 13.5 * scale, lineHeight: Math.round(20 * scale) }}>
        {side ?? <div style={{ width: 8, flexShrink: 0 }} />}
        <div {...drop} style={{ display: "flex", flexDirection: "column", flexGrow: 1, minWidth: 0, marginTop: side ? 8 : TITLEBAR, marginRight: 8, marginBottom: 8, ...card, overflow: "hidden" }}>
          {children}
        </div>
        {overlay}
        <ContextMenuLayer />
      </div>
    </DropContext.Provider>
  );
}
