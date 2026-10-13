import type { MetaEntry, ModelInfo, ModelPage, ModelTensor } from "../types";
import { bytes, count } from "./read";

export type ModelFact = { readonly label: string; readonly value: string; readonly sub: string };

export type NoteTone = "warn" | "ok" | "plain";

export type ModelNote = { readonly title: string; readonly body: string; readonly quote: string | null; readonly page: ModelPage | null; readonly tone: NoteTone };

export type TensorGroup = { readonly key: string; readonly label: string; readonly tensors: readonly ModelTensor[] };

export type MetaGroup = { readonly title: string; readonly entries: readonly MetaEntry[] };

const BLOCK = /^((?:blk|model\.layers|layers|blocks|transformer\.h|h|model\.decoder\.layers|encoder\.layer)\.(\d+))\./;

export function pagesOf(model: ModelInfo): readonly ModelPage[] {
  return [
    "overview",
    ...(model.tensors.length > 0 ? ["tensors" as const] : []),
    ...(model.nodes.length > 0 ? ["nodes" as const] : []),
    ...(model.metadata.length > 0 ? ["metadata" as const] : []),
    ...(model.template ? ["template" as const] : []),
    ...(model.loads.length > 0 ? ["loads" as const] : []),
  ];
}

export function pageLabel(page: ModelPage): string {
  switch (page) {
    case "overview":
      return "Overview";
    case "tensors":
      return "Tensors";
    case "nodes":
      return "Operators";
    case "metadata":
      return "Metadata";
    case "template":
      return "Chat template";
    case "loads":
      return "What it loads";
    default: {
      const unhandled: never = page;
      return unhandled;
    }
  }
}

export function pageIcon(page: ModelPage): string {
  switch (page) {
    case "overview":
      return "info";
    case "tensors":
      return "segments";
    case "nodes":
      return "graph";
    case "metadata":
      return "tag";
    case "template":
      return "thread";
    case "loads":
      return "library";
    default: {
      const unhandled: never = page;
      return unhandled;
    }
  }
}

/** How many entries a page lists, for the sidebar; empty for pages that aren't lists. */
export function pageCount(model: ModelInfo, page: ModelPage): string {
  switch (page) {
    case "tensors":
      return model.tensors.length.toLocaleString("en-US");
    case "nodes":
      return model.nodes.length.toLocaleString("en-US");
    case "metadata":
      return model.metadata.length.toLocaleString("en-US");
    case "loads":
      return model.loads.length.toLocaleString("en-US");
    case "overview":
    case "template":
      return "";
    default: {
      const unhandled: never = page;
      return unhandled;
    }
  }
}

function lookup(model: ModelInfo): (key: string) => string | null {
  const map = new Map(model.metadata.map((entry) => [entry.key, entry.value]));
  return (key) => map.get(key) ?? null;
}

function grouped(n: string | null): string | null {
  if (n === null) return null;
  const value = Number(n);
  return Number.isFinite(value) ? value.toLocaleString("en-US") : n;
}

function listLength(value: string | null): string | null {
  const match = value ? /^([\d,]+) items/.exec(value) : null;
  return match?.[1] ?? null;
}

function joined(parts: readonly (string | null | false)[], by: string): string {
  return parts.filter((part): part is string => typeof part === "string" && part.length > 0).join(by);
}

function parameters(tensors: readonly ModelTensor[]): number {
  return tensors.reduce((sum, t) => sum + (t.shape ? t.shape.split(" × ").reduce((n, d) => n * Number(d), 1) : 1), 0);
}

function ggufFacts(model: ModelInfo): readonly ModelFact[] {
  const get = lookup(model);
  const arch = get("general.architecture") ?? "unknown";
  const at = (key: string): string | null => get(`${arch}.${key}`);
  const blocks = at("block_count");
  const heads = at("attention.head_count");
  const kv = at("attention.head_count_kv");
  const vocab = listLength(get("tokenizer.ggml.tokens")) ?? grouped(at("vocab_size"));
  return [
    { label: "Architecture", value: joined([arch, blocks && `${blocks} blocks`], " · "), sub: joined([at("embedding_length") && `${at("embedding_length")} wide`, heads && `${heads} heads`, kv && kv !== heads && `${kv} KV heads`], ", ") },
    { label: "Context", value: at("context_length") ? `${grouped(at("context_length"))} tokens` : "Unknown", sub: at("rope.freq_base") ? `RoPE base ${grouped(at("rope.freq_base"))}` : "" },
    { label: "Size", value: joined([get("general.size_label"), bytes(model.size)], " · "), sub: `${model.format.split(" · ")[0] ?? "GGUF"}, ${model.tensors.length.toLocaleString("en-US")} tensors` },
    { label: "Tokenizer", value: joined([get("tokenizer.ggml.model"), vocab && `${vocab} tokens`], " · ") || "None", sub: get("tokenizer.ggml.pre") ? `pre-tokenizer ${get("tokenizer.ggml.pre")}` : "" },
  ];
}

