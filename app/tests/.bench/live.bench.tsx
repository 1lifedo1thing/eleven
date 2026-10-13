process.on('unhandledRejection', (e) => { console.error(e); process.exit(1); });
import { render, createRenderer, startFrameLoop } from "@gpuix/react";
import type { ReactElement } from "react";
import { useChat } from "../../src/home/useChat";
import { DARK, ThemeContext } from "../../src/theme";
import { WorkbenchView } from "../../src/workbench/Workbench";
import { NO_GPU, SAMPLE_PROGRAM } from "../fixtures/sampleProgram";

const LINES = 5000;
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

const r = createRenderer();
r.init({ title: "Eleven", width: 1440, height: 900, titlebarTransparent: true, ...(process.env.BG === "opaque" ? {} : { windowBackground: "blurred" as const }) });
const ticks: number[] = [];
const gaps: number[] = [];
let last = 0;
const tick = r.tick.bind(r);
const frameAt: number[] = [];
let seen = 0;
r.tick = () => { const t0 = performance.now(); if (last) gaps.push(t0 - last); last = t0; const ok = tick(); const t1 = performance.now(); ticks.push(t1 - t0); if (t1 - t0 > 1.5) frameAt.push(t1); return ok; };
function Bare(): ReactElement {
  const rows = big.split("\n");
  return <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", backgroundColor: "#16161a", color: "#ddd", fontSize: 13, lineHeight: 19 }}><virtual-list itemCount={rows.length} estimatedItemHeight={19} style={{ flexGrow: 1, minHeight: 0 }}>{rows.slice(0, 120).map((t, i) => <div key={i}>{t}</div>)}</virtual-list></div>;
}
render(process.env.MODE === "bare" ? <Bare /> : <Bench />, { renderer: r });
startFrameLoop(r, { frameMs: Number(process.env.FRAME_MS ?? 8) });

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
const q = (v: number[], p: number) => [...v].sort((a, b) => a - b)[Math.floor(p * (v.length - 1))]!.toFixed(2);
r.setDebugFrameOverlay("minimal");
r.activateWindow();
await wait(2500);
r.simulateClick(120, 330);
await wait(1500);
async function real(label: string, x: number, y: number, dy: number) {
  ticks.length = 0; gaps.length = 0; frameAt.length = 0; r.resetDebugFrameOverlayStats();
  const before = r.getAllText().find((t) => t.includes("local_")) ?? "";
  const proc = Bun.spawn([process.env.WHEEL ?? "wheel", String(x), String(y), String(dy), "240"], { stdout: "pipe" });
  await proc.exited;
  if (frameAt.length < 2) { console.log(label, "no frames", await new Response(proc.stdout).text()); return; }
  console.log("moved from", before.slice(0, 12), "to", (r.getAllText().find((t) => t.includes("local_")) ?? "").slice(0, 12));
  const iv = frameAt.slice(1).map((t, i) => t - frameAt[i]!);
  const over = (ms: number) => iv.filter((v) => v > ms).length;
  const s = r.getDebugFrameOverlayStats();
  console.log(`${label} [${process.env.MODE ?? "eleven"} ${process.env.BG ?? "blurred"} frameMs=${process.env.FRAME_MS ?? 8}]: frames ${frameAt.length} in ${(frameAt.at(-1)! - frameAt[0]!).toFixed(0)}ms | interval p50 ${q(iv, .5)} p90 ${q(iv, .9)} p99 ${q(iv, .99)} max ${q(iv, 1)} | >12ms ${over(12)} >20ms ${over(20)} | draw p90 ${s.p90Ms.toFixed(2)} max ${s.maxMs.toFixed(2)} | tick max ${q(ticks, 1)} gap max ${q(gaps, 1)}`);
}
await real("code", 700, 450, -6);

process.exit(0);

