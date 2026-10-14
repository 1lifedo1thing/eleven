import { expect, test } from "bun:test";
import { createTestRoot, type TestRoot } from "@gpuix/react/testing";

import { ThemeCards, WindowPreview } from "../src/settings/extras";
import { DARK, frostRadius, glassTint, LIGHT, ThemeContext, type Appearance } from "../src/theme";

type Json = { readonly id?: number; readonly customProps?: Record<string, unknown>; readonly children?: readonly Json[] };

function byLabel(node: unknown, label: string): number | null {
  if (typeof node !== "object" || node === null) return null;
  const json: Json = node;
  if (json.customProps?.["aria-label"] === label && typeof json.id === "number") return json.id;
  for (const child of json.children ?? []) {
    const found = byLabel(child, label);
    if (found !== null) return found;
  }
  return null;
}

function settle(root: TestRoot): void {
  for (let i = 0; i < 4; i++) {
    root.renderer.dispatchNativeEvents();
    root.renderer.flush();
  }
}

test("appearance: tapping anywhere on a theme card picks that theme", () => {
  const root = createTestRoot({ width: 900, height: 400 });
  const picks: Appearance[] = [];
  root.render(
    <ThemeContext.Provider value={{ p: DARK, appearance: "Dark", setAppearance: () => {} }}>
      <div style={{ display: "flex", flexDirection: "column", width: 820, padding: 40 }}>
        <ThemeCards value="Dark" onPick={(next) => picks.push(next)} />
      </div>
    </ThemeContext.Provider>,
  );
  settle(root);
  const light = byLabel(root.renderer.toJSON(), "Light");
  if (light === null) throw new Error("no Light card");
  const box = root.renderer.getElementBounds(light);
  if (!box) throw new Error("the Light card has no layout box");
  const spots: readonly (readonly [string, number, number])[] = [
    ["the preview in the middle", box.x + box.width / 2, box.y + box.height / 2],
    ["the top left of the preview", box.x + 12, box.y + 14],
    ["the bottom right of the preview", box.x + box.width - 12, box.y + 63],
    ["the label under the preview", box.x + box.width / 2, box.y + box.height - 12],
  ];
  for (const [where, x, y] of spots) {
    picks.length = 0;
    root.renderer.nativeSimulateClick(x, y);
    settle(root);
    expect([where, picks]).toEqual([where, ["Light"]]);
  }
  root.unmount();
});

test("appearance: transparency runs from the solid window colour to see-through", () => {
  expect(glassTint(DARK, 0)).toBe("rgba(23,23,23,1.000)");
  expect(glassTint(DARK, 100)).toBe("rgba(23,23,23,0.300)");
  expect(glassTint(LIGHT, 30)).toBe("rgba(243,243,241,0.790)");
  expect(glassTint(DARK, 140)).toBe(glassTint(DARK, 100));
});

test("appearance: frost maps to a blur radius in points", () => {
  expect([frostRadius(0), frostRadius(60), frostRadius(100), frostRadius(-5)]).toEqual([0, 30, 50, 0]);
});

test("appearance: the window preview lays out at the settings width", () => {
  const root = createTestRoot({ width: 900, height: 400 });
  root.render(
    <ThemeContext.Provider value={{ p: DARK, appearance: "Dark", setAppearance: () => {} }}>
      <div style={{ display: "flex", flexDirection: "column", width: 720 }}>
        <WindowPreview transparency={40} frost={60} />
      </div>
    </ThemeContext.Provider>,
  );
  settle(root);
  const preview = byLabel(root.renderer.toJSON(), "Window preview");
  if (preview === null) throw new Error("no window preview");
  expect(root.renderer.getElementBounds(preview)).toMatchObject({ width: 720, height: 168 });
  root.unmount();
});
