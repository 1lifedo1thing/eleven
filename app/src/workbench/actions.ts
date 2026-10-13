import type { EventPayload } from "@gpuix/react";

import { groups, type MenuAction, type MenuEntry, menuOn, type MenuSubmenu } from "../components/ContextMenu";
import { type Tool, zoneOf } from "./dockOrder";
import { copyText } from "../chat/useThread";
import { errorMessage } from "../lib/guards";
import type { CommandId } from "../keys/commands";
import { comboFor, comboText } from "../keys/keymaps";
import { currentSettings } from "../settings/store";
import { loadSkills, skillPrompt } from "../skills/load";
import { codeForString, containingFunction } from "./layout";
import { type BlockGroup, updateProject } from "../engine/project";
import { describeType, isCodeType, resolveType, type TypeChoice } from "../engine/codeTypes";
import { setValue, YOU } from "../engine/edits";
import { describeFormat, lastImmediate, type OperandFormat } from "../engine/operands";
import type { CodeMode, TabTarget } from "./model";
import type { Bench } from "./parts";
import { patchBytes } from "./patch";
import type { Subject } from "./subject";

type TypeCommand = Extract<CommandId, "markCode" | "markProcedure" | "markData" | "markString" | "markUndefined">;

type FormatCommand = Extract<CommandId, "showHex" | "showDecimal" | "showCharacter" | "showOffset" | "showAddress">;

export type KeyedCommand = Extract<CommandId, "rename" | "xrefs" | "comment" | "bookmark"> | TypeCommand | FormatCommand;

/** The shortcut a command has in the keymap you chose, as keycaps. */
export function hint(id: KeyedCommand): string {
  const settings = currentSettings();
  return comboText(comboFor(id, settings.keymap ?? "eleven", settings.shortcuts));
}

const SOON = "Coming soon";

export const BLOCK_COLORS: readonly { readonly name: string; readonly color: string }[] = [
  { name: "Red", color: "#e06c75" },
  { name: "Orange", color: "#d19a66" },
  { name: "Yellow", color: "#e5c07b" },
  { name: "Green", color: "#98c379" },
  { name: "Blue", color: "#61afef" },
  { name: "Purple", color: "#c678dd" },
];

function action(label: string, icon: string, run: () => void, keys = ""): MenuAction {
  return { kind: "action", label, icon, keys, run };
}

function later(label: string, keys = ""): MenuAction {
  return { kind: "action", label, keys, unavailable: SOON, run: () => {} };
}

function submenu(label: string, icon: string, items: readonly MenuEntry[]): MenuSubmenu {
  return { kind: "submenu", label, icon, items };
}

export function isFunction(b: Bench, addr: string): boolean {
  return b.program.functions.some((fn) => fn.addr === addr);
}

function arm64(b: Bench): boolean {
  return /arm64|aarch64/i.test(b.program.arch);
}

export function copy(b: Bench, text: string, what: string): void {
  copyText(text);
  b.wb.notify(`Copied ${what}`, null);
}

export function ask(b: Bench, text: string): void {
  b.wb.reveal("agent");
  b.chat.thread.send(text);
}

function run(b: Bench, work: () => Promise<void>): void {
  void (async (): Promise<void> => {
    try {
      await work();
    } catch (err) {
      b.wb.notify(`Couldn't do that. ${errorMessage(err)}`, null);
    }
  })();
}

/** Shows any address: a function opens, anything else opens its function's assembly with that line picked. */
export function goTo(b: Bench, addr: string, view: CodeMode = "asm"): void {
  if (isFunction(b, addr)) {
    b.wb.show(addr, view === "asm" ? "pseudo" : view);
    return;
  }
  run(b, async () => {
    const fn = await containingFunction(b.program.path, addr);
    if (!fn) {
      b.wb.show(addr, "hex");
      return;
    }
    b.wb.show(fn, view);
    b.wb.select({ kind: "line", fn, view: "asm", number: -1, text: "", addr, token: null });
  });
}

export function startRename(b: Bench, addr: string): void {
  b.wb.patch({ renaming: addr, renameDraft: b.nameOf(addr) });
}

export function startComment(b: Bench, addr: string): void {
  b.wb.patch({ commenting: addr, commentDraft: b.wb.s.comments.get(addr) ?? "" });
}

