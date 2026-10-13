import { open } from "node:fs/promises";

import type { ModelTensor, TypeShare } from "../types";

/** Reads at most `limit` bytes from the start of a file, so multi-gigabyte weights open in milliseconds. */
export async function head(path: string, limit: number): Promise<Buffer> {
  const file = await open(path, "r");
  try {
    const { size } = await file.stat();
    const buffer = Buffer.alloc(Math.min(size, limit));
    await file.read(buffer, 0, buffer.length, 0);
    return buffer;
  } finally {
    await file.close();
  }
}

export function bytes(size: number): string {
  if (size >= 1e9) return `${(size / 1e9).toFixed(1)} GB`;
  if (size >= 1e6) return `${(size / 1e6).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1e3))} KB`;
}

export function count(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

/** The file's weight types, largest share first. */
export function mixOf(tensors: readonly ModelTensor[]): readonly TypeShare[] {
  const shares = new Map<string, TypeShare>();
  for (const t of tensors) {
    const was = shares.get(t.type) ?? { type: t.type, bytes: 0, tensors: 0 };
    shares.set(t.type, { type: t.type, bytes: was.bytes + t.bytes, tensors: was.tensors + 1 });
  }
  return [...shares.values()].sort((a, b) => b.bytes - a.bytes);
}

/** "Mostly Q5_0 and Q8_0" for a mixed file, the type alone when one dominates. */
export function mixSummary(mix: readonly TypeShare[]): string {
  const total = mix.reduce((sum, m) => sum + m.bytes, 0);
  const [first, second] = mix;
  if (!first) return "no tensors";
  if (!second || first.bytes / Math.max(total, 1) > 0.9) return first.type;
  return `mostly ${first.type} and ${second.type}`;
}
