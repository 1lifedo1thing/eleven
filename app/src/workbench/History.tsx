import { type ReactElement, useEffect, useState } from "react";

import { authorName, canUndo, describeEdit, type Edit } from "../engine/edits";
import { accept, decline, pending, redo, undo } from "../engine/history";
import { loadProject, onProjectChange, type Project } from "../engine/project";
import { errorMessage } from "../lib/guards";
import { useTheme } from "../theme";
import { HOVER, SegItem, TextButton, useBench } from "./parts";

type Who = "all" | "you" | "agents";

const WHO: readonly { readonly who: Who; readonly label: string }[] = [
  { who: "all", label: "All" },
  { who: "you", label: "You" },
  { who: "agents", label: "Agents" },
];

/** The open file's project, kept current as you or an agent change it. */
export function useProject(id: string): Project {
  const [project, setProject] = useState(() => loadProject(id));
  useEffect(() => {
    setProject(loadProject(id));
    return onProjectChange((changed) => {
      if (changed === id) setProject(loadProject(id));
    });
  }, [id]);
  return project;
}

function when(at: number): string {
  const date = new Date(at);
  const today = new Date().toDateString() === date.toDateString();
  return today ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function Link({ label, onClick }: { readonly label: string; readonly onClick: () => void }): ReactElement {
  const { p } = useTheme();
  return <div onClick={onClick} role="button" style={{ fontSize: 12, color: p.link, cursor: "pointer", hover: HOVER }}>{label}</div>;
}

/** Describes an edit with the workbench's names; a first rename shows the function's original name. */
export function useDescribe(): (edit: Edit) => string {
  const { nameOf, program } = useBench();
  return (edit) => describeEdit(edit, nameOf, (addr) => program.functions.find((fn) => fn.addr === addr)?.name ?? addr);
}

function Row({ edit, faded, children }: { readonly edit: Edit; readonly faded: boolean; readonly children: ReactElement | null }): ReactElement {
  const { p } = useTheme();
  const { openFn } = useBench();
  const describe = useDescribe();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 26, paddingLeft: 4, paddingRight: 4, fontSize: 12, opacity: faded ? 0.5 : 1 }}>
      <div style={{ width: 64, flexShrink: 0, color: p.muted }}>{authorName(edit.by)}</div>
      <div style={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2, paddingTop: 4, paddingBottom: 4 }}>
        <div onClick={() => openFn(edit.key, false)} role="button" style={{ color: p.text, cursor: "pointer", hover: HOVER }}>{describe(edit)}</div>
        {edit.reason ? <div style={{ color: p.muted }}>{edit.reason}</div> : null}
      </div>
      <div style={{ flexShrink: 0, color: p.faint }}>{when(edit.changedAt)}</div>
      {children}
    </div>
  );
}

/** Agent suggestions waiting for a yes, like byte patches. */
export function Changes(): ReactElement {
  const { p } = useTheme();
  const { program, wb } = useBench();
  const waiting = pending(useProject(program.id));
  const act = (run: () => void, text: string): void => {
    try {
      run();
      wb.notify(text, null);
    } catch (err) {
      wb.notify(`Couldn't do that. ${errorMessage(err)}`, null);
    }
  };
  if (waiting.length === 0) {
    return <div style={{ marginTop: 4, color: p.muted }}>Nothing waiting. When an agent suggests a byte patch, it shows up here for you to accept or decline.</div>;
  }
  const ids = waiting.map((edit) => edit.id);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ flexGrow: 1, color: p.muted }}>{`${waiting.length} ${waiting.length === 1 ? "suggestion" : "suggestions"} from agents. Nothing is saved until you accept.`}</div>
        <TextButton label="Accept all" tone="primary" onClick={() => act(() => accept(program.id, ids), `Accepted ${ids.length}`)} />
        <TextButton label="Decline all" tone="outline" onClick={() => act(() => decline(program.id, ids), `Declined ${ids.length}`)} />
      </div>
      {waiting.map((edit) => (
        <Row key={edit.id} edit={edit} faded={false}>
          <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
            <Link label="Accept" onClick={() => act(() => accept(program.id, [edit.id]), "Accepted")} />
            <Link label="Decline" onClick={() => act(() => decline(program.id, [edit.id]), "Declined")} />
          </div>
        </Row>
      ))}
    </div>
  );
}

/** Every change to the project by you or an agent, newest first, each one reversible while nothing newer touched it. */
export function History(): ReactElement {
  const { p } = useTheme();
  const { program, wb } = useBench();
  const describe = useDescribe();
  const project = useProject(program.id);
  const [who, setWho] = useState<Who>("all");
  const shown = [...project.edits].reverse().filter((edit) => edit.status !== "proposed" && (who === "all" || (who === "you") === (edit.by.kind === "you")));
  const act = (run: () => Edit | null, verb: string): void => {
    try {
      const edit = run();
      if (edit) wb.notify(`${verb}: ${describe(edit)}`, null);
    } catch (err) {
      wb.notify(errorMessage(err), null);
    }
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 6 }}>
        {WHO.map((w) => <SegItem key={w.who} label={w.label} on={who === w.who} onBg={p.sel} padding={8} onClick={() => setWho(w.who)} />)}
      </div>
      {shown.length === 0 && <div style={{ marginTop: 4, color: p.muted }}>No changes yet. Renames, notes, comments, bookmarks and patches, yours and the agents', are listed here with a way to undo them.</div>}
      {shown.map((edit) => (
        <Row key={edit.id} edit={edit} faded={edit.status !== "applied"}>
          {edit.status === "applied" && canUndo(project, edit) ? <Link label="Undo" onClick={() => act(() => undo(program.id, edit.id), "Undid")} />
            : edit.status === "undone" ? <Link label="Redo" onClick={() => act(() => redo(program.id, edit.id), "Redid")} />
            : <div style={{ fontSize: 12, color: p.faint }}>{edit.status === "rejected" ? "Declined" : edit.status === "applied" ? "Changed since" : ""}</div>}
        </Row>
      ))}
    </div>
  );
}
