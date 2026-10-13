/** Where the graph canvas looks: the graph's top-left on screen, and how much it is scaled. */
export type Camera = { readonly x: number; readonly y: number; readonly zoom: number };

export type Size = { readonly width: number; readonly height: number };

export const MIN_ZOOM = 0.15;
export const MAX_ZOOM = 2.5;
const FIT_MARGIN = 24;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Scales by `factor` while keeping the graph point under (px, py) in place, like a map. */
export function zoomAt(camera: Camera, factor: number, px: number, py: number): Camera {
  const zoom = clampZoom(camera.zoom * factor);
  const k = zoom / camera.zoom;
  return { zoom, x: px - (px - camera.x) * k, y: py - (py - camera.y) * k };
}

/** Moves the view by a scroll or drag delta, in screen pixels. */
export function panBy(camera: Camera, dx: number, dy: number): Camera {
  return { ...camera, x: camera.x + dx, y: camera.y + dy };
}

/** The whole graph in view, never zoomed past 100%; a tall graph starts at its top so the entry is visible. */
export function fitCamera(content: Size, box: Size): Camera {
  const zoom = clampZoom(Math.min(1, (box.width - FIT_MARGIN * 2) / content.width, (box.height - FIT_MARGIN * 2) / content.height));
  const height = content.height * zoom;
  return { zoom, x: (box.width - content.width * zoom) / 2, y: height < box.height ? (box.height - height) / 2 : FIT_MARGIN };
}

/** Puts graph point (gx, gy) in the middle of the box. */
export function centerOn(camera: Camera, gx: number, gy: number, box: Size): Camera {
  return { ...camera, x: box.width / 2 - gx * camera.zoom, y: box.height / 2 - gy * camera.zoom };
}

/** The part of the graph on screen, in graph coordinates. */
export function visibleRect(camera: Camera, box: Size): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } {
  return { x: -camera.x / camera.zoom, y: -camera.y / camera.zoom, width: box.width / camera.zoom, height: box.height / camera.zoom };
}
