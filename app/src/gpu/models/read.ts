import { open } from "node:fs/promises";

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
