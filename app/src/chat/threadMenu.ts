import type { MenuEntry } from "../components/ContextMenu";
import type { Chat } from "./useChat";
import { copyText } from "./useThread";

/** What you can do with a saved thread, from either sidebar. Deleting asks once more in a submenu. */
export function threadMenu(chat: Chat, id: string, title: string, onRename: () => void, onOpen: () => void): readonly MenuEntry[] {
  return [
    { kind: "action", label: "Open", icon: "thread", run: onOpen },
    { kind: "action", label: "Rename", icon: "rename", run: onRename },
    { kind: "action", label: "Copy title", icon: "copy", run: () => copyText(title) },
    { kind: "separator" },
    { kind: "action", label: "New chat", icon: "new", run: chat.thread.reset },
    { kind: "separator" },
    {
      kind: "submenu",
      label: "Delete",
      icon: "close",
      items: [{
        kind: "action",
        label: `Delete "${title}" for good`,
        run: () => chat.deleteChats([id]),
      }],
    },
  ];
}
