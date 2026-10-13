/** A word in a code line, and the address it names when it names one. */
export type Token = { readonly text: string; readonly addr: string | null };

/** The thing under the pointer when a menu opens or a key is pressed: what every workbench action acts on. */
export type Subject =
  | { readonly kind: "function"; readonly addr: string }
  | { readonly kind: "line"; readonly fn: string; readonly view: "pseudo" | "asm"; readonly number: number; readonly text: string; readonly addr: string | null; readonly token: Token | null }
  | { readonly kind: "block"; readonly fn: string; readonly start: string; readonly end: string }
  | { readonly kind: "bytes"; readonly fn: string; readonly addr: string; readonly bytes: readonly number[] }
  | { readonly kind: "string"; readonly addr: string; readonly value: string }
  | { readonly kind: "import"; readonly library: string; readonly symbol: string }
  | { readonly kind: "segment"; readonly name: string; readonly range: string }
  | { readonly kind: "tab"; readonly pane: number; readonly index: number };

const LINE_ADDRESS = /^(0x[0-9a-f]+):/i;
const WORDS = /(0x[0-9a-f]+|[A-Za-z_$][\w$.]*)/i;
const IDENTIFIER = /^(0x[0-9a-f]+|[A-Za-z_$][\w$.]*)$/i;

/** Text cut into words and the gaps between them, so each word can be clicked on its own. */
export function splitWords(text: string): readonly { readonly text: string; readonly word: boolean }[] {
  return text.split(WORDS).filter(Boolean).map((piece) => ({ text: piece, word: IDENTIFIER.test(piece) }));
}
const LABEL = /^(?:DAT|LAB|PTR|FUN|SUB)_([0-9a-f]+)$/i;

/** The instruction address an assembly line starts with. */
export function lineAddress(text: string): string | null {
  return LINE_ADDRESS.exec(text.trim())?.[1]?.toLowerCase() ?? null;
}

/** The address a word names: a literal like 0x1000, or a Ghidra label like DAT_100008000. */
export function wordAddress(text: string): string | null {
  if (/^0x[0-9a-f]+:?$/i.test(text)) return text.replace(/:$/, "").toLowerCase();
  const label = LABEL.exec(text);
  return label?.[1] ? `0x${label[1].toLowerCase()}` : null;
}
