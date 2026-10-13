import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ReactElement, useState } from "react";

import type { Chat } from "../src/chat/useChat";
import type { Target } from "../src/engine/target";

process.env.ELEVEN_SUPPORT = mkdtempSync(join(tmpdir(), "eleven-clear-"));

const { listThreads, saveThread } = await import("../src/chat/history");
const { useChat } = await import("../src/chat/useChat");
const { Sidebar } = await import("../src/home/Sidebar");
const { DARK, ThemeContext } = await import("../src/theme");
const { Screen } = await import("./harness");

for (const id of ["first-chat", "second-chat", "third-chat"]) {
  saveThread({ id, title: id, target: null, project: null, messages: [{ kind: "user", text: id, at: 1 }], updatedAt: 1 });
}

let chat: Chat | null = null;

function Home(): ReactElement {
  const [target, setTarget] = useState<Target | null>(null);
  const live = useChat(target, setTarget);
  chat = live;
  const none = (): void => {};
  return (
    <ThemeContext.Provider value={{ p: DARK, appearance: "Dark", setAppearance: none }}>
      <Sidebar projects={live.projects} project={live.project} chats={live.allChats} threads={live.saved} current={live.thread.id} running={new Set()} activity={null} onNewThread={none} onOpen={none} onOpenProject={none} onSeeAll={none} onOpenThread={live.openThread} onClearChats={live.deleteChats} menu={{ onSettings: none, onSetup: none, onWhatsNew: none }} threadMenu={() => []} />
    </ThemeContext.Provider>
  );
}

const screen = new Screen().render(<Home />);

function hover(label: string): void {
  const id = screen.labelled(label);
  if (id === null) throw new Error(`nothing labelled "${label}"`);
  const box = screen.ui.renderer.getElementBounds(id);
  if (!box) throw new Error(`"${label}" has no box`);
  screen.ui.renderer.nativeSimulateMouseMove(box.x + box.width / 2, box.y + box.height / 2);
}

test("clear chats: Clear all shows on hover, asks once, then deletes every chat for good", async () => {
  await screen.until(() => screen.labelled("first-chat") !== null, 10_000);
  expect(screen.labelled("Clear all")).toBeNull();
  chat?.openThread("second-chat");
  await screen.until(() => chat?.thread.id === "second-chat", 5_000);
  hover("first-chat");
  await screen.until(() => screen.labelled("Clear all") !== null, 5_000);
  screen.clickLabel("Clear all");
  await screen.until(() => screen.labelled("Delete 3 chats?") !== null, 5_000);
  expect(listThreads()).toHaveLength(3);
  screen.clickLabel("Delete 3 chats?");
  await screen.until(() => screen.text().includes("No chats yet"), 5_000);
  expect(listThreads()).toHaveLength(0);
  expect(chat?.thread.id).not.toBe("second-chat");
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(listThreads()).toHaveLength(0);
}, 60_000);
