import "./fixtures/isolate";
import { expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resourceKind } from "../src/engine/apk";
import { bundleFiles, isAppStoreEncrypted, plistXml } from "../src/engine/apple";
import { bundleOf, prepareTarget } from "../src/engine/target";
import { OS } from "../src/lib/platform";
import { runSync } from "../src/lib/process";

const PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict><key>CFBundleExecutable</key><string>Hello</string></dict></plist>`;

function thinMachO(cryptid: number | null): Buffer {
  const command = Buffer.alloc(24);
  command.writeUInt32LE(0x2c, 0);
  command.writeUInt32LE(24, 4);
  command.writeUInt32LE(cryptid ?? 0, 16);
  const header = Buffer.alloc(32);
  header.writeUInt32LE(0xfeedfacf, 0);
  header.writeUInt32LE(0x0100000c, 4);
  header.writeUInt32LE(cryptid === null ? 0 : 1, 16);
  header.writeUInt32LE(cryptid === null ? 0 : 24, 20);
  return Buffer.concat([header, cryptid === null ? Buffer.alloc(0) : command, Buffer.alloc(64)]);
}

function iosApp(parent: string, cryptid: number | null = 1): string {
  const app = join(parent, "Hello.app");
  mkdirSync(app, { recursive: true });
  writeFileSync(join(app, "Info.plist"), PLIST);
  writeFileSync(join(app, "Hello"), thinMachO(cryptid));
  return app;
}

test("the App Store encryption flag is read from the load commands", () => {
  const dir = mkdtempSync(join(tmpdir(), "eleven-crypt-"));
  const files = [thinMachO(1), thinMachO(0), thinMachO(null)].map((bytes, ix) => {
    const file = join(dir, `bin${ix}`);
    writeFileSync(file, bytes);
    return file;
  });
  expect(files.map(isAppStoreEncrypted)).toEqual([true, false, false]);
});

test("an iOS .app opens its executable from the top of the bundle", () => {
  const target = prepareTarget(iosApp(mkdtempSync(join(tmpdir(), "eleven-ios-"))));
  expect(target.kind).toBe("app");
  expect(target.path.endsWith(join("Hello.app", "Hello"))).toBe(true);
  expect(target.arch).toBe("arm64");
  expect(target.meta).toBe("Mach-O · arm64 · encrypted by the App Store");
});

test("an iPad app installed on a Mac opens the bundle inside Wrapper", () => {
  const outer = join(mkdtempSync(join(tmpdir(), "eleven-wrap-")), "Hello.app");
  iosApp(join(outer, "Wrapper"), 0);
  const target = prepareTarget(outer);
  expect(target.path).toBe(join(outer, "Wrapper", "Hello.app", "Hello"));
  expect(target.meta).toBe("Mach-O · arm64");
});

test("an .ipa unpacks its Payload once and opens the app inside", () => {
  const work = mkdtempSync(join(tmpdir(), "eleven-ipa-"));
  iosApp(join(work, "Payload"));
  const ipa = join(mkdtempSync(join(tmpdir(), "eleven-ipa-out-")), "Hello.ipa");
  runSync("zip", ["-q", "-r", ipa, "Payload"], { cwd: work });
  const first = prepareTarget(ipa);
  expect(first.original).toBe(ipa);
  expect(first.kind).toBe("app");
  expect(first.path.endsWith(join("Payload", "Hello.app", "Hello"))).toBe(true);
  expect(first.meta).toContain("encrypted by the App Store");
  expect(prepareTarget(ipa).path).toBe(first.path);
});

test.if(OS === "mac")("a .dmg is mounted, its app copied out, and opened like any app", () => {
  const work = mkdtempSync(join(tmpdir(), "eleven-dmg-src-"));
  const app = join(work, "Tool.app");
  mkdirSync(join(app, "Contents", "MacOS"), { recursive: true });
  writeFileSync(join(app, "Contents", "Info.plist"), PLIST.replace("Hello", "Tool"));
  copyFileSync("/usr/bin/true", join(app, "Contents", "MacOS", "Tool"));
  const dmg = join(mkdtempSync(join(tmpdir(), "eleven-dmg-")), "Tool.dmg");
  runSync("hdiutil", ["create", "-quiet", "-fs", "HFS+", "-srcfolder", work, "-volname", "Tool", dmg]);
  const target = prepareTarget(dmg);
  expect(target.kind).toBe("app");
  expect(target.original).toBe(dmg);
  expect(target.arch).toMatch(/^arm64e?$|^x86_64$/);
  expect(target.meta).toContain("Mach-O");
  expect(runSync("hdiutil", ["info"])).not.toContain(dmg);
}, 60_000);

test("an app's files are all listed, frameworks open as native code, and binary plists read as XML", async () => {
  const work = mkdtempSync(join(tmpdir(), "eleven-files-"));
  const app = iosApp(join(work, "Payload"));
  mkdirSync(join(app, "Frameworks", "Game.framework"), { recursive: true });
  writeFileSync(join(app, "Frameworks", "Game.framework", "Game"), thinMachO(1));
  mkdirSync(join(app, "Data"), { recursive: true });
  writeFileSync(join(app, "Data", "level.json"), "{}");
  const ipa = join(mkdtempSync(join(tmpdir(), "eleven-files-out-")), "Hello.ipa");
  runSync("zip", ["-q", "-r", ipa, "Payload"], { cwd: work });
  const bundle = bundleOf(prepareTarget(ipa));
  expect(bundle?.endsWith("Hello.app")).toBe(true);
  const files = await bundleFiles(bundle ?? "");
  expect(files.files).toEqual(["Data/level.json", "Frameworks/Game.framework/Game", "Hello", "Info.plist"]);
  expect(resourceKind("Frameworks/Game.framework/Game", thinMachO(1))).toBe("native");
  expect(resourceKind("Foo.class", Buffer.from([0xca, 0xfe, 0xba, 0xbe, 0, 0, 0, 0x34]))).toBe("binary");
  expect(bundleOf(prepareTarget(join(app, "Hello")))).toBeNull();
  if (OS !== "mac") return;
  const binary = join(work, "binary.plist");
  runSync("plutil", ["-convert", "binary1", "-o", binary, join(app, "Info.plist")]);
  expect(await plistXml(binary)).toContain("<string>Hello</string>");
});
