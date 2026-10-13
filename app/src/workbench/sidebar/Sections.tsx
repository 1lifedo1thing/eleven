import { type ReactElement, useMemo, useState } from "react";

import { threadMenu } from "../../chat/threadMenu";
import { ThreadName } from "../../chat/ThreadName";
import { loadProject } from "../../engine/project";
import { useTheme } from "../../theme";
import { goTo } from "../actions";
import { GpuSection } from "../GpuTabs";
import type { ListKind } from "../model";
import { useBench } from "../parts";
import { logoFor, sourcePaths, sourceTree } from "./model";
import { Faint, SideRow, SideSection } from "./parts";

const RECENT_CHATS = 5;
const NEST = 18;

export function Chats(): ReactElement {
  const { p } = useTheme();
  const { wb, chat } = useBench();
  const [all, setAll] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const current = chat.thread.id;
  const shown = all ? chat.saved : chat.saved.slice(0, RECENT_CHATS);
  const hidden = chat.saved.length - shown.length;
  const show = (id: string): void => {
    chat.openThread(id);
    wb.reveal("agent");
  };
  return (
    <SideSection id="threads" title="Chats" count={chat.saved.length > 0 ? `${chat.saved.length}` : ""}>
      {chat.saved.length === 0 && <Faint text="Ask the agent something to start a chat." />}
      {shown.map((thread) => (thread.id === renaming
        ? <ThreadName key={thread.id} id={thread.id} title={thread.title} height={32} onDone={() => setRenaming(null)} />
        : <SideRow key={thread.id} lead={{ kind: "dot", color: thread.id === current && chat.thread.busy ? p.data : p.line3 }} label={thread.title} on={thread.id === current} onClick={() => show(thread.id)} menu={() => threadMenu(chat, thread.id, thread.title, () => setRenaming(thread.id), () => show(thread.id))} />
      ))}
      {(hidden > 0 || all) && <SideRow lead={{ kind: "none" }} label={all ? "Show fewer" : `Show ${hidden} more`} onClick={() => setAll(!all)} />}
    </SideSection>
  );
}

type WorkItem = { readonly key: string; readonly label: string; readonly addr: string };

type WorkKind = { readonly id: string; readonly label: string; readonly icon: string; readonly items: readonly WorkItem[] };

function useWork(): readonly WorkKind[] {
  const { wb, program, nameOf } = useBench();
  const { s } = wb;
  const at = (addr: string, label = nameOf(addr)): WorkItem => ({ key: addr, label, addr });
  return [
    { id: "bookmarks", label: "Bookmarks", icon: "bookmark", items: s.bookmarks.map((b) => at(b.addr)) },
    { id: "renames", label: "Renames", icon: "rename", items: [...s.names.keys()].map((addr) => at(addr)) },
    { id: "notes", label: "Notes", icon: "note", items: [...s.notes.keys()].map((addr) => at(addr)) },
    { id: "comments", label: "Comments", icon: "thread", items: [...s.comments.entries()].map(([addr, text]) => ({ key: addr, label: text, addr })) },
    { id: "patches", label: "Patches", icon: "hex", items: loadProject(program.id).patches.map((patch) => ({ key: patch.addr, label: patch.bytes, addr: patch.addr })) },
    { id: "groups", label: "Groups", icon: "graph", items: s.groups.map((group) => ({ key: `${group.fn}:${group.label}`, label: group.label, addr: group.fn })) },
  ];
}

