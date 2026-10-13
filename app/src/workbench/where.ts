import type { TableRow } from "./model";
import type { Bench } from "./parts";
import type { Subject } from "./subject";

/** The address a selection points at, if it points at one. */
export function subjectAddr(subject: Subject | null): string | null {
  if (!subject) return null;
  switch (subject.kind) {
    case "function":
    case "bytes":
    case "string":
      return subject.addr;
    case "line":
      return subject.addr;
    case "block":
      return subject.start;
    case "import":
    case "segment":
    case "tab":
      return null;
    default: {
      const unhandled: never = subject;
      return unhandled;
    }
  }
}

/** The segment whose range holds `addr`, from the segment rows (name, "start-end"). */
export function segmentOf(segments: readonly TableRow[], addr: string): string | null {
  const at = Number.parseInt(addr, 16);
  if (Number.isNaN(at)) return null;
  const found = segments.find((row) => {
    const [start, end] = row.b.split(/\s*[-–]\s*/).map((part) => Number.parseInt(part, 16));
    return start !== undefined && end !== undefined && at >= start && at < end;
  });
  return found?.a ?? null;
}

/** "name+0x1c" for an address inside a function, or just the name at its start. */
export function placeIn(name: string, fn: string, addr: string): string {
  const offset = Number.parseInt(addr, 16) - Number.parseInt(fn, 16);
  return offset > 0 ? `${name}+0x${offset.toString(16)}` : name;
}

/** Where the user is: the selected address, or the start of the function in focus. */
export function currentAddr(bench: Bench): string {
  return subjectAddr(bench.wb.s.selected) ?? bench.focusAddr;
}
