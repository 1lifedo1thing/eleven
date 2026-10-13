import { type ReactElement, useMemo, useState } from "react";

import { EmptyState } from "../components/kit";
import { useListWindow } from "../lib/useListWindow";
import { useBench } from "./parts";
import { ResizeHandle } from "./Resize";
import { Footer, type FooterMenu } from "./sidebar/Footer";
import { FnRowView, FunctionsHead, type FnView } from "./sidebar/Functions";
import { functionRows, type FnShow, type FnSort } from "./sidebar/model";
import { Faint, useSectionOpen } from "./sidebar/parts";
import { Blocks, InThisModel } from "./sidebar/ModelSections";
import { Chats, InThisFile, SourceFiles, YourWork } from "./sidebar/Sections";
import { ProjectSwitcher, QuickActions } from "./sidebar/Top";

function useFnView(): FnView {
  const [sort, setSort] = useState<FnSort>("files");
  const [show, setShow] = useState<FnShow>("all");
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());
  return {
    sort, show, folded, setSort, setShow,
    toggleFolder: (name) => {
      const next = new Set(folded);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      setFolded(next);
    },
  };
}

/** The sections, then one row per function or class, so only rows near the viewport are built. */
function NavList({ view }: { readonly view: FnView }): ReactElement {
  const { program, wb, nameOf, chat } = useBench();
  const { open } = useSectionOpen("functions");
  const model = chat.target?.kind === "model";
  const rows = useMemo(
    () => (open && !model ? functionRows(program.functions, { nameOf, renamed: new Set(wb.s.names.keys()), query: wb.s.filter, show: view.show, sort: view.sort, folded: view.folded }) : []),
    [open, model, program, wb.s.names, wb.s.filter, view.show, view.sort, view.folded],
  );
  const fixed = model
    ? [<Chats key="chats" />, <InThisModel key="model" />, <Blocks key="blocks" />]
    : [<Chats key="chats" />, <YourWork key="work" />, <InThisFile key="data" />, <SourceFiles key="source" />, <FunctionsHead key="functions" view={view} />];
  const query = wb.s.filter.trim();
  const none = open && !model && rows.length === 0 ? [program.functions.length === 0 ? <Faint key="none" text="Loading functions…" /> : (
    <div key="none" style={{ display: "flex", flexDirection: "column", paddingTop: 4, paddingBottom: 8 }}>
      <EmptyState title={query ? `No functions match “${query}”` : "Nothing to show here"} hint="Try part of an address, like 4088, or ask the agent to search." />
    </div>
  )] : [];
  const total = fixed.length + rows.length + none.length;
  const shown = useListWindow(total);
  const itemAt = (ix: number): ReactElement | undefined => {
    if (ix < fixed.length) return <div key={`s${ix}`} style={{ display: "flex", flexDirection: "column", width: "100%" }}>{fixed[ix]}</div>;
    const row = rows[ix - fixed.length];
    if (row) return <FnRowView key={row.kind === "node" ? `n:${row.path}` : row.fn.addr} row={row} view={view} />;
    return none[ix - fixed.length - rows.length];
  };
  return (
    <virtual-list itemCount={total} windowStart={shown.start} estimatedItemHeight={30} onVisibleRange={shown.onVisibleRange} style={{ flexGrow: 1, minHeight: 0, marginTop: 8 }}>
      {Array.from({ length: shown.end - shown.start }, (_, i) => itemAt(shown.start + i))}
    </virtual-list>
  );
}

/** The workspace sidebar: the project, quick actions, chats, your work, the file's data and sources, functions, then Eleven. */
export function Nav(): ReactElement {
  const { wb } = useBench();
  const view = useFnView();
  const [menu, setMenu] = useState<FooterMenu>({ open: false, sub: null });
  return (
    <div role="navigation" aria-label="Workspace" style={{ position: "relative", display: "flex", flexDirection: "column", width: wb.s.sizes.sidebar, flexShrink: 0, minHeight: 0, paddingLeft: 10, paddingRight: 10, paddingBottom: 10 }}>
      <ResizeHandle edge="sidebar" />
      <ProjectSwitcher />
      <QuickActions onPlaybooks={() => setMenu({ open: true, sub: "playbooks" })} />
      <NavList view={view} />
      <Footer menu={menu} onMenu={setMenu} />
    </div>
  );
}
