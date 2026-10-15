import { type ReactElement, useMemo, useState } from "react";

import { useBench } from "../parts";
import { useFolders } from "./memory";
import { sourceTree } from "./model";
import { SideSection } from "./parts";
import { TreeFile, TreeFolder, TreeMore } from "./SourceRows";

/** res/ can hold thousands of files; past this the tree waits for "more". */
const SHOWN = 400;

function parentOf(path: string): string {
  return path.split("/").slice(0, -1).join("/");
}

function closedFolders(paths: readonly string[], isOpen: (key: string, byDefault: boolean) => boolean): ReadonlySet<string> {
  const nodes = sourceTree(paths, new Set());
  const siblings = new Map<string, number>();
  for (const node of nodes) siblings.set(parentOf(node.path), (siblings.get(parentOf(node.path)) ?? 0) + 1);
  return new Set(nodes.filter((node) => node.folder && !isOpen(`res:${node.path}`, siblings.get(parentOf(node.path)) === 1)).map((node) => node.path));
}

/** The app's files (manifest, plists, res, assets, native libraries and frameworks), each opening in a resource tab. Lone binaries have none. */
export function Resources(): ReactElement | null {
  const { program, wb } = useBench();
  const folders = useFolders();
  const [all, setAll] = useState(false);
  const paths = program.resources?.files ?? [];
  const closed = useMemo(() => closedFolders(paths, folders.isOpen), [paths, folders]);
  const tree = useMemo(() => sourceTree(paths, closed), [paths, closed]);
  if (paths.length === 0) return null;
  const pane = wb.s.panes[wb.s.focus];
  const tab = pane?.tabs[pane.active];
  const shown = all ? tree : tree.slice(0, SHOWN);
  return (
    <SideSection id="resources" title="Resources" count={`${paths.length.toLocaleString()} ${paths.length === 1 ? "file" : "files"}`}>
      {shown.map((node) => node.folder
        ? <TreeFolder key={node.path} name={node.name} open={!closed.has(node.path)} depth={node.depth} onClick={() => folders.toggle(`res:${node.path}`)} />
        : <TreeFile key={node.full} name={node.name} ext={node.ext} depth={node.depth} count="" on={tab?.kind === "resource" && tab.file === node.full}
          onClick={() => wb.open({ kind: "resource", file: node.full }, true)}
          menu={() => [
            { kind: "action", label: "Open", icon: "source", run: () => wb.open({ kind: "resource", file: node.full }, false) },
            { kind: "action", label: "Open in split", icon: "split", run: () => wb.openSplit({ kind: "resource", file: node.full }) },
          ]} />)}
      {tree.length > SHOWN && <TreeMore label={all ? "Show fewer" : `${(tree.length - SHOWN).toLocaleString()} more`} onClick={() => setAll(!all)} />}
    </SideSection>
  );
}
