import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const ICON_DIR = join(homedir(), "Library", "Caches", "eleven", "icons");
const SIZE = 256;

const DRAW_ICON = `ObjC.import('AppKit');
function run(argv) {
  const img = $.NSWorkspace.sharedWorkspace.iconForFile(argv[0]);
  const rep = $.NSBitmapImageRep.alloc.initWithBitmapDataPlanesPixelsWidePixelsHighBitsPerSampleSamplesPerPixelHasAlphaIsPlanarColorSpaceNameBytesPerRowBitsPerPixel(null, ${SIZE}, ${SIZE}, 8, 4, true, false, $.NSDeviceRGBColorSpace, 0, 0);
  $.NSGraphicsContext.saveGraphicsState;
  $.NSGraphicsContext.setCurrentContext($.NSGraphicsContext.graphicsContextWithBitmapImageRep(rep));
  img.drawInRectFromRectOperationFraction($.NSMakeRect(0, 0, ${SIZE}, ${SIZE}), $.NSZeroRect, $.NSCompositingOperationSourceOver, 1);
  $.NSGraphicsContext.restoreGraphicsState;
  rep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $()).writeToFileAtomically(argv[1], true);
}`;

const pending = new Map<string, Promise<string | null>>();

function cachedPng(source: string): string {
  return join(ICON_DIR, `${createHash("sha1").update(source).digest("hex").slice(0, 16)}.png`);
}

async function render(source: string, out: string): Promise<string | null> {
  try {
    mkdirSync(ICON_DIR, { recursive: true });
    if (/\.(ico|icns|png)$/i.test(source)) await run("sips", ["-s", "format", "png", "-Z", String(SIZE), source, "--out", out]);
    else await run("osascript", ["-l", "JavaScript", "-e", DRAW_ICON, source, out]);
    return existsSync(out) ? out : null;
  } catch {
    return null;
  }
}

/** A PNG of the icon Finder shows for a path (an app's own icon, the exec icon for a tool), or of an .ico/.icns file, cached on disk. */
export function fileIcon(source: string): Promise<string | null> {
  const out = cachedPng(source);
  if (existsSync(out)) return Promise.resolve(out);
  const known = pending.get(out);
  if (known) return known;
  const made = render(source, out);
  pending.set(out, made);
  return made;
}
