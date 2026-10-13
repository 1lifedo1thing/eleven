/** Splits a command line the way a shell would: spaces separate, quotes group, backslash escapes. */
export function splitArgs(line: string): readonly string[] {
  const out: string[] = [];
  let word = "";
  let started = false;
  let quote: "'" | '"' | null = null;
  for (let ix = 0; ix < line.length; ix++) {
    const ch = line[ix] ?? "";
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === "\\" && quote === '"' && ix + 1 < line.length) word += line[++ix] ?? "";
      else word += ch;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      started = true;
    } else if (ch === "\\" && ix + 1 < line.length) {
      word += line[++ix] ?? "";
      started = true;
    } else if (/\s/.test(ch)) {
      if (started) out.push(word);
      word = "";
      started = false;
    } else {
      word += ch;
      started = true;
    }
  }
  if (started) out.push(word);
  return out;
}
