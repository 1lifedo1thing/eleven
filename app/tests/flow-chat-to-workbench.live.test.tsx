import { afterAll, beforeAll, expect, test } from "bun:test";
import { createTestRoot, type TestRoot } from "@gpuix/react/testing";

import { adoptLoginShell } from "../src/agents/detect";
import { App } from "../src/App";
import { prepareTarget } from "../src/engine/target";
import { adoptToolchain } from "../src/engine/toolchain";

let ui: TestRoot;

async function settle(until: () => boolean, ms: number): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    ui.renderer.dispatchNativeEvents();
    ui.renderer.flush();
    if (until()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`timed out; screen shows: ${ui.renderer.getAllText().slice(0, 60).join(" | ")}`);
}

const text = (): string => ui.renderer.getAllText().join("\n");

function click(label: string): void {
  const element = ui.renderer.findByText(label);
  if (!element) throw new Error(`no "${label}" on screen`);
  const box = ui.renderer.getElementBounds(element.id);
  if (!box) throw new Error(`"${label}" has no layout box`);
  ui.renderer.nativeSimulateClick(box.x + box.width / 2, box.y + box.height / 2);
  ui.renderer.dispatchNativeEvents();
  ui.renderer.flush();
}

beforeAll(async () => {
  await adoptLoginShell();
  adoptToolchain();
  ui = createTestRoot({ width: 1440, height: 900 });
  ui.render(<App initial={prepareTarget("/bin/ls")} />);
});

afterAll(() => ui.unmount());

test("starting a chat about a binary opens the workbench on it", async () => {
  await settle(() => text().includes("What should we take apart?"), 10_000);
  click("What does this program do when it starts?");
  await settle(() => text().includes("Functions"), 120_000);
}, 150_000);

test("the workbench dock shows the same conversation as Home", async () => {
  await settle(() => text().split("What does this program do when it starts?").length > 2, 30_000);
  expect(text()).not.toContain("How does it pick colors?");
}, 90_000);
