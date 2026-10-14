import type { useGpuix } from "@gpuix/react";

import { OS } from "./platform";

type Renderer = ReturnType<typeof useGpuix>["renderer"];

/** Asks for one file to open. Only macOS can offer files and folders (like .app bundles) in the same dialog. */
export async function pickToOpen(renderer: Renderer, prompt: string): Promise<string | null> {
  const paths = await renderer?.promptForPaths?.({ files: true, directories: OS === "mac", prompt });
  return paths?.[0] ?? null;
}
