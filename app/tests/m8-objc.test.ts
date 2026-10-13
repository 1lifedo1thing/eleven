import { expect, test } from "bun:test";

import { objcInventory } from "../src/workbench/export";

test("M8: the Objective-C inventory lists classes and protocols with their addresses", () => {
  const text = objcInventory(
    "Example",
    [
      { address: "0x1000", name: "AppDelegate" },
      { address: "0x1040", name: "ViewController" },
    ],
    [{ address: "0x2000", name: "NSApplicationDelegate" }],
  );
  expect(text).toContain("// Objective-C in Example: 2 classes, 1 protocols");
  expect(text).toContain("  0x1000  AppDelegate");
  expect(text).toContain("  0x1040  ViewController");
  expect(text).toContain("  0x2000  NSApplicationDelegate");
});

test("M8: a binary with no Objective-C reads as an empty inventory, not an error", () => {
  const text = objcInventory("Plain", [], []);
  expect(text).toContain("0 classes, 0 protocols");
  expect(text).toContain("Classes\n  none");
  expect(text).toContain("Protocols\n  none");
});
