import "../tests/fixtures/isolate";

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createTestRoot, type TestRoot } from "@gpuix/react/testing";
import type { ReactElement, ReactNode } from "react";

import { useChat } from "../src/chat/useChat";
import { WorkbenchView } from "../src/workbench/Workbench";
import { SettingsScreen } from "../src/settings/SettingsScreen";
import { DARK, ThemeContext } from "../src/theme";
import { NO_GPU, SAMPLE_PROGRAM } from "../tests/fixtures/sampleProgram";
import { Screen } from "../tests/harness";

/** Renders real Eleven screens off-screen and saves the crops What's New shows. Run: bun scripts/news-shots.tsx */
const OUT = join(import.meta.dir, "..", "assets", "news");
const RAW = mkdtempSync(join(tmpdir(), "eleven-news-"));
const WIDTH = 1440;
const HEIGHT = 900;

type Crop = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

function Themed({ children }: { readonly children: ReactNode }): ReactElement {
  return <ThemeContext.Provider value={{ p: DARK, appearance: "Dark", setAppearance: () => {} }}>{children}</ThemeContext.Provider>;
}

function SampleBench(): ReactElement {
  const chat = useChat(null, () => {});
  return <Themed><WorkbenchView program={SAMPLE_PROGRAM} problem={null} since={null} code gpu={NO_GPU} chat={chat} onBack={() => {}} onOpen={() => {}} /></Themed>;
}

async function settle(root: TestRoot): Promise<void> {
  for (let tick = 0; tick < 10; tick++) {
    root.renderer.dispatchNativeEvents();
    root.renderer.flush();
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function shoot(name: string, node: ReactElement, crop: Crop, wait: (texts: readonly string[]) => boolean): Promise<void> {
  const root = createTestRoot({ width: WIDTH, height: HEIGHT });
  root.render(node);
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    root.renderer.dispatchNativeEvents();
    root.renderer.flush();
    if (wait(root.renderer.getAllText())) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await save(name, root, crop);
}

async function save(name: string, root: TestRoot, crop: Crop): Promise<void> {
  await settle(root);
  const full = join(RAW, `${name}.png`);
  root.renderer.captureScreenshot(full);
  root.unmount();
  const size = execFileSync("sips", ["-g", "pixelWidth", full]).toString();
  const scale = Number(size.match(/pixelWidth: (\d+)/)?.[1] ?? WIDTH) / WIDTH;
  const out = join(OUT, `${name}.png`);
  execFileSync("sips", ["-c", String(Math.round(crop.height * scale)), String(Math.round(crop.width * scale)), "--cropOffset", String(Math.round(crop.y * scale)), String(Math.round(crop.x * scale)), full, "--out", out]);
  console.log(`${out} (${scale}x)`);
}

/** Picks lines 18 to 25 of entry by their numbers, so the Ask bar shows over them. */
async function askShot(crop: Crop): Promise<void> {
  const screen = new Screen().render(<SampleBench />);
  await screen.until(() => screen.labelled("entry") !== null);
  screen.clickLabel("entry");
  await screen.until(() => screen.text().includes("_isatty"));
  for (const [number, shift] of [[18, false], [25, true]] as const) {
    const id = screen.labelled(`Line ${number}`);
    const box = id === null ? null : screen.ui.renderer.getElementBounds(id);
    if (!box) throw new Error(`no line ${number}`);
    screen.ui.renderer.nativeSimulateClick(box.x + 30, box.y + box.height / 2, 0, shift ? "shift" : undefined);
    screen.ui.renderer.dispatchNativeEvents();
    screen.ui.renderer.flush();
  }
  await screen.until(() => screen.labelled("Explain") !== null);
  await save("ask", screen.ui, crop);
}

const has = (word: string) => (texts: readonly string[]): boolean => texts.some((text) => text.includes(word));

mkdirSync(OUT, { recursive: true });

await askShot({ x: 272, y: 316, width: 530, height: 304 });
await shoot("glass", <Themed><SettingsScreen initial="appearance" onBack={() => {}} onSetup={() => {}} /></Themed>, { x: 468, y: 296, width: 744, height: 427 }, has("Frost"));
process.exit(0);