/** Everything you have saved in this project, each kind opening in place to list what it holds. */
export function YourWork(): ReactElement {
  const bench = useBench();
  const work = useWork();
  const [expanded, setExpanded] = useState<string | null>(null);
  const total = work.reduce((sum, kind) => sum + kind.items.length, 0);
  return (
    <SideSection id="work" title="Your work" count={total > 0 ? `${total}` : ""}>
      {work.map((kind) => (
        <div key={kind.id} style={{ display: "flex", flexDirection: "column" }}>
          <SideRow lead={{ kind: "icon", name: kind.icon }} label={kind.label} side={`${kind.items.length}`} on={expanded === kind.id} onClick={() => setExpanded(expanded === kind.id ? null : kind.id)} />
          {expanded === kind.id && kind.items.length === 0 && <Faint text={`No ${kind.label.toLowerCase()} yet.`} indent={NEST} />}
          {expanded === kind.id && kind.items.map((item) => (
            <SideRow key={item.key} lead={{ kind: "none" }} label={item.label} side={item.addr.slice(-5)} mono indent={NEST} height={28} onClick={() => goTo(bench, item.addr)} />
          ))}
        </div>
      ))}
    </SideSection>
  );
}

const LISTS: readonly { readonly list: ListKind; readonly label: string; readonly icon: string }[] = [
  { list: "strings", label: "Strings", icon: "strings" },
  { list: "imports", label: "Imports", icon: "library" },
  { list: "segments", label: "Segments", icon: "segments" },
];

function ShadersAndModels(): ReactElement | null {
  const [open, setOpen] = useState(false);
  return (
    <GpuSection frame={(count, body) => (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <SideRow lead={{ kind: "icon", name: "gpu" }} label="Shaders and models" side={`${count}`} on={open} onClick={() => setOpen(!open)} />
        {open && <div style={{ display: "flex", flexDirection: "column", paddingLeft: NEST }}>{body}</div>}
      </div>
    )} />
  );
}

export function InThisFile(): ReactElement {
  const { program, wb } = useBench();
  const pane = wb.s.panes[wb.s.focus];
  const tab = pane?.tabs[pane.active];
  return (
    <SideSection id="data" title="In this file" count="">
      <SideRow lead={{ kind: "icon", name: "assembly" }} label="Listing" on={tab?.kind === "listing"} onClick={() => wb.open({ kind: "listing" }, false)} menu={() => [
        { kind: "action", label: "Open the whole-file listing", icon: "assembly", run: () => wb.open({ kind: "listing" }, false) },
        { kind: "action", label: "Open in split", icon: "split", run: () => wb.openSplit({ kind: "listing" }) },
      ]} />
      {LISTS.map((d) => (
        <SideRow key={d.list} lead={{ kind: "icon", name: d.icon }} label={d.label} side={program[d.list].length.toLocaleString()} on={tab?.kind === "list" && tab.list === d.list} onClick={() => wb.open({ kind: "list", list: d.list }, false)} menu={() => [
          { kind: "action", label: `Open ${d.label.toLowerCase()}`, icon: d.icon, run: () => wb.open({ kind: "list", list: d.list }, false) },
          { kind: "action", label: "Open in split", icon: "split", run: () => wb.openSplit({ kind: "list", list: d.list }) },
        ]} />
      ))}
      <ShadersAndModels />
    </SideSection>
  );
}

/** The files the binary was built from, as far as the paths its compiler left behind tell. */
export function SourceFiles(): ReactElement | null {
  const { program, wb } = useBench();
  const paths = useMemo(() => sourcePaths(program.strings.map((row) => row.b)), [program]);
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const tree = useMemo(() => sourceTree(paths, closed), [paths, closed]);
  const toggle = (path: string): void => {
    const next = new Set(closed);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setClosed(next);
  };
  if (paths.length === 0) return null;
  return (
    <SideSection id="source" title="Source files" count={`${paths.length} ${paths.length === 1 ? "file" : "files"}`}>
      <Faint text="From file paths in the binary" />
      {tree.map((node) => node.folder
        ? <SideRow key={node.path} lead={{ kind: "icon", name: closed.has(node.path) ? "folder" : "folder-open" }} label={node.name} indent={node.depth * NEST} onClick={() => toggle(node.path)} />
        : <SideRow key={node.path} lead={{ kind: "logo", name: logoFor(node.ext) }} label={node.name} indent={node.depth * NEST} onClick={() => wb.patch({ paletteOpen: true, paletteQuery: node.name })} />)}
    </SideSection>
  );
}
