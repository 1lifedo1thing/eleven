import { useEffect, useRef } from "react";

import type { AgentEvent, PermissionChoice } from "../agents/events";
import { shownText } from "../skills/load";
import type { Message, ThreadState } from "../chat/thread";
import { askButtons, askTag, type ChatRef } from "./moments";
import { openChat, settle, tell } from "./notify";

type Answer = (index: number, permissionId: number, choice: PermissionChoice | null) => void;

export type ChatInfo = {
  readonly id: string;
  readonly live: boolean;
  readonly project: string | null;
  readonly agent: string;
  readonly answer: Answer;
};

function title(messages: readonly Message[]): string {
  const first = messages.find((message) => message.kind === "user");
  return first?.kind === "user" ? (shownText(first.text).split("\n")[0] ?? "") : "";
}

function lastIndex(messages: readonly Message[], matches: (message: Message) => boolean): number {
  for (let ix = messages.length - 1; ix >= 0; ix--) {
    const message = messages[ix];
    if (message && matches(message)) return ix;
  }
  return -1;
}

function lastAnswer(messages: readonly Message[]): string {
  const last = messages[lastIndex(messages, (message) => message.kind === "agent")];
  if (last?.kind !== "agent") return "";
  return last.blocks.map((block) => (block.kind === "text" ? block.text : "")).join("").trim();
}

function askIndex(messages: readonly Message[], ask: number): number {
  return lastIndex(messages, (message) => message.kind === "permission" && message.id === ask);
}

/**
 * Turns a live chat's agent events into notifications. Events are held until the render that applies them,
 * so the answer text and the permission's place in the chat are known. Restored chats replay nothing.
 */
export function useChatMoments(state: ThreadState, info: ChatInfo): { readonly heard: (event: AgentEvent) => void; readonly answered: (ask: number) => void } {
  const held = useRef<AgentEvent[]>([]);
  const asking = useRef(new Set<string>());
  const latest = useRef(info);
  latest.current = info;

  const settleAll = (): void => {
    for (const tag of asking.current) settle(tag);
    asking.current.clear();
  };

  useEffect(() => settleAll, []);

  useEffect(() => {
    const events = held.current.splice(0);
    const { id, live, project, agent, answer } = latest.current;
    if (!live) return;
    const chat: ChatRef = { id, title: title(state.messages), project };
    const open = { open: () => openChat(id) };
    for (const event of events) {
      switch (event.kind) {
        case "turnEnded":
          settleAll();
          if (!event.cancelled) void tell({ kind: "agentDone", chat, agent, answer: lastAnswer(state.messages) }, open);
          break;
        case "failed":
          settleAll();
          void tell({ kind: "agentStopped", chat, agent, reason: event.reason }, open);
          break;
        case "permission": {
          const index = askIndex(state.messages, event.id);
          const buttons = Object.fromEntries(askButtons(event.choices).map((choice) => [choice.id, () => answer(index, event.id, choice)]));
          asking.current.add(askTag(id, event.id));
          void tell({ kind: "agentNeedsYou", chat, agent, ask: event.id, tool: event.tool, input: event.input, choices: event.choices }, { ...open, buttons });
          break;
        }
        default:
          break;
      }
    }
  }, [state.messages]);

  return {
    heard: (event) => {
      if (event.kind === "turnEnded" || event.kind === "failed" || event.kind === "permission") held.current.push(event);
    },
    answered: (ask) => {
      const tag = askTag(latest.current.id, ask);
      asking.current.delete(tag);
      settle(tag);
    },
  };
}
