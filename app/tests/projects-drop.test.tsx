import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ReactElement, useState } from "react";

import type { Target } from "../src/engine/target";

process.env.ELEVEN_SUPPORT = mkdtempSync(join(tmpdir(), "eleven-drop-"));

const { useChat } = await import("../src/chat/useChat");
const { rememberProject } = await import("../src/engine/project");
const { prepareTarget } = await import("../src/engine/target");
const { Home } = await import("../src/home/Home");
const { dismissNews, LATEST_NEWS } = await import("../src/home/news");
const { DARK, ThemeContext } = await import("../src/theme");
const { Screen } = await import("./harness");

rememberProject(prepareTarget("/bin/cat"));
dismissNews(LATEST_NEWS.id);

const opened: string[] = [];
let attached: string | null = null;

function App(): ReactElement {
  const [target, setTarget] = useState<Target | null>(null);
  const chat = useChat(target, setTarget);
  attached = chat.target?.name ?? null;
  const none = (): void => {};
  return (
    <ThemeContext.Provider value={{ p: DARK, appearance: "Dark", setAppearance: none }}>
      <Home chat={chat} routes={{ onWorkbench: (next) => opened.push(next.path), onSetup: none, onSettings: none }} />
    </ThemeContext.Provider>
  );
}

const screen = new Screen().render(<App />);

test("projects page: dropping a binary opens its project", async () => {
  await screen.until(() => screen.labelled("See all projects") !== null, 10_000);
  screen.clickLabel("See all projects");
  await screen.until(() => screen.text().includes("anywhere to open it"), 5_000);
  const page = screen.ui.renderer.findByText("Drop an app, a binary or a .eleven file anywhere to open it. Opening an app you already have reopens its project.");
  if (!page) throw new Error("no drop hint");
  const box = screen.ui.renderer.getElementBounds(page.id);
  if (!box) throw new Error("drop hint has no box");
  screen.ui.renderer.nativeSimulateFileDrop(box.x + 20, box.y + box.height / 2, ["/bin/ls"]);
  await screen.until(() => opened.length > 0, 10_000);
  expect(opened[0]).toContain("ls");
}, 60_000);

test("home: dropping a binary on the chat attaches it without leaving home", async () => {
  await screen.until(() => !screen.text().includes("anywhere to open it"), 5_000);
  const heading = screen.ui.renderer.findByText("What should we take apart?");
  if (!heading) throw new Error("no landing");
  const box = screen.ui.renderer.getElementBounds(heading.id);
  if (!box) throw new Error("landing heading has no box");
  screen.ui.renderer.nativeSimulateFileDrop(box.x + box.width / 2, box.y + box.height / 2, ["/bin/cat"]);
  await screen.until(() => attached === "cat", 10_000);
  expect(opened).toHaveLength(1);
}, 60_000);

test("home: dropping a binary on the composer attaches it too", async () => {
  const chip = screen.ui.renderer.findByText("Mach-O · universal · 2 slices");
  if (!chip) throw new Error("no file chip in the composer");
  const box = screen.ui.renderer.getElementBounds(chip.id);
  if (!box) throw new Error("file chip has no box");
  screen.ui.renderer.nativeSimulateFileDrop(box.x + box.width + 120, box.y + box.height / 2, ["/bin/ls"]);
  await screen.until(() => attached === "ls", 10_000);
}, 60_000);
