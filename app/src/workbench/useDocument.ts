import { basename } from "node:path";

import { useGpuix } from "@gpuix/react";
import { useEffect, useRef } from "react";

import { onThreadsChange } from "../chat/history";
import { askSavePath, documentPath, ensureDocument, saveDocument } from "../engine/document";
import type { Target } from "../engine/target";
import { errorMessage } from "../lib/guards";
import { useCommand } from "../lib/shortcuts";
import type { Bench } from "./parts";

const AUTOSAVE_MS = 2000;

/** Opens a file or `.eleven` project in this window: the chat and the workbench move to it together. */
export function useOpenInWorkbench(bench: Bench): (path: string) => void {
  const { chat, openTarget, wb } = bench;
  const { renderer } = useGpuix();
  const open = (path: string): void => {
    try {
      const show = (target: Target): void => {
        if (target.kind === "binary" || target.kind === "app") openTarget(target);
      };
      const target = chat.choose(path, show);
      if (target) show(target);
    } catch (err) {
      wb.notify(`Couldn't open that file. ${errorMessage(err)}`, null);
    }
  };
  useCommand("open", () => {
    void (async (): Promise<void> => {
      const paths = await renderer?.promptForPaths?.({ files: true, directories: true, prompt: "Open" });
      const first = paths?.[0];
      if (first) open(first);
    })();
  });
  return open;
}

/** ⌘S saves the project as a `.eleven` file, asking where the first time; after that it saves itself as you work. */
export function useDocument(bench: Bench): void {
  const { chat, program, wb } = bench;
  const { s } = wb;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ready = program.functions.length > 0 && chat.target !== null;
  const save = async (asking: boolean): Promise<void> => {
    const target = chat.target;
    if (!target || !ready) return;
    const path = documentPath(program.id) ?? (asking ? await askSavePath(program.name) : null);
    if (!path) return;
    try {
      await saveDocument(target, program.id, path);
      if (asking) wb.notify(`Saved ${basename(path)}`, null);
    } catch (err) {
      wb.notify(`Couldn't save the project. ${errorMessage(err)}`, null);
    }
  };
  const later = (): void => {
    if (!ready || !documentPath(program.id)) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void save(false);
    }, AUTOSAVE_MS);
  };
  useCommand("save", () => void save(true));
  useEffect(() => {
    const target = chat.target;
    if (!ready || !target || documentPath(program.id)) return;
    void ensureDocument(target, program.id).catch((err: unknown) => wb.notify(`Couldn't create the project file. ${errorMessage(err)}`, null));
  }, [ready, program.id]);
  useEffect(later, [s.names, s.bookmarks, s.notes, s.comments, s.colors, s.groups]);
  useEffect(() => onThreadsChange(later), [program.id, ready]);
  const flush = useRef(save);
  flush.current = save;
  useEffect(() => () => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    void flush.current(false);
  }, []);
}
