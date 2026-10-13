import { join } from "node:path";

import type { ReactElement } from "react";

import { Icon } from "../../components/ui";
import { ASSETS } from "../../lib/assets";
import { TYPING } from "../../lib/shortcuts";
import { useTheme } from "../../theme";
import { subjectMenu } from "../actions";
import { ELLIPSIS, HOVER, MONO_STYLE, useBench } from "../parts";
import { type FnRow, type FnShow, type FnSort, logoFor, nextSort, SORT_LABEL } from "./model";
import { Heading, ICON_COLUMN, INSET, ROW_GAP, useSectionOpen } from "./parts";

const NEST = 18;

const SHOWS: readonly { readonly id: FnShow; readonly label: string }[] = [
  { id: "all", label: "All" },
  { id: "renamed", label: "Renamed" },
  { id: "imports", label: "Imports" },
];

export type FnView = {
  readonly sort: FnSort;
  readonly show: FnShow;
  readonly folded: ReadonlySet<string>;
  readonly setSort: (sort: FnSort) => void;
  readonly setShow: (show: FnShow) => void;
  readonly toggleFolder: (path: string) => void;
};

/** The Functions heading, then the filter, the sort and the All / Renamed / Imports switch while it is open. */
export function FunctionsHead({ view }: { readonly view: FnView }): ReactElement {
  const { p } = useTheme();
  const { program, wb } = useBench();
  const { open } = useSectionOpen("functions");
  return (
    <div style={{ display: "flex", flexDirection: "column", flexShrink: 0, paddingBottom: open ? 4 : 0 }}>
      <Heading id="functions" title="Functions" count={program.total > 0 ? program.total.toLocaleString() : ""} />
      {open && (
        <>
          <div style={{ display: "flex", gap: 4, marginTop: 2, marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexGrow: 1, minWidth: 0, height: 30, paddingLeft: 10, paddingRight: 10, borderRadius: 8, backgroundColor: p.fill }}>
              <Icon name="search" size={13} color={p.muted} />
              <input {...TYPING} value={wb.s.filter} placeholder="Filter by name or address" aria-label="Filter functions" onChange={(e) => wb.patch({ filter: e.value ?? "" })} style={{ flexGrow: 1, minWidth: 0, fontSize: 12.5, color: p.text }} />
            </div>
            <div onClick={() => view.setSort(nextSort(view.sort))} role="button" aria-label={`Sort: ${SORT_LABEL[view.sort]}`} style={{ display: "flex", alignItems: "center", gap: 5, height: 30, flexShrink: 0, paddingLeft: 8, paddingRight: 8, borderRadius: 8, backgroundColor: p.fill, cursor: "pointer", hover: HOVER }}>
              <Icon name="sort" size={13} color={p.muted} />
              <div style={{ fontSize: 12, color: p.muted, whiteSpace: "nowrap", pointerEvents: "none" }}>{SORT_LABEL[view.sort]}</div>
            </div>
          </div>
          <div role="tablist" aria-label="Show" style={{ display: "flex", gap: 2, padding: 2, marginBottom: 6, borderRadius: 8, backgroundColor: p.fill }}>
            {SHOWS.map((tab) => {
              const on = view.show === tab.id;
              return (
                <div key={tab.id} onClick={() => view.setShow(tab.id)} role="tab" aria-selected={on} style={{ display: "flex", alignItems: "center", justifyContent: "center", flexGrow: 1, flexBasis: 0, height: 24, borderRadius: 6, fontSize: 12, color: on ? p.text : p.muted, cursor: "pointer", ...(on ? { backgroundColor: p.sel2 } : { hover: HOVER }) }}>
                  {tab.label}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function TreeLead({ row }: { readonly row: Extract<FnRow, { kind: "node" }> }): ReactElement {
  const { p } = useTheme();
  switch (row.tree) {
    case "folder":
      return <Icon name={row.open ? "folder-open" : "folder"} size={ICON_COLUMN} color={p.muted} />;
    case "file":
      return <img src={join(ASSETS, "icons", `${logoFor(row.ext)}.svg`)} objectFit="contain" style={{ width: 15, height: 15, pointerEvents: "none" }} />;
    case "class":
      return <Icon name="tag" size={ICON_COLUMN} color={p.muted} />;
    default: {
      const unhandled: never = row.tree;
      return unhandled;
    }
  }
}

function TreeRow({ row, onToggle }: { readonly row: Extract<FnRow, { kind: "node" }>; readonly onToggle: () => void }): ReactElement {
  const { p } = useTheme();
  return (
    <div onClick={onToggle} role="button" aria-expanded={row.open} aria-label={`${row.tree} ${row.name}`} style={{ display: "flex", alignItems: "center", gap: ROW_GAP, height: 28, flexShrink: 0, paddingLeft: INSET + row.depth * NEST, paddingRight: INSET, borderRadius: 8, cursor: "pointer", hover: HOVER }}>
      <Icon name={row.open ? "disclosure" : "forward"} size={10} color={p.faint} />
      <TreeLead row={row} />
      <div style={{ flexGrow: 1, minWidth: 0, fontSize: 12.5, color: p.text3, pointerEvents: "none", ...ELLIPSIS }}>{row.name}</div>
      <div style={{ flexShrink: 0, fontSize: 11, color: p.faint, pointerEvents: "none" }}>{`${row.count}`}</div>
    </div>
  );
}

/** A decompiled source file: the arrow folds its functions, the name opens the whole file. */
function FileRow({ row, onToggle }: { readonly row: Extract<FnRow, { kind: "node" }>; readonly onToggle: () => void }): ReactElement {
  const { p } = useTheme();
  const { wb } = useBench();
  const file = row.path.replace(/^\./, "");
  const on = wb.s.panes.some((pane) => {
    const tab = pane.tabs[pane.active];
    return tab?.kind === "source" && tab.file === file;
  });
  return (
    <div style={{ display: "flex", alignItems: "center", height: 28, flexShrink: 0, paddingLeft: INSET + row.depth * NEST - 6, paddingRight: INSET, borderRadius: 8, ...(on ? { backgroundColor: p.sel } : {}) }}>
      <div onClick={onToggle} role="button" aria-expanded={row.open} aria-label={`${row.open ? "Fold" : "Unfold"} ${row.name}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 28, flexShrink: 0, cursor: "pointer", hover: HOVER }}>
        <Icon name={row.open ? "disclosure" : "forward"} size={10} color={p.faint} />
      </div>
      <div onClick={() => wb.open({ kind: "source", file }, true)} role="button" aria-label={`Open ${row.name}`} style={{ display: "flex", alignItems: "center", gap: ROW_GAP, flexGrow: 1, minWidth: 0, height: 28, borderRadius: 6, cursor: "pointer", hover: HOVER }}>
        <TreeLead row={row} />
        <div style={{ flexGrow: 1, minWidth: 0, fontSize: 12.5, color: on ? p.text : p.text3, pointerEvents: "none", ...ELLIPSIS }}>{row.name}</div>
        <div style={{ flexShrink: 0, fontSize: 11, color: p.faint, pointerEvents: "none" }}>{`${row.count}`}</div>
      </div>
    </div>
  );
}

function FunctionRow({ row }: { readonly row: Extract<FnRow, { kind: "fn" }> }): ReactElement {
  const { p } = useTheme();
  const bench = useBench();
  const { openFn, focusAddr, wb } = bench;
  const { fn } = row;
  const on = fn.addr === focusAddr;
  return (
    <div {...subjectMenu(bench, { kind: "function", addr: fn.addr }, () => openFn(fn.addr, true))} role="button" aria-selected={on} aria-label={`function ${row.label}`} style={{ display: "flex", alignItems: "center", gap: ROW_GAP, height: 28, flexShrink: 0, paddingLeft: INSET + row.depth * NEST, paddingRight: INSET, borderRadius: 8, cursor: "pointer", hover: HOVER, ...(on ? { backgroundColor: p.sel } : {}) }}>
      <Icon name={fn.kind === "function" ? "function" : "library"} size={15} color={p.muted} />
      <div style={{ flexGrow: 1, minWidth: 0, fontSize: 12, color: on ? p.text : p.text3, pointerEvents: "none", ...MONO_STYLE, ...ELLIPSIS }}>{row.label}</div>
      {wb.s.names.has(fn.addr) && <div aria-label="Renamed by you" style={{ width: 6, height: 6, flexShrink: 0, borderRadius: 3, backgroundColor: p.link }} />}
      <div style={{ flexShrink: 0, fontSize: 11, color: p.faint, pointerEvents: "none", ...MONO_STYLE }}>{fn.addr.slice(-5)}</div>
    </div>
  );
}

export function FnRowView({ row, view }: { readonly row: FnRow; readonly view: FnView }): ReactElement {
  switch (row.kind) {
    case "node":
      return row.tree === "file"
        ? <FileRow row={row} onToggle={() => view.toggleFolder(row.path)} />
        : <TreeRow row={row} onToggle={() => view.toggleFolder(row.path)} />;
    case "fn":
      return <FunctionRow row={row} />;
    default: {
      const unhandled: never = row;
      return unhandled;
    }
  }
}
