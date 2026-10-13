import { useGpuix } from "@gpuix/react";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type ReactElement, type ReactNode, useLayoutEffect, useState } from "react";

import { ASSETS } from "../lib/assets";

type FontHost = { readonly registerFont: (data: Buffer) => void };

function canRegisterFonts(renderer: unknown): renderer is FontHost {
  return typeof renderer === "object" && renderer !== null && "registerFont" in renderer && typeof renderer.registerFont === "function";
}

function registerBundledFonts(host: FontHost): void {
  const dir = join(ASSETS, "fonts");
  for (const file of readdirSync(dir).filter((name) => /\.(ttf|otf)$/i.test(name))) host.registerFont(readFileSync(join(dir, file)));
}

/** Loads the bundled fonts before anything is laid out, so `bun run dev` draws code in JetBrains Mono too. */
export function Fonts({ children }: { readonly children: ReactNode }): ReactElement | null {
  const { renderer } = useGpuix();
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    if (canRegisterFonts(renderer)) registerBundledFonts(renderer);
    setReady(true);
  }, [renderer]);
  return ready ? <>{children}</> : null;
}
