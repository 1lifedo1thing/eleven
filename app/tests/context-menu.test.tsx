import { afterAll, beforeAll, expect, test } from "bun:test";
import { type ReactElement, useState } from "react";

import { type MenuEntry, menuOn } from "../src/components/ContextMenu";
import { Shell } from "../src/Shell";
import { DARK, ThemeContext } from "../src/theme";
import { Screen } from "./harness";

function Target(): ReactElement {
  const [picked, setPicked] = useState("nothing");
  const entries = (): readonly MenuEntry[] => [
    { kind: "action", label: "Rename", keys: "N", run: () => setPicked("rename") },
    { kind: "separator" },
    { kind: "action", label: "Assemble", unavailable: "Coming soon", run: () => setPicked("assemble") },
    { kind: "submenu", label: "Copy", items: [{ kind: "action", label: "Address", run: () => setPicked("copy address") }] },
  ];
  return (
    <ThemeContext.Provider value={{ p: DARK, appearance: "Dark", setAppearance: () => {} }}>
      <Shell side={null}>
        <div {...menuOn(entries)} aria-label="Target" style={{ width: 200, height: 60, margin: 40 }}>Right-click me</div>
        <div>{`Picked ${picked}`}</div>
      </Shell>
    </ThemeContext.Provider>
  );
}

let screen: Screen;

beforeAll(() => {
  screen = new Screen().render(<Target />);
});

afterAll(() => screen.unmount());

function rightClick(label: string): void {
  const id = screen.labelled(label);
  if (id === null) throw new Error(`nothing labelled ${label}`);
  const box = screen.ui.renderer.getElementBounds(id);
  if (!box) throw new Error("no box");
  screen.ui.renderer.nativeSimulateClick(box.x + 10, box.y + 10, 2);
  screen.ui.renderer.dispatchNativeEvents();
  screen.ui.renderer.flush();
}

function pointAt(label: string): void {
  const id = screen.labelled(label);
  const box = id === null ? null : screen.ui.renderer.getElementBounds(id);
  if (!box) throw new Error(`nothing labelled ${label}`);
  screen.ui.renderer.nativeSimulateMouseMove(box.x + box.width / 2, box.y + box.height / 2);
  screen.ui.renderer.dispatchNativeEvents();
  screen.ui.renderer.flush();
}

function press(key: string): void {
  const menu = screen.labelled("Rename");
  if (menu === null) throw new Error("menu is not open");
  screen.ui.renderer.nativeSimulateKeyDown(menu, key);
  screen.ui.renderer.dispatchNativeEvents();
  screen.ui.renderer.flush();
}

test("context menu: a right-click opens it and a click runs an item", async () => {
  await screen.until(() => screen.text().includes("Right-click me"), 5_000);
  rightClick("Target");
  await screen.until(() => screen.text().includes("Rename") && screen.text().includes("Coming soon"), 5_000);
  screen.clickLabel("Rename");
  await screen.until(() => screen.text().includes("Picked rename") && !screen.text().includes("Coming soon"), 5_000);
});

test("context menu: an unavailable item does nothing", async () => {
  rightClick("Target");
  await screen.until(() => screen.text().includes("Coming soon"), 5_000);
  screen.clickLabel("Assemble");
  await new Promise((resolve) => setTimeout(resolve, 200));
  expect(screen.text()).toContain("Picked rename");
});

test("context menu: Escape closes it", async () => {
  press("escape");
  await screen.until(() => !screen.text().includes("Coming soon"), 5_000);
});

test("context menu: arrow keys and Return run an item", async () => {
  rightClick("Target");
  await screen.until(() => screen.text().includes("Coming soon"), 5_000);
  press("down");
  press("enter");
  await screen.until(() => screen.text().includes("Picked rename") && !screen.text().includes("Coming soon"), 5_000);
});

test("context menu: a submenu item runs", async () => {
  rightClick("Target");
  await screen.until(() => screen.text().includes("Copy"), 5_000);
  screen.clickLabel("Copy");
  await screen.until(() => screen.text().includes("Address"), 3_000);
  pointAt("Address");
  screen.clickLabel("Address");
  await screen.until(() => screen.text().includes("Picked copy address"), 5_000);
});
