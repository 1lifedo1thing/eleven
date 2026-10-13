import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

function assetsDir(): string {
  const bundled = join(dirname(process.execPath), "..", "Resources", "assets");
  return existsSync(bundled) ? bundled : join(import.meta.dir, "..", "..", "assets");
}

export const ASSETS = assetsDir();
