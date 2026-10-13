import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.ELEVEN_SUPPORT = mkdtempSync(join(tmpdir(), "eleven-nav-"));

const { App } = await import("../src/App");
const { prepareTarget } = await import("../src/engine/target");
const { runCommand } = await import("../src/lib/shortcuts");
const { loadSettings, saveSettings } = await import("../src/settings/store");
const { markWelcomeDone } = await import("../src/welcome/store");
const { Screen } = await import("./harness");

markWelcomeDone();
saveSettings({ ...loadSettings(), openWorkbench: "Always" });

const screen = new Screen().render(<App initial={prepareTarget("/bin/ls")} />);

const inSettings = (): boolean => screen.labelled("Search settings") !== null;
const inWorkbench = (): boolean => screen.labelled("Workspace") !== null;

test("nav: Back from Settings returns to the workbench it was opened from", async () => {
  await screen.until(inWorkbench, 30_000);
  runCommand("settings");
  await screen.until(inSettings, 10_000);
  expect(inWorkbench()).toBe(false);
  screen.clickLabel("Back");
  await screen.until(inWorkbench, 10_000);
  expect(inSettings()).toBe(false);
}, 60_000);
