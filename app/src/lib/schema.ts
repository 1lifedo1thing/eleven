import { z } from "zod";

/** A list that keeps the entries `item` accepts and drops the rest, so one damaged entry never loses a saved file. */
export function listOf<T>(item: z.ZodType<T>): z.ZodType<readonly T[]> {
  return z.array(z.unknown()).catch([]).transform((entries) => entries.flatMap((entry) => {
    const parsed = item.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  }));
}

/** A JSON object of text values read as a Map; anything else in it is dropped. */
export const textMap: z.ZodType<ReadonlyMap<string, string>> = z.record(z.string(), z.unknown()).catch({}).transform((record) => {
  const entries = Object.entries(record).flatMap(([key, value]) => (typeof value === "string" ? [[key, value] as const] : []));
  return new Map(entries);
});

/** Reads `json` with `schema`, or gives `fallback` when it doesn't fit. */
export function readOr<T>(schema: z.ZodType<T>, json: unknown, fallback: T): T {
  const parsed = schema.safeParse(json);
  return parsed.success ? parsed.data : fallback;
}
