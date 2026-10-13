import { stringField } from "../lib/guards";
import { reaToolName } from "./permissions";

const LABELS: Readonly<Record<string, readonly [label: string, arg?: string]>> = {
  procedure_pseudo_code: ["Read pseudocode", "procedure"],
  procedure_assembly: ["Read assembly", "procedure"],
  procedure_callers: ["Found who calls", "procedure"],
  procedure_callees: ["Found what it calls", "procedure"],
  procedure_info: ["Read function details", "procedure"],
  analyze_function: ["Studied a function", "procedure"],
  open_binary: ["Opened the file", "path"],
  binary_overview: ["Read the overview"],
  binary_session: ["Checked the session"],
  list_procedures: ["Listed functions"],
  list_strings: ["Listed strings"],
  list_segments: ["Listed segments"],
  search_strings: ["Searched strings", "pattern"],
  search_procedures: ["Searched functions", "pattern"],
  find_code_for_string: ["Found code using a string", "string"],
  xrefs: ["Found references", "address"],
  ToolSearch: ["Looked up its tools"],
};

export type ToolLabel = { readonly label: string; readonly detail: string | null };

function humanize(name: string): string {
  const label = name.replace(/^mcp__[^_]+__/, "").replace(/_/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function shortPath(value: string): string {
  return value.includes("/") ? (value.split("/").pop() ?? value) : value;
}

/** Splits a raw tool call into the bold label and the grey detail people read. */
export function toolLabel(tool: string, input: unknown): ToolLabel {
  const name = reaToolName(tool) ?? tool;
  const known = LABELS[name];
  if (!known) return { label: humanize(name), detail: null };
  const [label, key] = known;
  const value = key ? stringField(input, key) : undefined;
  return { label, detail: value ? shortPath(value) : null };
}

export function describe(tool: string, input: unknown): string {
  const { label, detail } = toolLabel(tool, input);
  return detail ? `${label} · ${detail}` : label;
}
