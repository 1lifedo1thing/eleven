import { type PublicInstance, useGpuix, useWindowSize } from "@gpuix/react";
import { type RefObject, useEffect, useRef, useState } from "react";

export type Size = { readonly width: number; readonly height: number };

/** The laid-out size of the element `ref` is put on, re-read after each render and window resize. */
export function useSize(): { readonly ref: RefObject<PublicInstance | null> } & Size {
  const { renderer } = useGpuix();
  const ref = useRef<PublicInstance | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  useWindowSize();
  useEffect(() => {
    const timer = setTimeout(() => {
      const id = ref.current?.id;
      const box = id === undefined ? null : renderer?.getElementBounds?.(id);
      if (!box) return;
      const next = { width: Math.round(box.width), height: Math.round(box.height) };
      if (next.width !== size.width || next.height !== size.height) setSize(next);
    }, 32);
    return () => clearTimeout(timer);
  });
  return { ref, ...size };
}
