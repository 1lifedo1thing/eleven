import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { keyBytes, type Screen, Shell } from "../src/terminal/shell";

const NONE = { ctrl: false, alt: false, shift: false, cmd: false };

function text(screen: Screen): string {
  return screen.rows.map((runs) => runs.map((run) => run.text).join("")).join("\n");
}

async function until(shell: Shell, done: (screen: Screen) => boolean): Promise<Screen> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const screen = shell.screen();
    if (done(screen)) return screen;
    await Bun.sleep(50);
  }
  throw new Error(`terminal shows:\n${text(shell.screen())}`);
}

test("keys turn into what a shell expects", () => {
  expect(keyBytes("a", "a", NONE, false)).toBe("a");
  expect(keyBytes("a", "A", { ...NONE, shift: true }, false)).toBe("A");
  expect(keyBytes("enter", undefined, NONE, false)).toBe("\r");
  expect(keyBytes("backspace", undefined, NONE, false)).toBe("\x7f");
  expect(keyBytes("c", "c", { ...NONE, ctrl: true }, false)).toBe("\x03");
  expect(keyBytes("up", undefined, NONE, false)).toBe("\x1b[A");
  expect(keyBytes("up", undefined, NONE, true)).toBe("\x1bOA");
  expect(keyBytes("left", undefined, { ...NONE, alt: true }, false)).toBe("\x1bb");
  expect(keyBytes("tab", undefined, { ...NONE, shift: true }, false)).toBe("\x1b[Z");
  expect(keyBytes("k", "k", { ...NONE, cmd: true }, false)).toBeNull();
});

test("the shell runs a command in its folder and shows the output", async () => {
  const shell = new Shell("/bin");
  try {
    await until(shell, (screen) => screen.rows.some((runs) => runs.some((run) => run.cursor)));
    shell.send("pwd; printf '\\033[32mgreen\\033[0m\\n'\r");
    const screen = await until(shell, (s) => /^\/bin$/m.test(text(s)) && /^green$/m.test(text(s)));
    const green = screen.rows.flat().find((run) => run.text.startsWith("green"));
    expect(green?.fg).toBe("#98c379");
  } finally {
    shell.dispose();
  }
}, 20_000);

test("resizing keeps the screen to the new size", async () => {
  const shell = new Shell("/tmp");
  try {
    shell.resize(40, 6);
    await until(shell, (screen) => screen.rows.length === 6);
    shell.send("tput cols\r");
    await until(shell, (screen) => /^40$/m.test(text(screen)));
  } finally {
    shell.dispose();
  }
}, 20_000);

test("a program asking where the cursor is gets an answer, so TUIs can start", async () => {
  const dir = mkdtempSync(join(tmpdir(), "eleven-term-"));
  writeFileSync(join(dir, "ask.sh"), "IFS= read -rs -d R -t 3 -p $'\\e[6n' pos\necho \"ROW=${pos#*[}\"\n");
  const shell = new Shell(dir);
  try {
    await until(shell, (screen) => screen.rows.some((runs) => runs.some((run) => run.cursor)));
    shell.send("bash ask.sh\r");
    await until(shell, (screen) => /^ROW=\d+;\d+$/m.test(text(screen)));
  } finally {
    shell.dispose();
  }
}, 20_000);
