import { type ReactElement, useState } from "react";

import { chatTitle } from "../chat/useChat";
import { Tooltip } from "../components/kit";
import { useTheme } from "../theme";
import { Spacer } from "../components/ui";
import { CodeLines } from "./CodeLines";
import { DebugView } from "./DebugView";
import { DiffView } from "./DiffView";
import { ModelTab, ProfileTab, ShaderTab } from "./GpuTabs";
import { Graph } from "./Graph";
import { EmptyPane, HexView, TableView } from "./Lists";
import { Listing } from "./Listing";
import { SourceView } from "./SourceView";
import { LiveThread } from "./LiveThread";
import type { CodeMode, Tab } from "./model";
import { useSize } from "../lib/useSize";
import { TYPING } from "../lib/shortcuts";
import { goTo } from "./actions";
import { IconButton, MONO_STYLE, SegItem, useBench } from "./parts";
import { TabBar } from "./TabBar";
import { fillsSpace, ToolBody } from "./Tools";
import { showAddress } from "../settings/look";

const MODES: readonly { readonly mode: CodeMode; readonly label: string; readonly icon: string; readonly tip: string }[] = [
  { mode: "asm", label: "Listing", icon: "assembly", tip: "The machine instructions in order, with labels and references" },
  { mode: "pseudo", label: "Pseudocode", icon: "pseudocode", tip: "The function rebuilt as C-like code. Easiest to read, but a guess." },
  { mode: "graph", label: "Graph", icon: "graph", tip: "The function's branches and loops as connected blocks" },
  { mode: "hex", label: "Hex", icon: "hex", tip: "The raw bytes in the file at this address" },
];

/** Below this pane width the view switch shows only icons. */
const WORDS_FROM = 640;

/** Takes an address like 1a98 or 0x1000016d8, or a function name, and opens it. */
function GoTo({ addr }: { readonly addr: string }): ReactElement {
  const { p } = useTheme();
  const bench = useBench();
  const [draft, setDraft] = useState("");
  const go = (): void => {
    const text = draft.trim();
    if (!text) return;
    const named = bench.addrOf(text);
    if (named) bench.openFn(named, false);
    else if (/^(0x)?[0-9a-f]+$/i.test(text)) goTo(bench, text.startsWith("0x") ? text.toLowerCase() : `0x${text.toLowerCase()}`);
    else return;
    setDraft("");
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexGrow: 0, flexShrink: 1, flexBasis: 260, minWidth: 120, height: 26, paddingLeft: 8, paddingRight: 8, borderWidth: 1, borderColor: p.line2, borderRadius: 7, backgroundColor: p.deep }}>
      <div style={{ fontSize: 11, color: p.faint, ...MONO_STYLE }}>G</div>
      <input {...TYPING} value={draft} placeholder={showAddress(addr)} aria-label="Go to address or symbol" onChange={(e) => setDraft(e.value ?? "")} onSubmit={go} style={{ flexGrow: 1, minWidth: 0, fontSize: 12, color: p.text3, ...MONO_STYLE }} />
    </div>
  );
}

