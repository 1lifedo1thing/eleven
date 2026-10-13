import type { ReactElement } from "react";

import { activeEngine } from "../analysis/engines";
import { Tooltip } from "../components/kit";
import { explainArch } from "../lib/explain";
import { useLoaded } from "../lib/useLoaded";
import { useTheme } from "../theme";
import { Dot, Icon, Spacer } from "../components/ui";
import { fileOffset } from "./patch";
import { HOVER, MONO_STYLE, useBench } from "./parts";
import { currentAddr, placeIn } from "./where";

function analysis(total: number, opening: boolean): string {
  if (opening) return "Analyzing…";
  return total === 1 ? "Analyzed, 1 function" : `Analyzed, ${total.toLocaleString("en-US")} functions`;
}

/** The status bar: analysis state, engine and arch, then exactly where you are and the details toggle. */
export function StatusBar(): ReactElement {
  const { p } = useTheme();
  const bench = useBench();
  const { wb, focusAddr, program, nameOf } = bench;
  const at = currentAddr(bench);
  const opening = program.id === "";
  const offset = useLoaded<number | null>(() => (program.dossier ? fileOffset(program.path, at) : Promise.resolve(null)), `${program.path}:${at}:offset`);
  return (
    <div role="contentinfo" aria-label="Status" style={{ display: "flex", alignItems: "center", gap: 14, height: 28, flexShrink: 0, paddingLeft: 10, paddingRight: 10, borderTopWidth: 1, borderColor: p.fill, fontSize: 11.5, color: p.muted, whiteSpace: "nowrap", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Dot color={opening ? p.data : p.string} size={6} />
        <div>{analysis(program.total || program.functions.length, opening)}</div>
      </div>
      <Tooltip label="The engine that reads the file and turns machine code into readable code" side="top">
        <div>{activeEngine()?.name ?? "No engine"}</div>
      </Tooltip>
      <Tooltip label={explainArch(program.arch)} side="top">
        <div>{program.arch}</div>
      </Tooltip>
      <Spacer />
      <div style={MONO_STYLE}>{placeIn(nameOf(focusAddr), focusAddr, at)}</div>
      <div style={MONO_STYLE}>{at}</div>
      {offset.kind === "ready" && offset.value !== null && <div style={MONO_STYLE}>{`file 0x${offset.value.toString(16)}`}</div>}
      <div onClick={() => wb.patch({ bottomOpen: !wb.s.bottomOpen })} role="button" aria-label="Toggle details" aria-selected={wb.s.bottomOpen} style={{ display: "flex", alignItems: "center", cursor: "pointer", hover: HOVER }}>
        <Icon name="panel" size={14} color={wb.s.bottomOpen ? p.text : p.faint} on={wb.s.bottomOpen} />
      </div>
    </div>
  );
}
