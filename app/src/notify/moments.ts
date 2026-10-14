import type { PermissionChoice } from "../agents/events";

export type ChatRef = { readonly id: string; readonly title: string; readonly project: string | null };

/** Something worth telling you about while you're in another app. */
export type Moment =
  | { readonly kind: "agentDone"; readonly chat: ChatRef; readonly agent: string; readonly answer: string }
  | { readonly kind: "agentNeedsYou"; readonly chat: ChatRef; readonly agent: string; readonly ask: number; readonly tool: string; readonly choices: readonly PermissionChoice[] }
  | { readonly kind: "agentStopped"; readonly chat: ChatRef; readonly agent: string; readonly reason: string }
  | { readonly kind: "opened"; readonly project: string; readonly name: string; readonly engine: string; readonly functions: number }
  | { readonly kind: "openFailed"; readonly name: string; readonly advice: string };

export type Note = {
  readonly tag: string;
  readonly title: string;
  readonly body: string;
  readonly actions: readonly { readonly id: string; readonly label: string }[];
};

/** Notification Center cuts long text anyway; stopping at a sentence reads better. */
const BODY_LIMIT = 160;

function firstLine(text: string): string {
  const lines = text.split("\n").filter((part) => !/^\s*(#|```)/.test(part));
  const line = lines.map((part) => part.replace(/^[>*\-\s]+/, "").trim()).find((part) => part.length > 0) ?? "";
  if (line.length <= BODY_LIMIT) return line;
  const cut = line.slice(0, BODY_LIMIT);
  const stop = cut.lastIndexOf(". ");
  return stop > BODY_LIMIT / 2 ? cut.slice(0, stop + 1) : `${cut.trimEnd()}…`;
}

function chatTitle(chat: ChatRef, agent: string): string {
  return chat.title.trim() || chat.project || agent;
}

export function askTag(chat: string, ask: number): string {
  return `ask:${chat}:${ask}`;
}

/** The two buttons a notification offers for a permission request: the first way to allow it and the first way to refuse. */
export function askButtons(choices: readonly PermissionChoice[]): readonly PermissionChoice[] {
  const allow = choices.find((choice) => choice.allows);
  const refuse = choices.find((choice) => !choice.allows);
  return [allow, refuse].filter((choice): choice is PermissionChoice => choice !== undefined);
}

function functionCount(n: number): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? "function" : "functions"}`;
}

export function noteFor(moment: Moment): Note {
  switch (moment.kind) {
    case "agentDone": {
      const answer = firstLine(moment.answer);
      return { tag: `done:${moment.chat.id}`, title: chatTitle(moment.chat, moment.agent), body: answer ? `${moment.agent}: ${answer}` : `${moment.agent} finished.`, actions: [] };
    }
    case "agentNeedsYou": {
      const where = moment.chat.project ? ` in ${moment.chat.project}` : "";
      return {
        tag: askTag(moment.chat.id, moment.ask),
        title: `${moment.agent} needs your OK`,
        body: `${moment.tool}${where}`,
        actions: askButtons(moment.choices).map((choice) => ({ id: choice.id, label: choice.label })),
      };
    }
    case "agentStopped":
      return { tag: `stopped:${moment.chat.id}`, title: `${moment.agent} stopped`, body: firstLine(moment.reason) || "Open the chat to see what happened.", actions: [] };
    case "opened":
      return { tag: `opened:${moment.project}`, title: `${moment.name} is ready`, body: `${moment.engine} finished reading ${functionCount(moment.functions)}.`, actions: [] };
    case "openFailed":
      return { tag: `openFailed:${moment.name}`, title: `Couldn't open ${moment.name}`, body: firstLine(moment.advice), actions: [] };
    default: {
      const unhandled: never = moment;
      return unhandled;
    }
  }
}
