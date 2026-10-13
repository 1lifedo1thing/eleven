import "./fixtures/isolate";
import { afterAll, beforeAll, test } from "bun:test";

import { adoptLoginShell } from "../src/agents/detect";
import { currentView } from "../src/bridge/view";
import { dispatchShortcut } from "../src/lib/shortcuts";
import { prepareTarget } from "../src/engine/target";
import { adoptToolchain } from "../src/engine/toolchain";
import { Screen } from "./harness";

let screen: Screen;

const press = (key: string): void =>
  dispatchShortcut({ elementId: 0, eventType: "keyDown", key, modifiers: { cmd: true, ctrl: false, alt: false, shift: false } });

beforeAll(async () => {
  await adoptLoginShell();
  adoptToolchain();
  screen = new Screen().workbench(prepareTarget("/bin/ls"));
});

afterAll(() => screen.unmount());

test("⌘K opens the search palette", async () => {
  await screen.until(() => screen.text().includes("134"));
  press("k");
  await screen.until(() => screen.labelled("Search functions, strings and actions") !== null, 10_000);
}, 90_000);

test("back and forward walk the functions you visited", async () => {
  screen.type("Search functions, strings and actions", "escape");
  await screen.until(() => screen.labelled("function FUN_1000016d8") !== null);
  screen.clickLabel("function FUN_1000016d8");
  await screen.until(() => currentView().fn === "FUN_1000016d8");
  press("[");
  await screen.until(() => currentView().fn === "entry");
  press("]");
  await screen.until(() => currentView().fn === "FUN_1000016d8");
}, 90_000);
