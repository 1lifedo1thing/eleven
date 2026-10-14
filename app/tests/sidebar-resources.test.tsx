import "./fixtures/isolate";
import { afterAll, beforeAll, expect, test } from "bun:test";
import type { ReactElement } from "react";

import { useChat } from "../src/chat/useChat";
import { DARK, ThemeContext } from "../src/theme";
import type { Program } from "../src/workbench/model";
import { WorkbenchView } from "../src/workbench/Workbench";
import { NO_GPU, SAMPLE_PROGRAM } from "./fixtures/sampleProgram";
import { Screen } from "./harness";

const APP: Program = {
  ...SAMPLE_PROGRAM,
  resources: {
    files: ["AndroidManifest.xml", "res/layout/main.xml", "res/values/strings.xml", "lib/arm64-v8a/libgreeter.so"],
    local: (file) => Promise.reject(new Error(`not on disk: ${file}`)),
  },
};

function AppBench(): ReactElement {
  const chat = useChat(null, () => {});
  return (
    <ThemeContext.Provider value={{ p: DARK, appearance: "Dark", setAppearance: () => {} }}>
      <WorkbenchView program={APP} problem={null} since={null} code gpu={NO_GPU} chat={chat} onBack={() => {}} onOpen={() => {}} />
    </ThemeContext.Provider>
  );
}

let screen: Screen;

beforeAll(() => {
  screen = new Screen().render(<AppBench />);
}, 60_000);

afterAll(() => screen.unmount());

test("resources: the side panel lists the app's files and opens one in a tab", async () => {
  await screen.until(() => screen.texts().includes("Resources"), 10_000);
  expect(screen.texts()).toContain("4 files");
  expect(screen.texts()).toContain("AndroidManifest.xml");
  screen.click("res");
  screen.click("values");
  await screen.until(() => screen.texts().includes("strings.xml"), 10_000);
  screen.click("AndroidManifest.xml");
  await screen.until(() => screen.texts().filter((text) => text === "AndroidManifest.xml").length > 1, 10_000);
});
