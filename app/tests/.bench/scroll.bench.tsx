import { createTestRoot } from "@gpuix/react/testing";
import type { ReactElement } from "react";
import { useChat } from "../../src/home/useChat";
import { DARK, ThemeContext } from "../../src/theme";
import { WorkbenchView } from "../../src/workbench/Workbench";
import { NO_GPU, SAMPLE_PROGRAM } from "../fixtures/sampleProgram";

const LINES = Number(process.env.LINES ?? 5000);
const big = Array.from({ length: LINES }, (_, i) => `  local_${i} = FUN_10000${(i % 90) + 10}a0(param_1, local_${i - 1} + 0x${i.toString(16)});`).join("\n");
Reflect.set(SAMPLE_PROGRAM, "code", () => Promise.resolve(big));

function Bench(): ReactElement {
  const chat = useChat(null, () => {});
  return (
    <ThemeContext.Provider value={{ p: DARK, appearance: "Dark", setAppearance: () => {} }}>
      <WorkbenchView program={SAMPLE_PROGRAM} problem={null} since={null} code gpu={NO_GPU} chat={chat} onBack={() => {}} onOpen={() => {}} />
    </ThemeContext.Provider>
  );
}

const ui = createTestRoot({ width: 1440, height: 900 });
ui.render(<Bench />);
const r = ui.renderer;
for (let i = 0; i < 40; i++) { r.dispatchNativeEvents(); r.flush(); await new Promise((res) => setTimeout(res, 25)); }
function clickText(t: string): void {
  const e = r.findByText(t); if (!e) throw new Error("no " + t);
  const b = r.getElementBounds(e.id)!; r.nativeSimulateClick(b.x + b.width / 2, b.y + b.height / 2); r.dispatchNativeEvents(); r.flush();
}
clickText("entry");
for (let i = 0; i < 40; i++) { r.dispatchNativeEvents(); r.flush(); await new Promise((res) => setTimeout(res, 25)); }
const all = r.getAllText();
console.log(all.slice(0, 80).join(" | "));

const el = r.findByText("local_5 =");
const box = el ? r.getElementBounds(el.id) : null;
const x = box ? box.x + 200 : 700, y = box ? box.y : 400;
console.log("wheel at", x, y);

function split(label: string, dy: number, n: number): void {
  const a: number[] = [], b: number[] = [], c: number[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = performance.now(); r.dispatchScrollWheel(x, y, 0, dy);
    const t1 = performance.now(); r.dispatchNativeEvents();
    const t2 = performance.now(); r.flush();
    const t3 = performance.now(); a.push(t1 - t0); b.push(t2 - t1); c.push(t3 - t2);
  }
  const m = (v: number[]): string => { const s = [...v].sort((p, q) => p - q); return `p50 ${s[Math.floor(s.length / 2)]!.toFixed(2)} p95 ${s[Math.floor(s.length * 0.95)]!.toFixed(2)}`; };
  console.log(`${label}: wheel ${m(a)} | js ${m(b)} | flush ${m(c)}`);
}
function sample(label: string, dy: number, n: number): void {
  const times: number[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    r.dispatchScrollWheel(x, y, 0, dy);
    r.dispatchNativeEvents();
    r.flush();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const q = (p: number): string => times[Math.min(times.length - 1, Math.floor(p * times.length))]!.toFixed(2);
  console.log(`${label}: p50 ${q(0.5)}ms p90 ${q(0.9)}ms p99 ${q(0.99)}ms max ${q(1)}ms over ${n}`);
}
{
  const t: number[] = [];
  for (let i = 0; i < 200; i++) { const t0 = performance.now(); r.dispatchNativeEvents(); r.flush(); t.push(performance.now() - t0); }
  t.sort((a, b) => a - b); console.log("idle flush p50", t[100]!.toFixed(2));
}
split("split dy=-20", -20, 300); split("split dy=+20", 20, 300);
sample("code dy=-20", -20, 400);
sample("code dy=-120", -120, 300);
sample("code up dy=+60", 60, 300);
ui.unmount();
process.exit(0);