export function showReferences(b: Bench, addr: string): void {
  b.wb.reveal("refs");
  b.wb.patch({ refsOf: isFunction(b, addr) && addr === b.focusAddr ? null : addr });
}

export function showCallers(b: Bench, fn: string): void {
  if (fn !== b.focusAddr) b.openFn(fn, false);
  b.wb.reveal("refs");
  b.wb.patch({ refsOf: null });
}

export function toggleBookmark(b: Bench, addr: string): void {
  const had = b.wb.s.bookmarks.some((mark) => mark.addr === addr);
  const mark = { addr, label: b.nameOf(addr) };
  b.wb.toggleBookmark(mark);
  b.wb.notify(had ? `Removed the bookmark on ${mark.label}` : `Bookmarked ${mark.label}`, () => b.wb.toggleBookmark(mark));
}

function explain(b: Bench, addr: string): void {
  const skill = loadSkills().find((s) => s.name === "explain-function");
  const name = b.nameOf(addr);
  ask(b, skill ? skillPrompt(skill, `${name} at ${addr}`) : `Explain what ${name} at ${addr} does, in plain terms.`);
}

function targetOf(b: Bench, subject: Subject): TabTarget | null {
  switch (subject.kind) {
    case "function":
      return { kind: "fn", addr: subject.addr };
    case "tab": {
      const tab = b.wb.s.panes[subject.pane]?.tabs[subject.index];
      if (!tab) return null;
      switch (tab.kind) {
        case "fn":
          return { kind: "fn", addr: tab.addr };
        case "thread":
          return { kind: "thread", thread: tab.thread };
        case "list":
          return { kind: "list", list: tab.list };
        case "shader":
          return { kind: "shader", library: tab.library, name: tab.name };
        case "model":
          return { kind: "model", name: tab.name };
        case "profile":
          return { kind: "profile", title: tab.title };
        case "diff":
          return { kind: "diff" };
        case "debug":
          return { kind: "debug" };
        case "listing":
          return { kind: "listing" };
        case "source":
          return { kind: "source", file: tab.file };
        case "tool":
          return null;
        default: {
          const unhandled: never = tab;
          return unhandled;
        }
      }
    }
    default:
      return null;
  }
}

function viewMenu(b: Bench, addr: string): MenuSubmenu {
  return submenu("Open as", "pseudocode", [
    action("Pseudocode", "pseudocode", () => b.wb.show(addr, "pseudo")),
    action("Assembly", "assembly", () => b.wb.show(addr, "asm")),
    action("Graph", "graph", () => b.wb.show(addr, "graph")),
    action("Hex", "hex", () => b.wb.show(addr, "hex")),
  ]);
}

const TYPES: readonly { readonly choice: TypeChoice; readonly label: string; readonly command: TypeCommand }[] = [
  { choice: "code", label: "Code", command: "markCode" },
  { choice: "procedure", label: "Procedure", command: "markProcedure" },
  { choice: "data", label: "Data", command: "markData" },
  { choice: "cstring", label: "C string", command: "markString" },
  { choice: "undefined", label: "Undefined", command: "markUndefined" },
];

const FORMATS: readonly { readonly format: OperandFormat; readonly label: string; readonly command: FormatCommand }[] = [
  { format: "hex", label: "Hexadecimal", command: "showHex" },
  { format: "decimal", label: "Decimal", command: "showDecimal" },
  { format: "char", label: "Character", command: "showCharacter" },
  { format: "offset", label: "Offset", command: "showOffset" },
  { format: "address", label: "Address", command: "showAddress" },
];

/** Marks the bytes at an address as code, a function, data, a string or undefined; Ghidra re-reads them once the project changes. */
export function setType(b: Bench, addr: string, choice: TypeChoice): void {
  const before = b.wb.s.types.get(addr) ?? null;
  const next = resolveType(choice, before);
  if (next === before) {
    b.wb.notify(`${addr} is already ${describeType(next)}`, null);
    return;
  }
  const restore = isCodeType(before) ? before : null;
  updateProject(b.program.id, (project) => setValue(project, "types", addr, next), YOU);
  b.wb.notify(`Marked ${addr} as ${describeType(next)}`, () => updateProject(b.program.id, (project) => setValue(project, "types", addr, restore), YOU));
}

