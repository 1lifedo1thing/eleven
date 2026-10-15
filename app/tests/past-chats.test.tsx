import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ReactElement } from "react";

process.env.ELEVEN_SUPPORT = mkdtempSync(join(tmpdir(), "eleven-past-"));

const { PastChat } = await import("../src/workbench/Dock");
const { DARK, ThemeContext } = await import("../src/theme");
const { Screen } = await import("./harness");

const deleted: string[] = [];
const opened: string[] = [];
const summary = { id: "old-chat", title: "Where is the equals key handled", target: null, project: null, updatedAt: 1 };

function Row(): ReactElement {
  return (
    <ThemeContext.Provider value={{ p: DARK, appearance: "Dark", setAppearance: () => {} }}>
      <PastChat summary={summary} when="2d" onOpen={() => opened.push(summary.id)} onDelete={() => deleted.push(summary.id)} />
    </ThemeContext.Provider>
  );
}

const screen = new Screen().render(<Row />);

test("past chats: hovering a chat shows Delete, which asks once before deleting", async () => {
  await screen.until(() => screen.labelled(summary.title) !== null, 10_000);
  expect(screen.labelled("Delete chat")).toBeNull();
  const id = screen.labelled(summary.title);
  const box = id === null ? null : screen.ui.renderer.getElementBounds(id);
  if (!box) throw new Error("the chat row has no box");
  screen.ui.renderer.nativeSimulateMouseMove(box.x + box.width / 2, box.y + box.height / 2);
  await screen.until(() => screen.labelled("Delete chat") !== null, 5_000);
  screen.clickLabel("Delete chat");
  await screen.until(() => screen.labelled(`Delete ${summary.title}`) !== null, 5_000);
  expect(deleted).toEqual([]);
  screen.clickLabel(`Delete ${summary.title}`);
  await screen.until(() => deleted.length === 1, 5_000);
  expect(deleted).toEqual(["old-chat"]);
  expect(opened).toEqual([]);
}, 60_000);