function safetensorsFacts(model: ModelInfo): readonly ModelFact[] {
  const blocks = new Set(model.tensors.flatMap((t) => BLOCK.exec(t.name)?.[1] ?? [])).size;
  return [
    { label: "Format", value: "safetensors", sub: model.metadata.length > 0 ? `${model.metadata.length} metadata entries` : "no metadata" },
    { label: "Parameters", value: count(parameters(model.tensors)), sub: model.mix.map((m) => m.type).join(", ") },
    { label: "Size", value: bytes(model.size), sub: `${model.tensors.length.toLocaleString("en-US")} tensors` },
    { label: "Layout", value: blocks > 0 ? `${blocks} layers` : "No numbered layers", sub: "" },
  ];
}

function pickleFacts(model: ModelInfo): readonly ModelFact[] {
  const classes = [...new Set(model.loads.filter((l) => l.effect === "class").map((l) => l.from))];
  const running = model.loads.filter((l) => l.effect === "runs code").length;
  return [
    { label: "Format", value: model.format, sub: "a Python pickle" },
    { label: "Size", value: bytes(model.size), sub: "" },
    { label: "Built with", value: classes.length > 0 ? classes.join(", ") : "PyTorch only", sub: "" },
    { label: "Loads", value: `${model.loads.length} Python names`, sub: running > 0 ? `${running} run code` : "none run code" },
  ];
}

