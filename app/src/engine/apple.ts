import { createHash } from "node:crypto";
import { closeSync, mkdirSync, mkdtempSync, openSync, readdirSync, readSync, rmSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { type ApkFiles, entries } from "./apk";
import { cacheRoot, OS, zipExtract } from "../lib/platform";
import { run, runSync } from "../lib/process";

const LC_ENCRYPTION_INFO = 0x21;
const LC_ENCRYPTION_INFO_64 = 0x2c;
const MAX_COMMANDS = 1 << 20;

function cacheDir(kind: string, path: string): string {
  const { size, mtimeMs } = statSync(path);
  return join(cacheRoot(), kind, createHash("sha256").update(`${path}:${size}:${mtimeMs}`).digest("hex").slice(0, 16));
}

function appIn(dir: string): string | null {
  try {
    const name = readdirSync(dir).find((entry) => entry.endsWith(".app") && !entry.startsWith("."));
    return name ? join(dir, name) : null;
  } catch {
    return null;
  }
}

/** An iOS app bundle (.ipa): its Payload unpacked once into the cache, then the .app inside it; null for anything else. */
export function unpackIpa(path: string): string | null {
  if (!path.toLowerCase().endsWith(".ipa")) return null;
  if (!entries(path).some((entry) => /^Payload\/[^/]+\.app\//.test(entry))) return null;
  const dir = cacheDir("ipa", path);
  const done = join(dir, "Payload");
  if (!appIn(done)) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const [command, args] = zipExtract(path, "Payload/*", dir);
    runSync(command, args, { maxBuffer: 64 << 20 });
  }
  return appIn(done);
}

function firstApp(dir: string, depth: number): string | null {
  const found = appIn(dir);
  if (found || depth === 0) return found;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const nested = firstApp(join(dir, entry.name), depth - 1);
    if (nested) return nested;
  }
  return null;
}

/** A disk image (.dmg, macOS only): mounted read-only, its app copied into the cache, then unmounted; null when it holds no app. */
export function unpackDmg(path: string): string | null {
  if (!path.toLowerCase().endsWith(".dmg") || OS !== "mac") return null;
  const dir = cacheDir("dmg", path);
  const cached = appIn(dir);
  if (cached) return cached;
  const mount = mkdtempSync(join(tmpdir(), "eleven-dmg-"));
  try {
    runSync("hdiutil", ["attach", "-readonly", "-nobrowse", "-noautoopen", "-mountpoint", mount, path], { input: "Y\n", maxBuffer: 16 << 20 });
    const app = firstApp(mount, 1);
    if (!app) return null;
    mkdirSync(dir, { recursive: true });
    const copy = join(dir, app.slice(app.lastIndexOf("/") + 1));
    runSync("ditto", [app, copy]);
    return copy;
  } finally {
    try {
      runSync("hdiutil", ["detach", mount, "-force", "-quiet"]);
    } catch {
      // nothing was mounted
    }
    rmSync(mount, { recursive: true, force: true });
  }
}

/** True when a thin Mach-O's code is still encrypted by the App Store (FairPlay), so it reads as noise until decrypted. */
export function isAppStoreEncrypted(path: string): boolean {
  const fd = openSync(path, "r");
  try {
    const header = Buffer.alloc(32);
    if (readSync(fd, header, 0, 32, 0) < 28) return false;
    const magic = header.readUInt32LE(0);
    if (magic !== 0xfeedfacf && magic !== 0xfeedface) return false;
    const start = magic === 0xfeedfacf ? 32 : 28;
    const count = header.readUInt32LE(16);
    const size = Math.min(header.readUInt32LE(20), MAX_COMMANDS);
    const commands = Buffer.alloc(size);
    const read = readSync(fd, commands, 0, size, start);
    let at = 0;
    for (let ix = 0; ix < count && at + 8 <= read; ix++) {
      const cmd = commands.readUInt32LE(at);
      const cmdSize = commands.readUInt32LE(at + 4);
      if ((cmd === LC_ENCRYPTION_INFO || cmd === LC_ENCRYPTION_INFO_64) && at + 20 <= read) return commands.readUInt32LE(at + 16) !== 0;
      if (cmdSize < 8) return false;
      at += cmdSize;
    }
    return false;
  } finally {
    closeSync(fd);
  }
}


/** Every file in an app bundle (plists, frameworks, assets, the game data), each read straight from the bundle. */
export async function bundleFiles(app: string): Promise<ApkFiles> {
  const found = await readdir(app, { recursive: true, withFileTypes: true });
  const files = found
    .filter((entry) => entry.isFile())
    .map((entry) => relative(app, join(entry.parentPath, entry.name)).replaceAll("\\", "/"))
    .sort((a, b) => a.localeCompare(b));
  return { files, local: async (file) => join(app, file) };
}

/** A binary property list as readable XML (macOS only); null when it can't be converted. */
export async function plistXml(path: string): Promise<string | null> {
  if (OS !== "mac") return null;
  try {
    return (await run("plutil", ["-convert", "xml1", "-o", "-", path], { maxBuffer: 64 << 20 })).stdout;
  } catch {
    return null;
  }
}
