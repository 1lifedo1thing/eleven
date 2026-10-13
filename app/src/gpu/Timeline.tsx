import type { ReactElement } from "react";

import { useTheme } from "../theme";
import { useCodeLook } from "../settings/look";
import { spanFill, text } from "./look";
import type { Lane, Recording, Span } from "./types";

const LABEL_WIDTH = 120;

function percent(ms: number, frameMs: number): string {
  return `${(ms / frameMs) * 100}%`;
}

function Axis({ recording }: { readonly recording: Recording }): ReactElement {
  const { p } = useTheme();
  const { family } = useCodeLook();
  const ticks = Array.from({ length: Math.floor(recording.frameMs / recording.tickMs) }, (_, ix) => ix * recording.tickMs);
  return (
    <div style={{ display: "flex", marginBottom: 6, paddingLeft: LABEL_WIDTH, fontFamily: family, color: p.faint, ...text(11) }}>
      {ticks.map((ms) => <div key={ms} style={{ flexGrow: 1, flexBasis: 0 }}>{ms === 0 ? "0 ms" : String(ms)}</div>)}
      <div>{`${recording.frameMs} ms`}</div>
    </div>
  );
}

function Bar({ span, frameMs, on, onPick }: { readonly span: Span; readonly frameMs: number; readonly on: boolean; readonly onPick: () => void }): ReactElement {
  const { p } = useTheme();
  return (
    <div onClick={onPick} aria-label={span.label} style={{ display: "flex", alignItems: "center", width: percent(span.endMs - span.startMs, frameMs), height: 22, flexShrink: 0, overflow: "hidden", paddingLeft: 6, paddingRight: 6, borderWidth: 1, borderColor: "transparent", borderRadius: 5, backgroundColor: spanFill(span.tone, on), cursor: "pointer" }}>
      <div style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: p.text, ...text(11) }}>{span.label}</div>
    </div>
  );
}

function LaneRow({ lane, frameMs, selected, onPick }: {
  readonly lane: Lane;
  readonly frameMs: number;
  readonly selected: string;
  readonly onPick: (id: string) => void;
}): ReactElement {
  const { p } = useTheme();
  return (
    <div style={{ display: "flex", alignItems: "center", height: 35, borderTopWidth: 1, borderColor: p.raised2 }}>
      <div style={{ width: LABEL_WIDTH, flexShrink: 0, color: p.text4, ...text(12) }}>{lane.name}</div>
      <div style={{ display: "flex", flexGrow: 1, minWidth: 0, height: 22 }}>
        {lane.spans.flatMap((span, ix) => {
          const gap = span.startMs - (lane.spans[ix - 1]?.endMs ?? 0);
          return [
            <div key={`${span.id}-gap`} style={{ width: percent(gap, frameMs), flexShrink: 0 }} />,
            <Bar key={span.id} span={span} frameMs={frameMs} on={span.id === selected} onPick={() => onPick(span.id)} />,
          ];
        })}
      </div>
    </div>
  );
}

/** One recorded frame: a lane per CPU thread or GPU queue, a bar per piece of work. */
export function Timeline({ recording, selected, onPick }: {
  readonly recording: Recording;
  readonly selected: string;
  readonly onPick: (id: string) => void;
}): ReactElement {
  const { p } = useTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", flexShrink: 0, paddingTop: 12, paddingBottom: 6, paddingLeft: 12, paddingRight: 12, borderWidth: 1, borderColor: p.sel, borderRadius: 10 }}>
      <Axis recording={recording} />
      {recording.lanes.map((lane) => <LaneRow key={lane.name} lane={lane} frameMs={recording.frameMs} selected={selected} onPick={onPick} />)}
    </div>
  );
}