function ModeBar({ pane, addr, view, width }: { readonly pane: number; readonly addr: string; readonly view: CodeMode; readonly width: number }): ReactElement {
  const { p } = useTheme();
  const { wb, nameOf } = useBench();
  const words = width === 0 || width >= WORDS_FROM;
  const marked = wb.s.bookmarks.some((b) => b.addr === addr);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, height: 34, flexShrink: 0, paddingLeft: 10, paddingRight: 8, overflow: "hidden" }}>
      <GoTo addr={addr} />
      <Spacer />
      <div role="radiogroup" aria-label="View" style={{ display: "flex", flexShrink: 0, gap: 2, padding: 2, borderRadius: 8, backgroundColor: p.fill }}>
        {MODES.map((m) => (
          <Tooltip key={m.mode} label={words ? m.tip : `${m.label}: ${m.tip}`}>
            <div style={{ display: "flex" }}>
              <SegItem label={m.label} name={`${m.label} view`} icon={m.icon} words={words} on={m.mode === view} onBg={p.sel2} padding={words ? 9 : 6} onClick={() => wb.setView(pane, m.mode)} />
            </div>
          </Tooltip>
        ))}
      </div>
      {view === "asm" && <IconButton icon="split" label="Pseudocode beside it, lines linked" on={wb.s.linked} color={wb.s.linked ? p.text : p.muted} size={26} iconSize={15} onClick={() => wb.besidePseudo(addr)} />}
      {view === "asm" && <IconButton icon="hex" label="Show bytes" on={wb.s.showBytes} color={wb.s.showBytes ? p.text : p.muted} size={26} iconSize={15} onClick={() => wb.patch({ showBytes: !wb.s.showBytes })} />}
      <IconButton icon="bookmark" on={marked} color={marked ? p.data : p.muted} label="Bookmark" size={26} iconSize={15} onClick={() => wb.toggleBookmark({ addr, label: nameOf(addr) })} />
    </div>
  );
}

function ThreadView(): ReactElement {
  const { chat } = useBench();
  return (
    <div style={{ display: "flex", justifyContent: "center", flexGrow: 1, minHeight: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, flexGrow: 1, minHeight: 0, maxWidth: 720, paddingTop: 24, paddingLeft: 4, paddingRight: 4 }}>
        <div style={{ paddingLeft: 16, fontSize: 17, fontWeight: 600 }}>{`${chatTitle(chat) ?? "New chat"} · ${chat.agents.selected.name}`}</div>
        <LiveThread chatId={chat.tabs.find((tab) => tab.active)?.id ?? null} />
      </div>
    </div>
  );
}

function Body({ tab }: { readonly tab: Tab | undefined }): ReactElement {
  if (!tab) return <EmptyPane />;
  switch (tab.kind) {
    case "fn":
      switch (tab.view) {
        case "pseudo":
        case "asm":
          return <CodeLines addr={tab.addr} view={tab.view} />;
        case "graph":
          return <Graph addr={tab.addr} />;
        case "hex":
          return <HexView addr={tab.addr} />;
        default: {
          const unhandled: never = tab.view;
          return unhandled;
        }
      }
    case "thread":
      return <ThreadView />;
    case "list":
      return <TableView list={tab.list} />;
    case "shader":
      return <ShaderTab library={tab.library} name={tab.name} />;
    case "model":
      return <ModelTab name={tab.name} />;
    case "profile":
      return <ProfileTab title={tab.title} />;
    case "diff":
      return <DiffView />;
    case "debug":
      return <DebugView />;
    case "listing":
      return <Listing />;
    case "source":
      return <SourceView file={tab.file} />;
    case "tool":
      return <ToolBody tool={tab.tool} />;
    default: {
      const unhandled: never = tab;
      return unhandled;
    }
  }
}

function ownsScroll(tab: Tab | undefined): boolean {
  if (tab?.kind === "list" || tab?.kind === "listing" || tab?.kind === "thread") return true;
  if (tab?.kind === "tool") return fillsSpace(tab.tool);
  return tab?.kind === "fn" && tab.view !== "hex";
}

/** One editor pane: its tabs, the view switcher for functions, and the open tab's content. */
export function Pane({ index }: { readonly index: number }): ReactElement {
  const { wb } = useBench();
  const { ref, width } = useSize();
  const pane = wb.s.panes[index];
  const tab = pane?.tabs[pane.active];
  return (
    <div ref={ref} role="region" aria-label="Editor" style={{ display: "flex", flexDirection: "column", flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, minHeight: 0 }}>
      <TabBar pane={index} />
      {tab?.kind === "fn" && <ModeBar pane={index} addr={tab.addr} view={tab.view} width={width} />}
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, minHeight: 0, overflow: ownsScroll(tab) ? "hidden" : "scroll" }}>
        <Body tab={tab} />
      </div>
    </div>
  );
}
