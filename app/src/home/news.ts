import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { isRecord } from "../lib/guards";
import { supportPath } from "../lib/support";
import type { Page } from "../settings/pages";

/** The picture at the top of a card: logos (paths under assets), or a screenshot from assets/news. */
export type NewsArt =
  | { readonly kind: "logos"; readonly files: readonly string[] }
  | { readonly kind: "shot"; readonly file: string };

/** What the card's button does: open a Settings page, or nothing. */
export type NewsAction =
  | { readonly kind: "settings"; readonly label: string; readonly page: Page }
  | { readonly kind: "none" };

export type News = {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly art: NewsArt;
  readonly action: NewsAction;
};

/** Newest first; the card opens on the first one. */
export const NEWS: readonly News[] = [
  {
    id: "notifications",
    title: "Hear back while you're away",
    body: "Switch to another app and Eleven tells you when your agent finishes or needs your OK, and you can answer right from the notification. Your chats are back in the side panel too.",
    art: { kind: "logos", files: ["icons/thread.svg", "icons/new-chat.svg"] },
    action: { kind: "settings", label: "Choose what you hear about", page: "chat" },
  },
  {
    id: "ask-about-lines",
    title: "Ask about any line",
    body: "Click line numbers in any code view, then Ask or Explain. The answer opens right under the lines, and a suggested rename is one click away.",
    art: { kind: "shot", file: "ask.png" },
    action: { kind: "settings", label: "Pick the model that answers", page: "agents" },
  },
  {
    id: "source-files",
    title: "Get the source back",
    body: "Every source file the app was built from opens as a tab. Your agent can recreate a whole file, with each function linked back to its code.",
    art: { kind: "logos", files: ["icons/lang-swift.svg", "icons/lang-objc.svg", "icons/lang-java.svg", "icons/lang-kotlin.svg"] },
    action: { kind: "none" },
  },
  {
    id: "android-apps",
    title: "Whole Android apps",
    body: "APKs open with their smali, resources and string tables. Split bundles like .xapk and .apks open with every split in place.",
    art: { kind: "logos", files: ["formats/android.svg"] },
    action: { kind: "none" },
  },
  {
    id: "binary-diffs",
    title: "Compare two builds",
    body: "Pick Compare with another binary in ⌘K to see which functions were added, removed or changed, shown like a code review.",
    art: { kind: "logos", files: ["icons/binary.svg", "icons/split.svg"] },
    action: { kind: "none" },
  },
  {
    id: "gpu-kernels",
    title: "CUDA and HIP kernels",
    body: "Read PTX with highlighting and notes beside the tricky parts, or have your agent rewrite a kernel as CUDA C++, HIP or Metal.",
    art: { kind: "logos", files: ["formats/nvidia.svg", "formats/amd.svg"] },
    action: { kind: "none" },
  },
  {
    id: "model-files",
    title: "Open model files",
    body: "GGUF, ONNX, PyTorch, safetensors and Core ML files open in the workbench, with their layers and tensors next to your agent.",
    art: { kind: "logos", files: ["formats/llama-cpp.svg", "formats/onnx.svg", "formats/pytorch.svg", "formats/huggingface.svg"] },
    action: { kind: "none" },
  },
  {
    id: "window-glass",
    title: "Tune the glass",
    body: "Choose how much of your desktop shows through the window and how blurred it is. All the way down is solid.",
    art: { kind: "shot", file: "glass.png" },
    action: { kind: "settings", label: "Adjust the glass", page: "appearance" },
  },
];

export const LATEST_NEWS: News = NEWS[0] ?? {
  id: "none",
  title: "",
  body: "",
  art: { kind: "logos", files: [] },
  action: { kind: "none" },
};

function dismissed(): readonly string[] {
  try {
    const json: unknown = JSON.parse(readFileSync(supportPath("news.json"), "utf8"));
    if (!isRecord(json) || !Array.isArray(json.dismissed)) return [];
    return json.dismissed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export function isNewsDismissed(id: string): boolean {
  return dismissed().includes(id);
}

export function dismissNews(id: string): void {
  try {
    const file = supportPath("news.json");
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify({ dismissed: [...dismissed().filter((seen) => seen !== id), id] }, null, 2)}\n`);
  } catch {
    return;
  }
}
