const PIN = /^Lines? (\d+)(?:–(\d+))? of the (.+?): /;
const BETWEEN = /\n\n(?=Lines? \d+(?:–\d+)? of the [^\n]+?: )/;

function header(label: string, from: number, to: number): string {
  return `${from === to ? `Line ${from}` : `Lines ${from}–${to}`} of the ${label}: `;
}

function parts(note: string): readonly string[] {
  return note.trim() ? note.trim().split(BETWEEN) : [];
}

export function isPinned(note: string, label: string, from: number, to: number): boolean {
  return parts(note).some((part) => part.startsWith(header(label, from, to)));
}

export function unpinAnswer(note: string, label: string, from: number, to: number): string {
  return parts(note).filter((part) => !part.startsWith(header(label, from, to))).join("\n\n");
}

/** Adds the answer to the function's note as its own paragraph, replacing an earlier pin on the same lines. */
export function pinAnswer(note: string, label: string, from: number, to: number, answer: string): string {
  const rest = unpinAnswer(note, label, from, to);
  const pin = `${header(label, from, to)}${answer.trim()}`;
  return rest ? `${rest}\n\n${pin}` : pin;
}

/** The last line of every pinned answer in this view, where its dot shows. */
export function pinnedLines(note: string, label: string): ReadonlySet<number> {
  return new Set(parts(note).flatMap((part) => {
    const found = PIN.exec(part);
    return found?.[1] && found[3] === label ? [Number(found[2] ?? found[1])] : [];
  }));
}
