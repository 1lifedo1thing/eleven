import { basename } from "node:path";

import { bundleExecutable } from "../gpu/live";
import { describeFindings, listRuns, readGpuRun } from "../gpu/trace";
import type { Chat } from "../chat/useChat";
import { loadProcedures, type Procedure } from "../engine/procedures";
import { type Author, describeEdit, type EditField, setValue } from "../engine/edits";
import { pending, propose } from "../engine/history";
import { loadProject, type Project, projectId, updateProject } from "../engine/project";
import { loadSettings } from "../settings/store";
import { CODE_TYPES, describeType, isCodeType } from "../engine/codeTypes";
import { describeFormat, isOperandFormat, OPERAND_FORMATS } from "../engine/operands";
import { parseBytes } from "../workbench/patch";
import type { BridgeCaller, BridgeTool } from "./protocol";
import { currentView, switchView, type ViewName } from "./view";

const VIEWS: readonly ViewName[] = ["pseudocode", "assembly", "graph", "hex"];

function find(procedures: readonly Procedure[], project: Project, wanted: string): Procedure {
  const key = wanted.trim().toLowerCase();
  const hit = procedures.find((p) => p.address.toLowerCase() === key || p.name.toLowerCase() === key || project.names.get(p.address)?.toLowerCase() === key);
  if (!hit) throw new Error(`There is no function called ${wanted} in this file.`);
  return hit;
}

function marks(project: Project, procedures: readonly Procedure[]): string {
  const nameOf = (addr: string): string => project.names.get(addr) ?? procedures.find((p) => p.address === addr)?.name ?? addr;
  const lines = [
    ...[...project.names].map(([addr, name]) => `renamed ${addr} to ${name}`),
    ...project.bookmarks.map((b) => `bookmarked ${nameOf(b.addr)} (${b.addr})`),
    ...[...project.notes].map(([addr, note]) => `note on ${nameOf(addr)}: ${note}`),
    ...[...project.comments].map(([addr, comment]) => `comment at ${addr}: ${comment}`),
    ...[...project.types].map(([addr, type]) => `marked ${addr} as ${describeType(type)}`),
    ...[...project.formats].map(([addr, format]) => `number at ${addr} shown as ${describeFormat(format)}`),
    ...pending(project).map((edit) => `waiting for the user's review: ${describeEdit(edit, nameOf, (addr) => procedures.find((p) => p.address === addr)?.name ?? addr)}`),
  ];
  return lines.length > 0 ? lines.join("\n") : "Nothing renamed, bookmarked, noted or commented yet.";
}

function hexAddress(value: string | undefined): string {
  const address = (value ?? "").trim().toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(address)) throw new Error("Give a hexadecimal address, like 0x100003f2c.");
  return address;
}

/** Applies an agent's edit under its name, or files it for review when the user asked to see every edit first. */
function agentEdit(id: string, by: Author, field: EditField, key: string, value: string | null, done: string): string {
  if (!loadSettings().reviewAgentEdits) {
    updateProject(id, (project) => setValue(project, field, key, value), by);
    return done;
  }
  propose(id, field, key, value, by);
  return `Suggested to the user, who reviews it in Changes before it is saved: ${done}`;
}

/** Answers the `eleven` MCP tools against the live window and the open file's project. */
export function bridgeHandler(chat: () => Chat): (tool: BridgeTool, args: Readonly<Record<string, string>>, from: BridgeCaller) => Promise<string> {
  return async (tool, args, from) => {
    const by: Author = { kind: "agent", agent: from.agent, chat: from.chat };
    const target = chat().target;
    if (!target) throw new Error("No file is open in Eleven. Ask the user to open one.");
    const id = projectId(target);
    const procedures = await loadProcedures(target.path, id);
    switch (tool) {
      case "open_function": {
        const fn = find(procedures, loadProject(id), args.function ?? "");
        chat().thread.openFunction(fn.name);
        return `Showing ${fn.name} (${fn.address}) to the user.`;
      }
      case "current_view": {
        const view = currentView();
        return JSON.stringify({ file: target.original, function: view.fn, address: view.address, view: view.view });
      }
      case "set_view": {
        const view = VIEWS.find((v) => v === args.view);
        if (!view) throw new Error("Pick pseudocode, assembly, graph or hex.");
        return switchView(view) ? `Switched to ${view}.` : "The workbench isn't open, so the user is reading pseudocode on the canvas.";
      }
      case "rename_function": {
        const fn = find(procedures, loadProject(id), args.function ?? "");
        const name = (args.new_name ?? "").trim();
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error("Use a C identifier, like check_license_key.");
        return agentEdit(id, by, "names", fn.address, name, `Renamed ${fn.name} to ${name} in the user's project.`);
      }
      case "add_note": {
        const fn = find(procedures, loadProject(id), args.function ?? "");
        const note = (args.note ?? "").trim();
        return agentEdit(id, by, "notes", fn.address, note || null, note ? `Saved a note on ${fn.name}.` : `Removed the note on ${fn.name}.`);
      }
      case "add_comment": {
        const address = hexAddress(args.address);
        const comment = (args.comment ?? "").trim();
        return agentEdit(id, by, "comments", address, comment || null, comment ? `Commented ${address}.` : `Removed the comment at ${address}.`);
      }
      case "bookmark": {
        const wanted = (args.address ?? "").trim();
        const address = /^0x[0-9a-f]+$/i.test(wanted) ? wanted.toLowerCase() : find(procedures, loadProject(id), wanted).address;
        const label = (args.label ?? "").trim() || address;
        return agentEdit(id, by, "bookmarks", address, label, `Bookmarked ${label} (${address}).`);
      }
      case "set_code_type": {
        const address = hexAddress(args.address);
        const type = (args.type ?? "").trim().toLowerCase();
        if (type && !isCodeType(type)) throw new Error(`Pick one of ${CODE_TYPES.join(", ")}, or leave it empty.`);
        return agentEdit(id, by, "types", address, type || null, type ? `Marked ${address} as ${describeType(type)}.` : `Put ${address} back to code.`);
      }
      case "set_number_format": {
        const address = hexAddress(args.address);
        const format = (args.format ?? "").trim().toLowerCase();
        if (format && !isOperandFormat(format)) throw new Error(`Pick one of ${OPERAND_FORMATS.join(", ")}, or leave it empty.`);
        return agentEdit(id, by, "formats", address, format || null, format ? `Showing the number at ${address} as ${describeFormat(format)}.` : `Showing the number at ${address} as Ghidra prints it.`);
      }
      case "propose_patch": {
        const address = hexAddress(args.address);
        const bytes = parseBytes(args.bytes ?? "").map((byte) => byte.toString(16).padStart(2, "0")).join(" ");
        propose(id, "patches", address, bytes, by, (args.reason ?? "").trim() || undefined);
        return `Suggested patching ${address} to ${bytes}. The user reviews it in Changes; nothing is saved until they accept, and the binary itself is never changed.`;
      }
      case "list_marks":
        return marks(loadProject(id), procedures);
      case "gpu_profile": {
        const exe = target.kind === "app" ? bundleExecutable(target.original) : null;
        const trace = exe ? listRuns(basename(exe))[0] : undefined;
        if (!trace) return "There's no GPU recording of this app yet. Ask the user to press Record a GPU run in the workbench sidebar.";
        return describeFindings((await readGpuRun(trace, "")).findings);
      }
      default: {
        const unhandled: never = tool;
        return unhandled;
      }
    }
  };
}
