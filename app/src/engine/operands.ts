/** How the number in an instruction is shown, like Hopper's operand formats. */
export const OPERAND_FORMATS = ["hex", "decimal", "char", "offset", "address"] as const;

export type OperandFormat = (typeof OPERAND_FORMATS)[number];

export function isOperandFormat(value: unknown): value is OperandFormat {
  return OPERAND_FORMATS.some((format) => format === value);
}

const WORDS: Readonly<Record<OperandFormat, string>> = { hex: "hexadecimal", decimal: "decimal", char: "a character", offset: "an offset", address: "an address" };

export function describeFormat(value: string): string {
  return isOperandFormat(value) ? WORDS[value] : value;
}

/** A symbol to show a number against: the name at an address, and where it starts. */
export type Symbolic = { readonly name: string; readonly start: bigint };

export type Lookup = {
  /** The name exactly at an address, if anything is there. */
  readonly at: (value: bigint) => string | null;
  /** The nearest named thing at or below an address. */
  readonly below: (value: bigint) => Symbolic | null;
};

type Immediate = { readonly from: number; readonly to: number; readonly hash: string; readonly value: bigint };

const NUMBER = /(?<![\w.$])(#?)(-?)(0x[0-9a-f]+|\d+)(?![\w.$])/gi;

/** The last number in an instruction's operands, skipping its own address; that is the one a format changes. */
export function lastImmediate(line: string): Immediate | null {
  const colon = /^\s*0x[0-9a-f]+:\s*/i.exec(line);
  const start = colon ? colon[0].length : 0;
  const ops = /^\S+\s+/.exec(line.slice(start));
  if (!ops) return null;
  const body = start + ops[0].length;
  let found: Immediate | null = null;
  for (const match of line.slice(body).matchAll(NUMBER)) {
    const [whole, hash = "", minus = "", digits = ""] = match;
    const magnitude = BigInt(digits);
    found = { from: body + (match.index ?? 0), to: body + (match.index ?? 0) + whole.length, hash, value: minus ? -magnitude : magnitude };
  }
  return found;
}

function hex(value: bigint): string {
  return value < 0n ? `-0x${(-value).toString(16)}` : `0x${value.toString(16)}`;
}

const ESCAPES: Readonly<Record<number, string>> = { 0: "\\0", 9: "\\t", 10: "\\n", 13: "\\r", 39: "\\'", 92: "\\\\" };

/** A number as the characters its bytes spell, high byte first, like 'GIF8'; null when it isn't 1 to 8 bytes. */
export function asChars(value: bigint): string | null {
  if (value < 0n || value > 0xffff_ffff_ffff_ffffn) return null;
  const bytes: number[] = [];
  for (let rest = value; rest > 0n || bytes.length === 0; rest >>= 8n) bytes.unshift(Number(rest & 0xffn));
  const text = bytes.map((byte) => ESCAPES[byte] ?? (byte >= 0x20 && byte < 0x7f ? String.fromCharCode(byte) : `\\x${byte.toString(16).padStart(2, "0")}`)).join("");
  return `'${text}'`;
}

function render(value: bigint, format: OperandFormat, lookup: Lookup): string {
  switch (format) {
    case "hex":
      return hex(value);
    case "decimal":
      return value.toString();
    case "char":
      return asChars(value) ?? hex(value);
    case "address":
      return lookup.at(value) ?? hex(value);
    case "offset": {
      const near = lookup.below(value);
      if (!near) return hex(value);
      const delta = value - near.start;
      return delta === 0n ? near.name : `${near.name}+${hex(delta)}`;
    }
    default: {
      const unhandled: never = format;
      return unhandled;
    }
  }
}

/** The line with its last number shown in `format`; lines without a number come back as they were. */
export function formatOperand(line: string, format: OperandFormat, lookup: Lookup): string {
  const imm = lastImmediate(line);
  if (!imm) return line;
  const shown = render(imm.value, format, lookup);
  const hash = format === "hex" || format === "decimal" || format === "char" ? imm.hash : "";
  return `${line.slice(0, imm.from)}${hash}${shown}${line.slice(imm.to)}`;
}
