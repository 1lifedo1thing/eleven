import { expect, test } from "bun:test";

import { centerOn, fitCamera, MAX_ZOOM, MIN_ZOOM, panBy, visibleRect, zoomAt } from "../src/workbench/camera";

const box = { width: 800, height: 600 };

test("zoom keeps the point under the pointer still", () => {
  const camera = { x: 100, y: 50, zoom: 1 };
  const zoomed = zoomAt(camera, 2, 300, 250);
  const before = { x: (300 - camera.x) / camera.zoom, y: (250 - camera.y) / camera.zoom };
  const after = { x: (300 - zoomed.x) / zoomed.zoom, y: (250 - zoomed.y) / zoomed.zoom };
  expect(zoomed.zoom).toBe(2);
  expect(after).toEqual(before);
});

test("zoom stops at its limits", () => {
  expect(zoomAt({ x: 0, y: 0, zoom: 1 }, 100, 0, 0).zoom).toBe(MAX_ZOOM);
  expect(zoomAt({ x: 0, y: 0, zoom: 1 }, 0.001, 0, 0).zoom).toBe(MIN_ZOOM);
});

test("fit shows a small graph at 100% in the middle, and shrinks a wide one", () => {
  expect(fitCamera({ width: 400, height: 200 }, box)).toEqual({ zoom: 1, x: 200, y: 200 });
  const wide = fitCamera({ width: 3000, height: 400 }, box);
  expect(wide.zoom).toBeCloseTo((800 - 48) / 3000);
  expect(wide.x + 3000 * wide.zoom / 2).toBeCloseTo(400);
});

test("a tall graph fits from its top so the entry block shows", () => {
  const tall = fitCamera({ width: 300, height: 40_000 }, box);
  expect(tall.zoom).toBe(MIN_ZOOM);
  expect(tall.y).toBe(24);
});

test("pan, center and the visible rect agree", () => {
  const moved = panBy({ x: 0, y: 0, zoom: 2 }, -50, 30);
  expect(moved).toEqual({ x: -50, y: 30, zoom: 2 });
  const centered = centerOn(moved, 500, 400, box);
  const seen = visibleRect(centered, box);
  expect(seen.x + seen.width / 2).toBeCloseTo(500);
  expect(seen.y + seen.height / 2).toBeCloseTo(400);
});
