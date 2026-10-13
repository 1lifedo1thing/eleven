import "../tests/fixtures/isolate";

import { mkdirSync } from "node:fs";
import { join } from "node:path";

import type { ReactElement } from "react";

import { App } from "../src/App";
import { rememberProject } from "../src/engine/project";
import { dismissNews, NEWS } from "../src/home/news";
import { prepareTarget } from "../src/engine/target";
import { SettingsScreen } from "../src/settings/SettingsScreen";
import { loadSettings, saveSettings } from "../src/settings/store";
import { paletteFor, ThemeContext, type Appearance } from "../src/theme";
import { ghidraHome } from "../src/welcome/checks";
import { markWelcomeDone } from "../src/welcome/store";
import { Screen } from "../tests/harness";

/** Renders real Eleven screens off-screen in both themes for the site and launch video. Run: bun scripts/showcase-shots.tsx [out] */
const OUT = process.argv[2] ?? join(import.meta.dir, "..", "..", "launch", "public", "shots");
const BINARY = "/bin/ls";

const settle = async (screen: Screen, ms: number): Promise<void> => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    screen.ui.renderer.dispatchNativeEvents();
    screen.ui.renderer.flush();
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

const save = (screen: Screen, name: string, appearance: Appearance): void => {
  const file = join(OUT, `${name}-${appearance.toLowerCase()}.png`);
  screen.ui.renderer.captureScreenshot(file);
  console.log(file);
};

const has = (screen: Screen, word: string) => (): boolean => screen.texts().some((text) => text.includes(word));

function Engines({ appearance }: { readonly appearance: Appearance }): ReactElement {
  return (
    <ThemeContext.Provider value={{ p: paletteFor(appearance), appearance, setAppearance: () => {} }}>
      <SettingsScreen initial="engines" onBack={() => {}} onSetup={() => {}} />
    </ThemeContext.Provider>
  );
}

mkdirSync(OUT, { recursive: true });
markWelcomeDone();
for (const news of NEWS) dismissNews(news.id);
for (const path of ["/System/Applications/Calculator.app", "/System/Applications/TextEdit.app", BINARY]) rememberProject(prepareTarget(path), Date.now());

for (const appearance of ["Dark", "Light"] as const) {
  saveSettings({ ...loadSettings(), appearance, openWorkbench: "Always" });

  const home = new Screen().render(<App initial={null} />);
  await home.until(has(home, "TextEdit"));
  await settle(home, 1500);
  save(home, "home", appearance);
  home.unmount();

  const bench = new Screen().render(<App initial={prepareTarget(BINARY)} />);
  await bench.until(() => bench.labelled("Workspace") !== null, 120_000);
  await bench.until(has(bench, "entry"), 180_000);
  await settle(bench, 4000);
  save(bench, "workbench", appearance);
  bench.unmount();

  process.env.GHIDRA_INSTALL_DIR = ghidraHome() ?? "";
  const engines = new Screen().render(<Engines appearance={appearance} />);
  await engines.until(has(engines, "Rizin"));
  await settle(engines, 2500);
  save(engines, "engines", appearance);
  engines.unmount();
  delete process.env.GHIDRA_INSTALL_DIR;
}
process.exit(0);
