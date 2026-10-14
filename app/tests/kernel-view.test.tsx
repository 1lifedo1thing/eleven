import { afterAll, beforeAll, expect, test } from "bun:test";
import { join } from "node:path";

import { openMenuEntries } from "../src/components/ContextMenu";
import { prepareTarget } from "../src/engine/target";
import { Screen } from "./harness";

let screen: Screen;

beforeAll(() => {
  screen = new Screen().workbench(prepareTarget(join(import.meta.dir, "fixtures", "gpu", "acc.fatbin")));
}, 30_000);

afterAll(() => screen.unmount());

test("a CUDA kernel opens on its highlighted PTX with View as and Explain above it, and its lines can be asked about", async () => {
  await screen.until(() => screen.text().includes("acc_f32"), 60_000);
  const row = screen.ui.renderer.findByText("acc_f32");
  if (!row) throw new Error("no acc_f32 row");
  const box = screen.ui.renderer.getElementBounds(row.id);
  if (!box) throw new Error("acc_f32 has no box");
  screen.ui.renderer.nativeSimulateClick(box.x + box.width / 2, box.y + box.height / 2, 1);
  await screen.until(() => screen.text().includes("ld.param.u64"), 30_000);
  expect(screen.labelled("View as PTX")).not.toBeNull();
  expect(screen.text()).toContain("Explain");
  const line = screen.labelled("Line 22");
  const at = line === null ? null : screen.ui.renderer.getElementBounds(line);
  if (!at) throw new Error("no line 22");
  screen.ui.renderer.nativeSimulateClick(at.x + 30, at.y + at.height / 2, 0);
  screen.ui.renderer.dispatchNativeEvents();
  screen.ui.renderer.flush();
  await screen.until(() => screen.labelled("Ask about the selection") !== null, 5_000);
  screen.clickLabel("View as PTX");
  const menu = openMenuEntries();
  expect(menu.flatMap((entry) => (entry.kind === "action" ? [entry.label] : []))).toEqual(["PTX", "CUDA C++", "HIP C++", "Metal"]);
}, 120_000);
