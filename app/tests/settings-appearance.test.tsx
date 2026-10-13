import { expect, test } from "bun:test";
import { createTestRoot, type TestRoot } from "@gpuix/react/testing";

import { ThemeCards } from "../src/settings/extras";
import { DARK, ThemeContext, type Appearance } from "../src/theme";

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