/** Shows the number in the instruction at an address as hex, decimal, a character, an offset or an address. */
export function setFormat(b: Bench, addr: string, format: OperandFormat): void {
  const before = b.wb.s.formats.get(addr) ?? null;
  if (before === format) return;
  updateProject(b.program.id, (project) => setValue(project, "formats", addr, format), YOU);
  b.wb.notify(`Showing the number at ${addr} as ${describeFormat(format)}`, () => updateProject(b.program.id, (project) => setValue(project, "formats", addr, before), YOU));
}

/** Hopper's Modify menu: what the bytes at a line are, and how its number reads. */
function changeMenu(b: Bench, addr: string, line: string): MenuSubmenu {
  const typed = b.wb.s.types.get(addr);
  const shown = b.wb.s.formats.get(addr);
  const noTypes = b.program.retype ? null : "Not with this engine";
  const noNumber = lastImmediate(line) ? null : "No number here";
  return submenu("Change type", "tag", [
    ...TYPES.map((t): MenuAction => ({ ...action(t.label, typed === t.choice || (t.choice === "data" && /word|byte/.test(typed ?? "")) ? "check" : "tag", () => setType(b, addr, t.choice), hint(t.command)), unavailable: noTypes })),
    { kind: "separator" },
    ...FORMATS.map((f): MenuAction => ({ ...action(f.label, shown === f.format ? "check" : "hex", () => setFormat(b, addr, f.format), hint(f.command)), unavailable: noNumber })),
  ]);
}

function functionGroups(b: Bench, addr: string): readonly (readonly MenuEntry[])[] {
  const name = b.nameOf(addr);
  const marked = b.wb.s.bookmarks.some((mark) => mark.addr === addr);
  return [
    [
      action(`Open ${name}`, "function", () => b.openFn(addr, false)),
      action("Open in split", "split", () => b.wb.openSplit({ kind: "fn", addr })),
      viewMenu(b, addr),
    ],
    [
      action(`References to ${name}`, "references", () => showReferences(b, addr), hint("xrefs")),
      action("Callers and callees", "graph", () => showCallers(b, addr)),
    ],
    [
      action(`Rename ${name}`, "rename", () => startRename(b, addr), hint("rename")),
      action(marked ? "Remove bookmark" : "Bookmark", "bookmark", () => toggleBookmark(b, addr), hint("bookmark")),
      action("Write a note", "note", () => {
        if (addr !== b.focusAddr) b.openFn(addr, false);
        b.wb.reveal("inspector");
      }, hint("comment")),
      later("Edit signature", "Y"),
    ],
    [
      submenu("Copy", "copy", [
        action("Name", "copy", () => copy(b, name, name)),
        action("Address", "copy", () => copy(b, addr, addr)),
        action("Pseudocode", "pseudocode", () => run(b, async () => copy(b, await b.program.code(addr, "pseudo"), `the pseudocode of ${name}`))),
        action("Assembly", "assembly", () => run(b, async () => copy(b, await b.program.code(addr, "asm"), `the assembly of ${name}`))),
      ]),
    ],
    [
      action(`Explain ${name}`, "spark", () => explain(b, addr)),
      action("Suggest a better name", "spark", () => ask(b, `Read ${name} at ${addr} and suggest a clear, specific name for it. If you're confident, rename it with the eleven rename_function tool.`)),
    ],
  ];
}

