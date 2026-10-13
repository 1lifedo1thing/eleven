import { afterAll, beforeAll, expect, test } from "bun:test";
import { join } from "node:path";

import { adoptLoginShell } from "../src/agents/detect";
import { prepareTarget } from "../src/engine/target";
import { adoptToolchain } from "../src/engine/toolchain";
import { Screen } from "./harness";

let screen: Screen;

beforeAll(async () => {
  await adoptLoginShell();
  adoptToolchain();
  screen = new Screen().workbench(prepareTarget(join(import.meta.dir, "fixtures", "PhotoFilter.app")));
}, 30_000);

afterAll(() => screen.unmount());

test("skills: the / palette lists Eleven's playbooks and running one sends it", async () => {
  await screen.until(() => screen.text().includes("Functions"), 120_000);
  screen.clickLabel("Modes, skills and files");
  await screen.until(() => screen.text().includes("first-look") && screen.text().includes("shader-check"), 10_000);
  screen.type("Search the palette", "shader");
  await screen.until(() => screen.text().includes("shader-check") && !screen.text().includes("first-look"));
  screen.click("shader-check");
  await screen.until(() => screen.texts().includes("Shader check"), 10_000);
  expect(screen.text()).not.toContain("Follow this Eleven playbook");
}, 180_000);
