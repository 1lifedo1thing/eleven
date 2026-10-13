import { useEffect } from "react";

import { claimViewSwitch, reportView, type ViewName } from "../bridge/view";
import { loadProject, onProjectChange } from "../engine/project";
import type { CodeMode, Program, Tab } from "./model";
import type { Workbench } from "./state";

const NAME: Readonly<Record<CodeMode, ViewName>> = { pseudo: "pseudocode", asm: "assembly", graph: "graph", hex: "hex" };
const MODE: Readonly<Record<ViewName, CodeMode>> = { pseudocode: "pseudo", assembly: "asm", graph: "graph", hex: "hex" };

/** Keeps the agent's view of the workbench honest: what is in focus, view switching, and renames it makes. */
export function useAgentView(program: Program, wb: Workbench, tab: Tab | undefined, focusAddr: string, name: string): void {
  useEffect(() => {
    return onProjectChange((id) => {
      if (id === program.id) wb.restore(loadProject(id));
    });
  }, [program.id]);
  const view = tab?.kind === "fn" ? NAME[tab.view] : null;
  useEffect(() => {
    reportView({ fn: name, address: focusAddr, view });
  }, [name, focusAddr, view]);
  useEffect(() => {
    claimViewSwitch((next) => {
      wb.setView(wb.s.focus, MODE[next]);
      return true;
    });
    return () => claimViewSwitch(null);
  }, [wb.s.focus]);
}
