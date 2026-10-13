import "./fixtures/isolate";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { join } from "node:path";

import { adoptLoginShell } from "../src/agents/detect";
import { indexMentions, type Mention, searchMentions, startedMention, withMentions } from "../src/chat/mentions";
import { prepareTarget } from "../src/engine/target";
import { adoptToolchain } from "../src/engine/toolchain";
import { Screen } from "./harness";

const ALL: readonly Mention[] = [
  { kind: "function", label: "app.eleven.hello.Greeter.shout", addr: "0x100000200", detail: "0x100000200" },
  { kind: "function", label: "app.eleven.hello.Greeter.greet", addr: "0x100000100", detail: "0x100000100" },
  { kind: "function", label: "loudshouter", addr: "0x100000300", detail: "0x100000300" },
  { kind: "string", label: "\"Hello, \"", addr: "0x400", detail: "0x400" },
  { kind: "bookmark", label: "shout here", addr: "0x100000200", detail: "app.eleven.hello.Greeter.shout" },
];

const INDEX = indexMentions(ALL);

test("mentions: prefix beats a word match, which beats a match inside a name, and bookmarks come first on ties", () => {
  expect(searchMentions(INDEX, "shout").shown.map((m) => m.label)).toEqual(["shout here", "app.eleven.hello.Greeter.shout", "loudshouter"]);
  expect(searchMentions(INDEX, "gtgreet").shown.map((m) => m.label)).toEqual(["app.eleven.hello.Greeter.greet"]);
  expect(searchMentions(INDEX, "0x4").shown.map((m) => m.label)).toEqual(["\"Hello, \""]);
  expect(searchMentions(INDEX, "nothing like it").shown).toEqual([]);
  expect(searchMentions(INDEX, "", null, 2).shown).toHaveLength(2);
});

test("mentions: a longer query searches only what the shorter one matched, and gives the same answer as a fresh search", () => {
  const sh = searchMentions(INDEX, "sh");
  const narrowed = searchMentions(INDEX, "shou", sh);
  expect(narrowed.matched.length).toBeLessThanOrEqual(sh.matched.length);
  expect(narrowed.shown).toEqual(searchMentions(INDEX, "shou").shown);
  expect(searchMentions(INDEX, "gre", narrowed).shown).toEqual(searchMentions(INDEX, "gre").shown);
});

test("mentions: only an @ typed at the start or after a space opens the picker", () => {
  expect(startedMention("", "@")).toBe("");
  expect(startedMention("what does ", "what does @")).toBe("what does ");
  expect(startedMention("mail me at chizi", "mail me at chizi@")).toBeNull();
  expect(startedMention("ab", "a@b")).toBeNull();
});

test("mentions: the message tells the agent where each mention it still contains lives", () => {
  const [shout, greet] = ALL;
  if (!shout || !greet) throw new Error("fixtures missing");
  expect(withMentions("why is @app.eleven.hello.Greeter.shout slow", [shout, greet, shout])).toBe("why is @app.eleven.hello.Greeter.shout slow\n\n@app.eleven.hello.Greeter.shout is the function at 0x100000200.");
  expect(withMentions("plain question", [shout])).toBe("plain question");
});

let screen: Screen;

beforeAll(async () => {
  await adoptLoginShell();
  adoptToolchain();
  screen = new Screen().workbench(prepareTarget(join(import.meta.dir, "fixtures", "android", "hello.apk")));
}, 30_000);

afterAll(() => screen.unmount());

test("mentions: typing @ in the agent's prompt searches the file and puts the pick in the draft", async () => {
  await screen.until(() => screen.text().includes("Functions"), 120_000);
  screen.type("Message", "w h y space @");
  await screen.until(() => screen.labelled("Mention something in this file") !== null, 10_000);
  screen.type("Mention something in this file", "s h o u t");
  await screen.until(() => screen.texts().includes("app.eleven.hello.Greeter.shout"), 10_000);
  screen.type("Mention something in this file", "enter");
  await screen.until(() => screen.labelled("Mention something in this file") === null, 10_000);
  screen.type("Message", "s l o w");
  await screen.until(() => screen.valueOf("Message") === "why @app.eleven.hello.Greeter.shout slow", 10_000);
  expect(screen.valueOf("Message")).toBe("why @app.eleven.hello.Greeter.shout slow");
}, 180_000);

test("mentions: escape closes the picker and keeps what was typed", async () => {
  screen.type("Message", "space @");
  await screen.until(() => screen.labelled("Mention something in this file") !== null, 10_000);
  screen.type("Mention something in this file", "x y escape");
  await screen.until(() => screen.labelled("Mention something in this file") === null, 10_000);
  expect(screen.valueOf("Message")).toBe("why @app.eleven.hello.Greeter.shout slow @xy");
}, 30_000);
