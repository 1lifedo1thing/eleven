import { expect, test } from "bun:test";

import { sourcesOf } from "../src/chat/Sources";
import type { Block } from "../src/chat/thread";

const text = (value: string): Block => ({ kind: "text", text: value });

test("sources: markdown links keep their title, bare links show their site", () => {
  const sources = sourcesOf([text("See [Ghidra's docs](https://www.ghidra-sre.org/docs) and https://github.com/NationalSecurityAgency/ghidra.")]);
  expect(sources).toEqual([
    { href: "https://www.ghidra-sre.org/docs", domain: "ghidra-sre.org", title: "Ghidra's docs" },
    { href: "https://github.com/NationalSecurityAgency/ghidra", domain: "github.com", title: null },
  ]);
});

test("sources: a page the agent fetched counts, and a repeat link adds its title once", () => {
  const fetched: Block = { kind: "tool", step: { id: "1", tool: "WebFetch", input: { url: "https://example.com/a" }, output: "", status: "done", startedAt: 0, endedAt: 1 } };
  const sources = sourcesOf([fetched, text("As [the example](https://example.com/a) says, https://example.com/a")]);
  expect(sources).toEqual([{ href: "https://example.com/a", domain: "example.com", title: "the example" }]);
});

test("sources: no links, no sources", () => {
  expect(sourcesOf([text("FUN_100004088 prints usage and exits.")])).toEqual([]);
});