function lineGroups(b: Bench, subject: Extract<Subject, { readonly kind: "line" }>): readonly (readonly MenuEntry[])[] {
  const { token } = subject;
  const target = token?.addr ?? null;
  const fnTarget = target && isFunction(b, target) ? target : null;
  const here = subject.addr;
  const commented = here ? b.wb.s.comments.has(here) : false;
  const marked = here ? b.wb.s.bookmarks.some((mark) => mark.addr === here) : false;
  const word = token ? (fnTarget ? b.nameOf(fnTarget) : token.text) : null;
  const go: MenuEntry[] = [];
  if (fnTarget) {
    go.push(action(`Jump to ${b.nameOf(fnTarget)}`, "forward", () => b.openFn(fnTarget, false)));
    go.push(action("Open in split", "split", () => b.wb.openSplit({ kind: "fn", addr: fnTarget })));
  } else if (target) {
    go.push(action(`Go to ${target}`, "forward", () => goTo(b, target)));
    go.push(action("Show in hex", "hex", () => b.wb.show(target, "hex")));
  }
  if (here) go.push(action("Show this line in hex", "hex", () => b.wb.show(here, "hex")));
  const refsTo = target ?? here;
  const refs: MenuEntry[] = [
    ...(refsTo ? [action(`References to ${word ?? refsTo}`, "references", () => showReferences(b, refsTo), hint("xrefs"))] : []),
    action(`Callers of ${b.nameOf(subject.fn)}`, "graph", () => showCallers(b, subject.fn)),
  ];
  const edit: MenuEntry[] = [
    ...(target ? [action(`Rename ${word ?? target}`, "rename", () => startRename(b, target), hint("rename"))] : []),
    here
      ? action(commented ? "Edit comment" : "Comment this line", "note", () => startComment(b, here), hint("comment"))
      : action(`Write a note on ${b.nameOf(subject.fn)}`, "note", () => b.wb.reveal("inspector"), hint("comment")),
    ...(here ? [action(marked ? "Remove bookmark" : "Bookmark this line", "bookmark", () => toggleBookmark(b, here), hint("bookmark"))] : []),
  ];
  const patch: MenuEntry[] = here
    ? [
        submenu("Patch", "bolt", [
          action("Change bytes", "hex", () => b.wb.patch({ patching: here, patchDraft: "" })),
          arm64(b)
            ? action("Replace with NOP", "bolt", () => run(b, async () => b.wb.notify(`Wrote a patched copy to ${await patchBytes(b.program, [{ addr: here, bytes: "1f2003d5" }])}`, null)))
            : later("Replace with NOP"),
          later("Assemble instruction"),
        ]),
        changeMenu(b, here, subject.text),
      ]
    : [];
  const copies: MenuEntry[] = [
    submenu("Copy", "copy", [
      action("Line", "copy", () => copy(b, subject.text.trim(), "the line")),
      ...(word ? [action(`"${word}"`, "copy", () => copy(b, word, word))] : []),
      ...(here ? [action("Address", "copy", () => copy(b, here, here))] : []),
      action("Function name", "copy", () => copy(b, b.nameOf(subject.fn), b.nameOf(subject.fn))),
    ]),
  ];
  const agent: MenuEntry[] = [
    action("Explain this line", "spark", () => ask(b, `In ${b.nameOf(subject.fn)} (${subject.fn}), explain this ${subject.view === "asm" ? "instruction" : "line"} in plain terms:\n${subject.text.trim()}`)),
    ...(word ? [action(`Where does ${word} come from?`, "spark", () => ask(b, `In ${b.nameOf(subject.fn)} (${subject.fn}), trace where ${word} comes from and what it holds.`))] : []),
  ];
  return [go, refs, edit, patch, copies, agent];
}

/** Folds the picked blocks (and any groups among them) into one graph node, then asks for its name. */
export function groupBlocks(b: Bench, fn: string, starts: readonly string[]): void {
  const before = b.wb.s.groups;
  const touched = before.filter((g) => g.fn === fn && g.blocks.some((block) => starts.includes(block)));
  const blocks = [...new Set([...starts, ...touched.flatMap((g) => g.blocks)])];
  if (blocks.length < 2) return;
  const first = [...blocks].sort((x, y) => (BigInt(x) < BigInt(y) ? -1 : 1))[0] ?? blocks[0] ?? "";
  const label = `${blocks.length} blocks`;
  b.wb.patch({ groups: [...before.filter((g) => !touched.includes(g)), { fn, blocks, label }], blockPicks: [], labelling: { fn, start: first }, labelDraft: label });
  b.wb.notify(`Grouped ${blocks.length} blocks`, () => b.wb.patch({ groups: before }));
}

function groupAt(b: Bench, fn: string, start: string): BlockGroup | null {
  return b.wb.s.groups.find((g) => g.fn === fn && g.blocks.includes(start)) ?? null;
}