/** Each operator and how often the graph uses it, most used first. */
export function opCounts(model: ModelInfo): readonly (readonly [string, number])[] {
  const counts = new Map<string, number>();
  for (const n of model.nodes) counts.set(n.op, (counts.get(n.op) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
}

export function shapeText(shape: readonly number[]): string {
  return shape.length === 0 ? "scalar" : shape.map((d) => (d < 0 ? "?" : String(d))).join(" × ");
}

function onnxFacts(model: ModelInfo): readonly ModelFact[] {
  const [, opset, from] = model.format.split(" · ");
  const ops = opCounts(model);
  const io = (list: ModelInfo["inputs"]): string => list.map((t) => `${t.name} ${shapeText(t.shape)}`).join(", ") || "None";
  return [
    { label: "Format", value: joined(["ONNX", opset ?? null], " · "), sub: from ?? "" },
    { label: "Input", value: io(model.inputs), sub: model.inputs.length > 1 ? `${model.inputs.length} inputs` : "" },
    { label: "Output", value: io(model.outputs), sub: model.outputs.length > 1 ? `${model.outputs.length} outputs` : "" },
    { label: "Graph", value: `${model.nodes.length.toLocaleString("en-US")} operators`, sub: ops.slice(0, 3).map(([op, n]) => `${op} ×${n}`).join(", ") },
  ];
}

export function modelFacts(model: ModelInfo): readonly ModelFact[] {
  if (model.format.startsWith("ONNX")) return onnxFacts(model);
  if (model.format.startsWith("GGUF")) return ggufFacts(model);
  if (model.format === "safetensors") return safetensorsFacts(model);
  if (model.loads.length > 0 || model.format.includes("pickle")) return pickleFacts(model);
  const tensorText = (list: ModelInfo["inputs"]): string => list.map((t) => `${t.name} ${shapeText(t.shape)}`).join(", ") || "Unknown";
  return [
    { label: "Format", value: model.format, sub: "" },
    { label: "Weights", value: model.weights, sub: "" },
    { label: "Input", value: tensorText(model.inputs), sub: "" },
    { label: "Output", value: tensorText(model.outputs), sub: "" },
  ];
}

/** The things worth telling someone before they load the file. */
export function modelNotes(model: ModelInfo): readonly ModelNote[] {
  const notes: ModelNote[] = [];
  const pickle = model.loads.length > 0;
  if (model.risk) {
    const fromTemplate = model.template !== null;
    notes.push({ title: model.risk.title, body: fromTemplate ? "The chat template puts this in front of the model's conversations." : model.risk.detail, quote: fromTemplate ? model.risk.detail : null, page: fromTemplate ? "template" : pickle ? "loads" : null, tone: "warn" });
  }
  if (pickle) {
    const classes = [...new Set(model.loads.filter((l) => l.effect === "class").map((l) => l.from))];
    if (classes.length > 0) notes.push({ title: `Needs ${classes.join(" and ")} installed to load`, body: `It rebuilds classes from ${classes.join(" and ")}, so loading it imports that code.`, quote: null, page: "loads", tone: "warn" });
    if (!model.risk) notes.push({ title: "Nothing in it runs system commands", body: "Every name it loads builds tensors, layers or classes. No os, subprocess or eval.", quote: null, page: null, tone: "ok" });
  } else if (model.tensors.length > 0) {
    const kind = model.format.startsWith("GGUF") ? "GGUF" : model.format.startsWith("ONNX") ? "ONNX" : "safetensors";
    const body = kind === "ONNX" ? "ONNX describes a graph of standard operators and their weights. Loading it runs no Python." : `${kind} holds numbers and text only. There is nothing in it a runtime executes.`;
    if (!(kind === "ONNX" && model.risk)) notes.push({ title: "Loading it runs no code", body, quote: null, page: null, tone: "ok" });
  }
  const path = model.metadata.find((entry) => /\.(file|path|dataset)$/.test(entry.key) && entry.value.startsWith("/"));
  if (path) notes.push({ title: "Records where it was built", body: `${path.key} is ${path.value}`, quote: null, page: "metadata", tone: "plain" });
  return notes;
}

function looseGroup(name: string): string {
  if (/embd|embed|wte|wpe|tok_/.test(name)) return "Embeddings";
  if (/output|lm_head|head|norm/.test(name)) return "Output";
  return "Other";
}

/** Tensors in file order, gathered into their numbered blocks; the rest by what they are. */
export function tensorGroups(tensors: readonly ModelTensor[]): readonly TensorGroup[] {
  const groups: { key: string; label: string; tensors: ModelTensor[] }[] = [];
  for (const tensor of tensors) {
    const block = BLOCK.exec(tensor.name)?.[1];
    const key = block ?? looseGroup(tensor.name);
    const last = groups.at(-1);
    const found = last?.key === key ? last : block ? undefined : groups.find((g) => g.key === key);
    if (found) found.tensors.push(tensor);
    else groups.push({ key, label: key, tensors: [tensor] });
  }
  const number = (g: TensorGroup): number => Number(/\.(\d+)$/.exec(g.key)?.[1] ?? Number.NaN);
  const blocks = groups.filter((g) => !Number.isNaN(number(g))).sort((a, b) => number(a) - number(b));
  const rest = groups.filter((g) => Number.isNaN(number(g)));
  return [...rest.filter((g) => g.key === "Embeddings"), ...blocks, ...rest.filter((g) => g.key !== "Embeddings")];
}

export function metaGroups(metadata: readonly MetaEntry[]): readonly MetaGroup[] {
  const titles = new Map<string, string>([["general", "General"], ["tokenizer", "Tokenizer"], ["quantize", "Quantization"], ["split", "Split"]]);
  const groups = new Map<string, MetaEntry[]>();
  for (const entry of metadata) {
    const root = entry.key.includes(".") ? (entry.key.split(".")[0] ?? "") : "";
    const title = titles.get(root) ?? (root ? `Architecture: ${root}` : "About this file");
    groups.set(title, [...(groups.get(title) ?? []), entry]);
  }
  return [...groups].map(([title, entries]) => ({ title, entries }));
}

/** What a tensor does, from the names llama.cpp and Hugging Face give them. */
export function tensorRole(name: string): string {
  const rules: readonly (readonly [RegExp, string])[] = [
    [/token_embd|embed_tokens|wte/, "Token embeddings"],
    [/attn_q\b|attn_q\.|q_proj/, "Attention queries"],
    [/attn_k\b|attn_k\.|k_proj/, "Attention keys"],
    [/attn_v\b|attn_v\.|v_proj/, "Attention values"],
    [/attn_output|o_proj/, "Attention output projection"],
    [/attn_norm|input_layernorm/, "Normalizes the input to attention"],
    [/ffn_norm|post_attention_layernorm/, "Normalizes the input to feed-forward"],
    [/ffn_gate|gate_proj/, "Feed-forward gate"],
    [/ffn_up|up_proj/, "Feed-forward, up projection"],
    [/ffn_down|down_proj/, "Feed-forward, down projection"],
    [/output_norm|model\.norm|ln_f/, "Final normalization"],
    [/^output\.|lm_head/, "Output projection to the vocabulary"],
  ];
  return rules.find(([pattern]) => pattern.test(name))?.[1] ?? "";
}

export function blockOf(name: string): string | null {
  return BLOCK.exec(name)?.[2] ?? null;
}
