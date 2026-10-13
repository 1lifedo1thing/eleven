import { afterAll, beforeAll, expect, test } from "bun:test";
import { type ReactElement, useState } from "react";

import { Dropdown } from "../src/settings/Dropdown";
import { DARK, ThemeContext } from "../src/theme";
import { Screen } from "./harness";

const CHOICES = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Match system" },
] as const;

function Picker(): ReactElement {
  const [value, setValue] = useState<string>("light");
  return (
    <ThemeContext.Provider value={{ p: DARK, appearance: "Dark", setAppearance: () => {} }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: 40 }}>
        <div style={{ display: "flex" }}>
          <Dropdown label="Theme" value={value} choices={CHOICES} onPick={setValue} />
        </div>
        <div style={{ height: 300 }}>{`Picked ${value}`}</div>
      </div>
    </ThemeContext.Provider>
  );
}

let screen: Screen;

beforeAll(() => {
  screen = new Screen().render(<Picker />);
});

afterAll(() => screen.unmount());

test("pickers: a choice in the menu is picked", async () => {
  await screen.until(() => screen.text().includes("Picked light"), 5_000);
  screen.clickLabel("Theme");
  await screen.until(() => screen.text().includes("Match system"), 5_000);
  screen.click("Match system");
  await screen.until(() => screen.text().includes("Picked system") && !screen.text().includes("Dark"), 5_000);
  expect(screen.text()).toContain("Picked system");
});

test("pickers: pressing the trigger again or outside closes the menu", async () => {
  screen.clickLabel("Theme");
  await screen.until(() => screen.text().includes("Dark"), 5_000);
  screen.clickLabel("Theme");
  await screen.until(() => !screen.text().includes("Dark"), 5_000);
  screen.clickLabel("Theme");
  await screen.until(() => screen.text().includes("Dark"), 5_000);
  screen.click("Picked system");
  await screen.until(() => !screen.text().includes("Dark"), 5_000);
  expect(screen.text()).toContain("Picked system");
});
