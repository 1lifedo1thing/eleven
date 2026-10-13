import { type PublicInstance, useGpuix } from "@gpuix/react";
import { type RefObject, useEffect, useRef, useState } from "react";

export type Size = { readonly width: number; readonly height: number };

/** GPUI draws no dashed borders, so a dashed edge is an SVG the size of the painted box. */
export function dashedOutline({ width, height }: Size, radius: number, stroke: number, dash: string): string {
  const inset = stroke / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" stroke="black" stroke-width="${stroke}" stroke-dasharray="${dash}"><rect x="${inset}" y="${inset}" width="${width - stroke}" height="${height - stroke}" rx="${radius - inset}"/></svg>`;
}

/** The painted size of an element, read again after every render until it settles. */
export function usePaintedSize(): { readonly ref: RefObject<PublicInstance | null>; readonly size: Size | null } {
  const { renderer } = useGpuix();
  const ref = useRef<PublicInstance | null>(null);
  const [size, setSize] = useState<Size | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const measure = (tries: number): void => {
      const id = ref.current?.id;
      const box = id === undefined ? null : (renderer?.getElementBounds?.(id) ?? null);
      if (box) setSize((last) => (last && last.width === box.width && last.height === box.height ? last : { width: box.width, height: box.height }));
      if (tries > 0) timer = setTimeout(() => measure(tries - 1), 32);
    };
    measure(4);
    return () => {
      if (timer) clearTimeout(timer);
    };
  });
  return { ref, size };
}
