import "./fixtures/isolate";
import { beforeAll, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { adoptToolchain } from "../src/engine/toolchain";
import { binaryInfoOf, readBinaryInfo } from "../src/engine/binaryInfo";
import { prepareTarget } from "../src/engine/target";

function ghidraFile(...parts: readonly string[]): string {
  const dir = join(process.env.GHIDRA_INSTALL_DIR ?? "", ...parts.slice(0, -1));
  const want = parts.at(-1) ?? "";
  const file = existsSync(dir) ? readdirSync(dir).find((name) => name.startsWith(want)) : undefined;
  if (!file) throw new Error(`nothing like ${want} in ${dir}`);
  return join(dir, file);
}

beforeAll(() => adoptToolchain());

test("binary info: a universal Mach-O lists the same slices lipo does, and a slice copies out byte for byte", () => {
  const info = binaryInfoOf("/bin/ls", statSync("/bin/ls").size);
  expect(info.format).toBe("Mach-O");
  expect(info.slices.map((s) => s.arch).sort()).toEqual(execFileSync("lipo", ["-archs", "/bin/ls"], { encoding: "utf8" }).trim().split(/\s+/).sort());
  const target = prepareTarget("/bin/ls");
  expect(target.arch).toBe("arm64e");
  expect(target.meta).toBe("Mach-O · universal · 2 slices");
  const thinned = join(process.env.ELEVEN_SUPPORT ?? "", "lipo-ls");
  execFileSync("lipo", ["/bin/ls", "-thin", "arm64e", "-output", thinned]);
  expect(readFileSync(target.path).equals(readFileSync(thinned))).toBe(true);
});

test("binary info: ELF and PE files report their format and CPU", () => {
  const elf = ghidraFile("GPL", "DemanglerGnu", "os", "linux_x86_64", "demangler_gnu_v2_41");
  expect(binaryInfoOf(elf, statSync(elf).size)).toMatchObject({ format: "ELF", slices: [{ arch: "x86_64" }] });
  const pe = ghidraFile("GPL", "DemanglerGnu", "os", "win_x86_64", "demangler_gnu_v2_41");
  expect(binaryInfoOf(pe, statSync(pe).size)).toMatchObject({ format: "PE", slices: [{ arch: "x86_64" }] });
  expect(prepareTarget(pe).meta).toBe("PE · x86_64");
});

test("binary info: a Java class file is not mistaken for a universal binary", () => {
  const head = Buffer.from([0xca, 0xfe, 0xba, 0xbe, 0x00, 0x00, 0x00, 0x41]);
  expect(readBinaryInfo(head, 8).format).toBe("File");
});