function blockGroups(b: Bench, subject: Extract<Subject, { readonly kind: "block" }>): readonly (readonly MenuEntry[])[] {
  const { start, end, fn } = subject;
  const group = groupAt(b, fn, start);
  const picks = b.wb.s.blockPicks;
  const gathering = picks.includes(start) ? picks : [...picks, start];
  const grouping: MenuEntry[] = [
    ...(gathering.length > 1 ? [action(`Group ${gathering.length} blocks`, "graph", () => groupBlocks(b, fn, gathering))] : [action("Pick for a group", "graph", () => b.wb.patch({ blockPicks: gathering }))]),
    ...(group ? [
      action("Rename group", "rename", () => b.wb.patch({ labelling: { fn, start }, labelDraft: group.label })),
      action("Ungroup", "graph", () => {
        const before = b.wb.s.groups;
        b.wb.patch({ groups: before.filter((g) => g !== group) });
        b.wb.notify(`Ungrouped ${group.label}`, () => b.wb.patch({ groups: before }));
      }),
    ] : []),
  ];
  const colored = b.wb.s.colors.has(start);
  const blockText = async (): Promise<string> => {
    const lines = (await b.program.code(fn, "asm")).split("\n");
    return lines.filter((line) => {
      const at = /^(0x[0-9a-f]+):/i.exec(line)?.[1];
      return at !== undefined && BigInt(at) >= BigInt(start) && BigInt(at) < BigInt(end);
    }).join("\n");
  };
  return [
    [
      action("Show in assembly", "assembly", () => goTo(b, start)),
      action("Show in hex", "hex", () => b.wb.show(start, "hex")),
    ],
    [
      action(`References to ${start}`, "references", () => showReferences(b, start), hint("xrefs")),
      action("Comment this block", "note", () => startComment(b, start), hint("comment")),
      submenu("Color", "circle", [
        ...BLOCK_COLORS.map((c) => action(c.name, "circle-on", () => {
          const before = b.wb.s.colors.get(start) ?? "";
          b.wb.setColor(start, c.color);
          b.wb.notify(`Colored the block at ${start} ${c.name.toLowerCase()}`, () => b.wb.setColor(start, before));
        })),
        ...(colored ? [{ kind: "separator" } as const, action("No color", "circle", () => b.wb.setColor(start, ""))] : []),
      ]),
    ],
    [
      submenu("Copy", "copy", [
        action("Block", "copy", () => run(b, async () => copy(b, await blockText(), "the block"))),
        action("Start address", "copy", () => copy(b, start, start)),
      ]),
    ],
    grouping,
    [action("What does this block decide?", "spark", () => run(b, async () => ask(b, `In ${b.nameOf(fn)} (${fn}), what does the basic block at ${start} decide, and when is each branch taken?\n${await blockText()}`)))],
  ];
}

function hex(bytes: readonly number[]): string {
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join(" ");
}

function readAs(bytes: readonly number[]): readonly MenuEntry[] {
  const view = new DataView(Uint8Array.from(bytes).buffer);
  const reads: { readonly label: string; readonly size: number; readonly read: () => string }[] = [
    { label: "UInt8", size: 1, read: () => String(view.getUint8(0)) },
    { label: "Int16", size: 2, read: () => String(view.getInt16(0, true)) },
    { label: "UInt32", size: 4, read: () => String(view.getUint32(0, true)) },
    { label: "Int32", size: 4, read: () => String(view.getInt32(0, true)) },
    { label: "UInt64", size: 8, read: () => view.getBigUint64(0, true).toString() },
    { label: "Pointer", size: 8, read: () => `0x${view.getBigUint64(0, true).toString(16)}` },
    { label: "Float", size: 4, read: () => String(view.getFloat32(0, true)) },
    { label: "Double", size: 8, read: () => String(view.getFloat64(0, true)) },
    { label: "Text", size: 1, read: () => JSON.stringify(String.fromCharCode(...bytes.filter((byte) => byte >= 0x20 && byte < 0x7f))) },
  ];
  return reads.filter((r) => bytes.length >= r.size).map((r) => {
    const value = r.read();
    return { kind: "action", label: r.label, keys: value, run: () => copyText(value) };
  });
}

