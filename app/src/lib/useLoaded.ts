import { useEffect, useState } from "react";

import { errorMessage } from "./guards";

export type Loaded<T> =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly value: T }
  | { readonly kind: "failed"; readonly message: string };

/** Runs `load` whenever `key` changes and ignores results that arrive after the key moved on. */
export function useLoaded<T>(load: () => Promise<T>, key: string): Loaded<T> {
  const [state, setState] = useState<{ readonly key: string; readonly value: Loaded<T> }>({ key, value: { kind: "loading" } });
  useEffect(() => {
    let live = true;
    setState({ key, value: { kind: "loading" } });
    const run = async (): Promise<void> => {
      try {
        const value = await load();
        if (live) setState({ key, value: { kind: "ready", value } });
      } catch (err) {
        if (live) setState({ key, value: { kind: "failed", message: errorMessage(err) } });
      }
    };
    void run();
    return () => {
      live = false;
    };
  }, [key]);
  return state.key === key ? state.value : { kind: "loading" };
}
