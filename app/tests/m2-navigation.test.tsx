import "./fixtures/isolate";
import { afterAll, beforeAll, test } from "bun:test";

import { adoptLoginShell } from "../src/agents/detect";
import { currentView } from "../src/bridge/view";
import { dispatchShortcut } from "../src/lib/shortcuts";
import { prepareTarget } from "../src/engine/target";
import { adoptToolchain } from "../src/engine/toolchain";
import { Screen } from "./harness";
import { showFunctions } from "./fixtures/sidebar";

let screen: Screen;

const press = (key: string): void =>
  dispatchShortcut({ elementId: 0, eventType: "keyDown", key, modifiers: { cmd: true, ctrl: false, alt: false, shift: false } });

beforeAll(async () => {
  await adoptLoginShell();
  adoptToolchain();
  screen = new Screen().workbench(prepareTarget("/bin/ls"));
});

afterAll(() => screen.unmount());

test("back and forward walk the functions you visited", async () => {
  await showFunctions(screen);
  await screen.until(() => screen.labelled("function FUN_1000016d8") !== null);
  screen.clickLabel("function FUN_1000016d8");
  await screen.until(() => currentView().fn === "FUN_1000016d8");
  press("[");
  await screen.until(() => currentView().fn === "entry");
  press("]");
  await screen.until(() => currentView().fn === "FUN_1000016d8");
}, 90_000);