function bytesGroups(b: Bench, subject: Extract<Subject, { readonly kind: "bytes" }>): readonly (readonly MenuEntry[])[] {
  const { addr, bytes } = subject;
  const count = `${bytes.length} ${bytes.length === 1 ? "byte" : "bytes"}`;
  return [
    [
      action("Show in assembly", "assembly", () => goTo(b, addr)),
      action(`References to ${addr}`, "references", () => showReferences(b, addr), hint("xrefs")),
    ],
    bytes.length === 0 ? [] : [
      submenu("Copy", "copy", [
        action("Hex", "copy", () => copy(b, hex(bytes), count)),
        action("C array", "copy", () => copy(b, `{ ${bytes.map((byte) => `0x${byte.toString(16).padStart(2, "0")}`).join(", ")} }`, `${count} as a C array`)),
        action("Swift array", "copy", () => copy(b, `[${bytes.map((byte) => `0x${byte.toString(16).padStart(2, "0")}`).join(", ")}]`, `${count} as a Swift array`)),
        action("Python bytes", "copy", () => copy(b, `b"${bytes.map((byte) => `\\x${byte.toString(16).padStart(2, "0")}`).join("")}"`, `${count} as Python bytes`)),
        action("Address", "copy", () => copy(b, addr, addr)),
      ]),
      submenu("Read as", "hex", readAs(bytes)),
    ],
    [
      changeMenu(b, addr, ""),
      action("Change these bytes", "bolt", () => b.wb.patch({ patching: addr, patchDraft: hex(bytes) })),
      action(b.wb.s.bookmarks.some((mark) => mark.addr === addr) ? "Remove bookmark" : "Bookmark", "bookmark", () => toggleBookmark(b, addr), hint("bookmark")),
      action("Comment", "note", () => startComment(b, addr), hint("comment")),
    ],
    [action("What is this data?", "spark", () => ask(b, `What is the data at ${addr} (${hex(bytes)})? Say what reads it and what it means.`))],
  ];
}

function stringGroups(b: Bench, subject: Extract<Subject, { readonly kind: "string" }>): readonly (readonly MenuEntry[])[] {
  const { addr, value } = subject;
  return [
    [
      action("Show where it's used", "forward", () => run(b, async () => {
        const fn = await codeForString(b.program.path, addr);
        if (fn) b.openFn(fn, false);
        else b.wb.notify("Nothing in the code refers to this string directly.", null);
      })),
      action("References", "references", () => showReferences(b, addr), hint("xrefs")),
      action("Show in hex", "hex", () => b.wb.show(addr, "hex")),
    ],
    [
      submenu("Copy", "copy", [
        action("String", "copy", () => copy(b, value, "the string")),
        action("Address", "copy", () => copy(b, addr, addr)),
      ]),
      action(b.wb.s.bookmarks.some((mark) => mark.addr === addr) ? "Remove bookmark" : "Bookmark", "bookmark", () => toggleBookmark(b, addr), hint("bookmark")),
    ],
    [action("How is this string used?", "spark", () => ask(b, `Where and how is the string ${JSON.stringify(value)} at ${addr} used? Follow it into the code.`))],
  ];
}

function importGroups(b: Bench, subject: Extract<Subject, { readonly kind: "import" }>): readonly (readonly MenuEntry[])[] {
  const stub = b.addrOf(subject.symbol) ?? b.addrOf(`_${subject.symbol}`);
  return [
    stub ? [action(`Open the ${subject.symbol} stub`, "function", () => b.openFn(stub, false)), action("Callers", "references", () => showCallers(b, stub))] : [],
    [
      submenu("Copy", "copy", [
        action("Symbol", "copy", () => copy(b, subject.symbol, subject.symbol)),
        action("Library", "copy", () => copy(b, subject.library, subject.library)),
      ]),
    ],
    [action(`What is ${subject.symbol} used for here?`, "spark", () => ask(b, `What does this program use ${subject.symbol} from ${subject.library} for? Find the callers and explain.`))],
  ];
}

function segmentGroups(b: Bench, subject: Extract<Subject, { readonly kind: "segment" }>): readonly (readonly MenuEntry[])[] {
  const start = subject.range.split(" ")[0] ?? "";
  return [
    start ? [action("Show the start in hex", "hex", () => b.wb.show(start, "hex"))] : [],
    [
      submenu("Copy", "copy", [
        action("Name", "copy", () => copy(b, subject.name, subject.name)),
        action("Range", "copy", () => copy(b, subject.range, "the range")),
      ]),
    ],
    [action(`What's in ${subject.name}?`, "spark", () => ask(b, `What does the ${subject.name} segment (${subject.range}) hold in this file?`))],
  ];
}

/** Where a tool can go from where it is: either dock, or an editor tab. */
export function toolMenu(b: Bench, tool: Tool): readonly MenuEntry[] {
  const zone = zoneOf(b.wb.s.docks, tool);
  return [
    ...(zone !== "right" ? [action("Move to the right panel", "forward", () => b.wb.moveTool(tool, "right"))] : []),
    ...(zone !== "bottom" ? [action("Move to the bottom panel", "arrow-down", () => b.wb.moveTool(tool, "bottom"))] : []),
    ...(zone !== null ? [action("Open as an editor tab", "open-tab", () => b.wb.moveTool(tool, null))] : []),
  ];
}

