#!/usr/bin/env node
// Downloads the latest Eleven release for this Mac, puts it in Applications and opens it.
import { execFileSync } from "node:child_process";
import { accessSync, constants, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const REPO = process.env.ELEVEN_REPO ?? "Zfinix/eleven";
const arch = process.arch === "arm64" ? "arm64" : "x86_64";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function writable(dir) {
  try {
    accessSync(dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

if (process.platform !== "darwin") fail("Eleven runs on macOS for now.");

const release = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: "application/vnd.github+json" } });
if (!release.ok) fail("Couldn't reach GitHub to find the latest Eleven. Check your connection, then try again.");
const { assets = [], tag_name: tag = "" } = await release.json();
const asset = assets.find((a) => a.name.endsWith(`-${arch}.zip`));
if (!asset) fail(`There is no Eleven build for this Mac (${arch}) yet.`);

console.log(`Downloading Eleven ${tag}…`);
const zip = await fetch(asset.browser_download_url);
if (!zip.ok) fail("The download stopped. Check your connection, then try again.");
const tmp = mkdtempSync(join(tmpdir(), "eleven-"));
const file = join(tmp, asset.name);
writeFileSync(file, Buffer.from(await zip.arrayBuffer()));

const dest = writable("/Applications") ? "/Applications" : join(homedir(), "Applications");
execFileSync("mkdir", ["-p", dest]);
rmSync(join(dest, "Eleven.app"), { recursive: true, force: true });
execFileSync("ditto", ["-x", "-k", file, dest]);
rmSync(tmp, { recursive: true, force: true });

console.log(`Installed to ${dest}/Eleven.app. Opening it now.`);
execFileSync("open", [join(dest, "Eleven.app")]);
