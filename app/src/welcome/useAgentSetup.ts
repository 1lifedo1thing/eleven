import { useEffect, useState } from "react";

import type { AgentEntry } from "../agents/registry";
import type { Agents } from "../chat/useAgents";
import { agentStatus, type AgentStatus, downloaded, installAgent, signIn } from "./agentSetup";

const installing = new Set<string>();
const failed = new Set<string>();
const listeners = new Set<() => void>();

function changed(): void {
  listeners.forEach((listener) => listener());
}

async function install(agent: AgentEntry): Promise<void> {
  if (installing.has(agent.id)) return;
  installing.add(agent.id);
  failed.delete(agent.id);
  changed();
  try {
    await installAgent(agent);
  } catch {
    failed.add(agent.id);
  } finally {
    installing.delete(agent.id);
    changed();
  }
}

export type AgentSetup = {
  readonly status: (agent: AgentEntry) => AgentStatus;
  readonly install: (agent: AgentEntry) => void;
  readonly signIn: (agent: AgentEntry) => void;
};

/** Installs keep running between steps; sign-in is rechecked every few seconds while setup is open. */
export function useAgentSetup(agents: Agents): AgentSetup {
  const [, setTick] = useState(0);
  const [onDisk, setOnDisk] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const refresh = async (): Promise<void> => {
      const ids = await Promise.all(agents.list.map(async (agent) => ((await downloaded(agent)) ? agent.id : null)));
      setOnDisk(new Set(ids.filter((id): id is string => id !== null)));
      setTick((n) => n + 1);
    };
    const listener = (): void => void refresh();
    listeners.add(listener);
    void refresh();
    const timer = setInterval(listener, 3000);
    return () => {
      listeners.delete(listener);
      clearInterval(timer);
    };
  }, [agents.list]);
  return {
    status: (agent) => agentStatus(agent, { native: agents.installed.get(agent.id)?.command ?? null, downloaded: onDisk.has(agent.id), installing: installing.has(agent.id), failed: failed.has(agent.id) }),
    install: (agent) => void install(agent),
    signIn,
  };
}