function tabGroups(b: Bench, subject: Extract<Subject, { readonly kind: "tab" }>): readonly (readonly MenuEntry[])[] {
  const { pane, index } = subject;
  const tabs = b.wb.s.panes[pane]?.tabs ?? [];
  const tab = tabs[index];
  const target = targetOf(b, subject);
  const panes = b.wb.s.panes.length;
  return [
    [
      action("Close", "close", () => b.wb.closeTab(pane, index)),
      ...(tab?.kind === "tool" ? toolMenu(b, tab.tool) : []),
      ...(tabs.length > 1 ? [action("Close other tabs", "close", () => b.wb.closeOthers(pane, index))] : []),
      ...(index < tabs.length - 1 ? [action("Close tabs to the right", "close", () => b.wb.closeRight(pane, index))] : []),
    ],
    [
      ...(tab?.preview ? [action("Keep open", "open-tab", () => b.wb.selectTab(pane, index))] : []),
      ...(target && panes === 1 ? [action("Open in split", "split", () => b.wb.openSplit(target))] : []),
      ...(pane > 0 ? [action("Move to the left pane", "back", () => b.wb.moveTab(pane, index, -1))] : []),
      ...(pane < panes - 1 ? [action("Move to the right pane", "forward", () => b.wb.moveTab(pane, index, 1))] : []),
      ...(pane === panes - 1 && tabs.length > 1 ? [action("Move to a new pane", "split", () => b.wb.moveTab(pane, index, 1))] : []),
    ],
    [
      action("Split right", "split", () => b.wb.split(pane)),
      action("Split down", "split", () => b.wb.split(pane, "bottom")),
      ...(panes > 1 ? [action("Close this split", "close", () => b.wb.closePane(pane)), action("Make splits equal", "split", b.wb.equalizePanes)] : []),
    ],
    tab?.kind === "fn" ? [action("Copy name", "copy", () => copy(b, b.nameOf(tab.addr), b.nameOf(tab.addr))), action("Copy address", "copy", () => copy(b, tab.addr, tab.addr))] : [],
  ];
}

/** Everything that applies to a subject, in groups; the menu and the keys both come from here. */
export function menuGroups(b: Bench, subject: Subject): readonly (readonly MenuEntry[])[] {
  switch (subject.kind) {
    case "function":
      return functionGroups(b, subject.addr);
    case "line":
      return lineGroups(b, subject);
    case "block":
      return blockGroups(b, subject);
    case "bytes":
      return bytesGroups(b, subject);
    case "string":
      return stringGroups(b, subject);
    case "import":
      return importGroups(b, subject);
    case "segment":
      return segmentGroups(b, subject);
    case "tab":
      return tabGroups(b, subject);
    default: {
      const unhandled: never = subject;
      return unhandled;
    }
  }
}

function selectable(subject: Subject): boolean {
  return subject.kind === "line" || subject.kind === "block" || subject.kind === "bytes";
}

/** Handlers for anything that has a menu: right-click picks it and shows what can be done with it. */
export function subjectMenu(b: Bench, subject: Subject, onClick?: (event: EventPayload) => void): ReturnType<typeof menuOn> {
  return menuOn(() => {
    if (selectable(subject)) b.wb.select(subject);
    return groups(...menuGroups(b, subject));
  }, onClick);
}

function flat(entries: readonly MenuEntry[]): readonly MenuAction[] {
  return entries.flatMap((entry) => (entry.kind === "action" ? [entry] : entry.kind === "submenu" ? flat(entry.items) : []));
}

/** Runs a keymap command on what you last clicked, or on the open function: N renames the word under it, X lists its references. */
export function runCommand(b: Bench, id: KeyedCommand): void {
  const keys = hint(id);
  const picked = b.wb.s.selected;
  const current = picked && "fn" in picked && picked.fn === b.focusAddr;
  const subject: Subject = current ? picked : { kind: "function", addr: b.focusAddr };
  const hit = keys ? flat(menuGroups(b, subject).flat()).find((entry) => entry.keys === keys && !entry.unavailable) : undefined;
  hit?.run();
}
