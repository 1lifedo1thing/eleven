import { createTestRoot } from "@gpuix/react/testing";
import type { ReactElement } from "react";
import { useChat } from "../../src/home/useChat";
import { DARK, ThemeContext } from "../../src/theme";
import { WorkbenchView } from "../../src/workbench/Workbench";
import { NO_GPU, SAMPLE_PROGRAM } from "../fixtures/sampleProgram";

const N = Number(process.env.FNS ?? 300);
Reflect.set(SAMPLE_PROGRAM, "functions", Array.from({ length: N }, (_, i) => ({ ...SAMPLE_PROGRAM.functions[i % SAMPLE_PROGRAM.functions.length]!, addr: `0x1000${(i * 16).toString(16).padStart(5, "0")}`, name: `FUN_${i}` })));

function Bench(): ReactElement {
  const chat = useChat(null, () => {});
  return <ThemeContext.Provider value={{ p: DARK, appearance: "Dark", setAppearance: () => {} }}><WorkbenchView program={SAMPLE_PROGRAM} problem={null} since={null} code gpu={NO_GPU} chat={chat} onBack={() => {}} onOpen={() => {}} /></ThemeContext.Provider>;
}
const ui = createTestRoot({ width: 1440, height: 900 });
ui.render(<Bench />);
const r = ui.renderer;
const settle = async () => { for (let i = 0; i < 30; i++) { r.dispatchNativeEvents(); r.flush(); await new Promise((res) => setTimeout(res, 20)); } };
await settle();
const frame = (label: string) => {
  const t: number[] = [];
  for (let i = 0; i < 150; i++) { r.markDirty?.(); const t0 = performance.now(); r.dispatchScrollWheel(1000, 500, 0, i % 2 ? -3 : 3); r.flush(); t.push(performance.now() - t0); }
  t.sort((a, b) => a - b); console.log(`${label}: p50 ${t[75]!.toFixed(2)}ms p90 ${t[135]!.toFixed(2)}ms`);
};
frame(`workbench, sidebar open, ${N} fns`);
const json = JSON.stringify(r.toJSON());
const id = (label: string): number | null => { const m = json.match(new RegExp(`"id":(\\\\d+)[^{}]*"aria-label":"${label}"`)) ?? json.match(new RegExp(`"aria-label":"${label}"[^{}]*"id":(\\\\d+)`)); return m ? Number(m[1]) : null; };
const hide = r.findByText("Hide sidebar") ?? null;
const b = id("Hide sidebar");
if (b !== null) { const box = r.getElementBounds(b)!; r.nativeSimulateClick(box.x + 4, box.y + 4); await settle(); frame("workbench, sidebar hidden"); } else console.log("no hide button", hide);
ui.unmount(); process.exit(0);
