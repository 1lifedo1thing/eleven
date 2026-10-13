import { expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "eleven-doc-"));
process.env.ELEVEN_SUPPORT = join(root, "support");
process.env.ELEVEN_CACHE = join(root, "cache");
process.env.ELEVEN_PROJECTS_DIR = join(root, "Projects");

const { saveDocument, openDocument, documentPath } = await import("../src/engine/document");
const { openElevenFile, sha256 } = await import("../src/engine/elevenFile");
const { loadProject, saveProject, EMPTY_PROJECT } = await import("../src/engine/project");
const { loadThread, saveThread } = await import("../src/chat/history");
const { prepareTarget } = await import("../src/engine/target");

const binary = join(root, "echo");
copyFileSync("/bin/echo", binary);
const id = sha256(new Uint8Array(readFileSync(binary)));
const target = { original: binary, path: binary, name: "echo", meta: "Mach-O · arm64e", arch: "arm64e", kind: "binary" as const };
const out = join(root, "echo.eleven");
const cached = join(process.env.ELEVEN_CACHE, id, "ghidra", "pseudocode", "entry.c");

test("a project packs into one .eleven file and comes back whole", async () => {
  saveProject(id, { ...EMPTY_PROJECT, names: new Map([["0x100000960", "main_echo"]]) });
  saveThread({ id: "t1", title: "What does it print?", target: binary, project: id, messages: [{ kind: "user", text: "What does it print?", at: 1 }], updatedAt: 1 });
  mkdirSync(join(cached, ".."), { recursive: true });
  writeFileSync(cached, "void entry(void) {\n  puts(argv[1]);\n}\n");
  await saveDocument(target, id, out);

  const file = openElevenFile(out);
  expect(file.manifest.name).toBe("echo");
  expect(file.manifest.binary).toBe(id);
  expect(file.manifest.entries.map((entry) => entry.name).sort()).toEqual(["binary", "cache.json", "chats.json", "project.json"]);
  const packed = file.manifest.entries.find((entry) => entry.name === "binary");
  expect(packed && packed.size < packed.raw).toBe(true);
  file.close();
  expect(documentPath(id)).toBe(out);

  rmSync(process.env.ELEVEN_SUPPORT ?? "", { recursive: true, force: true });
  rmSync(process.env.ELEVEN_CACHE ?? "", { recursive: true, force: true });
  const opened = openDocument(out);
  expect(sha256(new Uint8Array(readFileSync(opened.binary)))).toBe(id);
  expect(loadProject(id).names.get("0x100000960")).toBe("main_echo");
  expect(loadThread("t1")?.title).toBe("What does it print?");
  expect(readFileSync(cached, "utf8")).toContain("puts(argv[1])");
});

test("opening a .eleven file gives a target on the unpacked binary", () => {
  const opened = prepareTarget(out);
  expect(opened.original).toBe(out);
  expect(opened.name).toBe("echo");
  expect(opened.kind).toBe("binary");
  expect(statSync(opened.path).size).toBe(statSync("/bin/echo").size);
});

test("a damaged or foreign file is refused in plain words", () => {
  const bytes = new Uint8Array(readFileSync(out));
  bytes[bytes.length - 10] = (bytes[bytes.length - 10] ?? 0) ^ 0xff;
  const damaged = join(root, "damaged.eleven");
  writeFileSync(damaged, bytes);
  const file = openElevenFile(damaged);
  expect(() => file.entry("binary")).toThrow(/damaged/);
  file.close();
  const foreign = join(root, "notes.eleven");
  writeFileSync(foreign, "hello");
  expect(() => openElevenFile(foreign)).toThrow(/isn't an Eleven project file|cut short/);
});
