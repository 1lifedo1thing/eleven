import "../tests/fixtures/isolate";

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createTestRoot } from "@gpuix/react/testing";
import type { ReactElement, ReactNode } from "react";

import { useChat } from "../src/chat/useChat";
import { rememberProject } from "../src/engine/project";
import { prepareTarget } from "../src/engine/target";
import { ProjectsPage } from "../src/projects/ProjectsPage";
import { SettingsScreen } from "../src/settings/SettingsScreen";
import { DARK, ThemeContext } from "../src/theme";

/** Renders real Eleven screens off-screen and saves the crops What's New shows. Run: bun scripts/news-shots.tsx */
const OUT = join(import.meta.dir, "..", "assets", "news");
const RAW = mkdtempSync(join(tmpdir(), "eleven-news-"));
const WIDTH = 1440;
const HEIGHT = 900;

type Crop = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

function Themed({ children }: { readonly children: ReactNode }): ReactElement {
  return <ThemeContext.Provider value={{ p: DARK, appearance: "Dark", setAppearance: () => {} }}>{children}</ThemeContext.Provider>;
}

function Projects(): ReactElement {
  const chat = useChat(null, () => {});
  return <Themed><ProjectsPage chat={chat} onOpen={() => {}} /></Themed>;
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
  for (let settle = 0; settle < 10; settle++) {
    root.renderer.dispatchNativeEvents();
    root.renderer.flush();
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const full = join(RAW, `${name}.png`);
  root.renderer.captureScreenshot(full);
  root.unmount();
  const size = execFileSync("sips", ["-g", "pixelWidth", full]).toString();
  const scale = Number(size.match(/pixelWidth: (\d+)/)?.[1] ?? WIDTH) / WIDTH;
  const out = join(OUT, `${name}.png`);
  execFileSync("sips", ["-c", String(Math.round(crop.height * scale)), String(Math.round(crop.width * scale)), "--cropOffset", String(Math.round(crop.y * scale)), String(Math.round(crop.x * scale)), full, "--out", out]);
  console.log(`${out} (${scale}x)`);
}

const has = (word: string) => (texts: readonly string[]): boolean => texts.some((text) => text.includes(word));

mkdirSync(OUT, { recursive: true });
for (const path of ["/System/Applications/Dictionary.app", "/System/Applications/Calculator.app", "/bin/ls", "/System/Applications/TextEdit.app"]) {
  try {
    rememberProject(prepareTarget(path), Date.now());
  } catch (err) {
    console.warn(`skipped ${path}: ${String(err)}`);
  }
}

await shoot("permissions", <Themed><SettingsScreen initial="permissions" onBack={() => {}} onSetup={() => {}} /></Themed>, { x: 468, y: 43, width: 742, height: 427 }, has("Ask before changes"));
await shoot("engines", <Themed><SettingsScreen initial="engines" onBack={() => {}} onSetup={() => {}} /></Themed>, { x: 480, y: 140, width: 530, height: 304 }, has("Rizin"));
await shoot("projects", <Projects />, { x: 330, y: 40, width: 530, height: 304 }, has("TextEdit"));
process.exit(0);
