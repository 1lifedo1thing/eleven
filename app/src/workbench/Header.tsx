import type { ReactElement } from "react";

import { showing } from "./state";
import { Tooltip } from "../components/kit";
import { useTheme } from "../theme";
import { CommandKeys, Icon } from "../components/ui";
import { ELLIPSIS, HOVER, IconButton, MONO_STYLE, useBench } from "./parts";
import { currentAddr, placeIn, segmentOf } from "./where";

function Pill({ icon, label, on = false, color, onClick, children }: {
  readonly icon: string;
  readonly label: string;
  readonly on?: boolean;
  readonly color?: string;
  readonly onClick: () => void;
  readonly children?: ReactElement;
}): ReactElement {
  const { p } = useTheme();
  return (
    <div onClick={onClick} role="button" aria-label={label} aria-selected={on} style={{ display: "flex", alignItems: "center", gap: 7, height: 28, flexShrink: 0, paddingLeft: 10, paddingRight: 10, borderWidth: 1, borderColor: p.sel, borderRadius: 8, color: color ?? p.text3, cursor: "pointer", hover: HOVER, ...(on ? { backgroundColor: p.sel } : {}) }}>
      <Icon name={icon} size={14} color={color ?? p.text3} />
      <div style={{ whiteSpace: "nowrap" }}>{label}</div>
      {children}
    </div>
  );
}

/** The card's top bar: history, where you are, find, the debugger and the agent. */
export function Header(): ReactElement {
  const { p } = useTheme();
  const bench = useBench();
  const { wb, program, nameOf, focusAddr, agentName } = bench;
  const { s } = wb;
  const at = currentAddr(bench);
  const segment = segmentOf(program.segments, at);
  const debugging = showing(s, "debug");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, height: 44, flexShrink: 0, paddingLeft: 10, paddingRight: 8 }}>
      {!s.sidebarOpen && <IconButton icon="sidebar" label="Show sidebar" iconSize={16} onClick={() => wb.patch({ sidebarOpen: true })} />}
      <IconButton icon="back" label="Back" color={s.at > 0 ? p.text3 : p.faint} onClick={wb.back} />
      <IconButton icon="forward" label="Forward" color={s.at < s.trail.length - 1 ? p.text3 : p.faint} onClick={wb.forward} />
      <div role="navigation" aria-label="Where you are" style={{ display: "flex", alignItems: "center", gap: 6, flexGrow: 1, flexShrink: 1, minWidth: 0, paddingLeft: 6, color: p.muted, whiteSpace: "nowrap", overflow: "hidden" }}>
        <div style={{ flexShrink: 0 }}>{program.name}</div>
        {segment && <div style={{ color: p.faint }}>›</div>}
        {segment && <div style={{ flexShrink: 0 }}>{segment}</div>}
        <div style={{ color: p.faint }}>›</div>
        <div style={{ minWidth: 0, color: p.text, fontSize: 12, ...MONO_STYLE, ...ELLIPSIS }}>{placeIn(nameOf(focusAddr), focusAddr, at)}</div>
      </div>
      <Tooltip label="Find text, numbers or bytes in this file">
        <div style={{ display: "flex" }}>
          <Pill icon="search" label="Find" onClick={() => wb.reveal("find")}>
            <CommandKeys id="find" />
          </Pill>
        </div>
      </Tooltip>
      <Tooltip label="Run this program under the debugger. It stops at your breakpoints.">
        <div style={{ display: "flex" }}>
          <Pill icon="play" label={debugging ? "Debugging" : "Debug"} on={debugging} {...(debugging ? { color: p.string } : {})} onClick={() => wb.toggleTool("debug")} />
        </div>
      </Tooltip>
      <Pill icon="spark" label={`Ask ${agentName}`} on={showing(s, "agent")} onClick={() => { wb.patch({ pickerOpen: false }); wb.toggleTool("agent"); }} />
    </div>
  );
}
