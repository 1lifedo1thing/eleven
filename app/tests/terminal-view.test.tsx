import { expect, test } from "bun:test";

import { TerminalView } from "../src/terminal/TerminalView";
import { DARK, ThemeContext } from "../src/theme";
import { Screen } from "./harness";

test("the terminal tab runs what you type and shows the output", async () => {
  const screen = new Screen().render(
    <ThemeContext.Provider value={{ p: DARK, appearance: "Dark", setAppearance: () => {} }}>
      <TerminalView cwd="/usr" />
    </ThemeContext.Provider>,
  );
  await screen.until(() => screen.text().includes("➜") || screen.text().includes("%") || screen.text().includes("$"), 20_000);
  screen.type("Terminal", "e c h o space h i - e l e v e n enter");
  await screen.until(() => screen.texts().filter((line) => line.includes("hi-eleven")).length >= 2, 20_000);
  expect(screen.texts().some((line) => line.trim() === "hi-eleven")).toBe(true);
}, 60_000);
