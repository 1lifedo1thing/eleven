import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Imported first, so everything after it saves projects and settings to a throwaway dir. */
process.env.ELEVEN_SUPPORT = mkdtempSync(join(tmpdir(), "eleven-support-"));
process.env.ELEVEN_NO_PREWARM = "1";
