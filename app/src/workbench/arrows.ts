import { lineAddress } from "./subject";

const MAX_LANES = 7;
export const LANE_WIDTH = 7;

const BRANCH = /^\s*0x[0-9a-f]+:\s+(b(?:\.\w+)?|cbn?z|tbn?z|j[a-z]{1,3}|jmp|loop\w*)\s.*?(0x[0-9a-f]+)\s*$/i;

/** A jump from one line to another in the same function: line indexes, its lane, and whether it loops back. */
export type Jump = { readonly from: number; readonly to: number; readonly lane: number; readonly back: boolean };

/** One line's share of the arrows: what to draw in each lane beside it. */
export type LanePiece = { readonly lane: number; readonly kind: "through" | "start" | "end"; readonly down: boolean; readonly jump: number };

/** The branches inside a function, each given a lane so overlapping jumps sit side by side, shortest nearest the code. */
export function layoutJumps(lines: readonly string[]): readonly Jump[] {
  const at = new Map<string, number>();
  lines.forEach((line, ix) => {
    const addr = lineAddress(line);
    if (addr) at.set(addr, ix);
  });
  const found = lines.flatMap((line, from) => {
    const target = BRANCH.exec(line)?.[2]?.toLowerCase();
    const to = target ? at.get(target) : undefined;
    return to === undefined || to === from ? [] : [{ from, to }];
  });
  const byLength = [...found].sort((a, b) => Math.abs(a.to - a.from) - Math.abs(b.to - b.from));
  const taken: { readonly lo: number; readonly hi: number }[][] = Array.from({ length: MAX_LANES }, () => []);
  return byLength.flatMap((jump) => {
    const lo = Math.min(jump.from, jump.to);
    const hi = Math.max(jump.from, jump.to);
    const lane = taken.findIndex((spans) => spans.every((span) => span.hi < lo || span.lo > hi));
    if (lane < 0) return [];
    taken[lane]?.push({ lo, hi });
    return [{ ...jump, lane, back: jump.to < jump.from }];
  });
}

/** For every line, the arrow pieces beside it. */
export function piecesByLine(jumps: readonly Jump[], count: number): readonly (readonly LanePiece[])[] {
  const pieces: LanePiece[][] = Array.from({ length: count }, () => []);
  jumps.forEach((jump, index) => {
    const down = jump.to > jump.from;
    const lo = Math.min(jump.from, jump.to);
    const hi = Math.max(jump.from, jump.to);
    for (let line = lo; line <= hi; line++) {
      const kind = line === jump.from ? "start" : line === jump.to ? "end" : "through";
      pieces[line]?.push({ lane: jump.lane, kind, down, jump: index });
    }
  });
  return pieces;
}

export function laneCount(jumps: readonly Jump[]): number {
  return jumps.reduce((most, jump) => Math.max(most, jump.lane + 1), 0);
}

/** One line's arrows as SVG: lanes run right to left from the code, an arrowhead marks where a jump lands. */
export function arrowSvg(pieces: readonly LanePiece[], lanes: number, height: number): string {
  const width = lanes * LANE_WIDTH + 6;
  const mid = height / 2;
  const x = (lane: number): number => width - 6 - lane * LANE_WIDTH - LANE_WIDTH / 2;
  const paths = pieces.map((piece) => {
    const lx = x(piece.lane);
    switch (piece.kind) {
      case "through":
        return `M${lx} 0V${height}`;
      case "start":
        return `M${width} ${mid}H${lx}V${piece.down ? height : 0}`;
      case "end":
        return `M${lx} ${piece.down ? 0 : height}V${mid}H${width - 1}M${width - 4} ${mid - 3}L${width - 1} ${mid}L${width - 4} ${mid + 3}`;
      default: {
        const unhandled: never = piece.kind;
        return unhandled;
      }
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" stroke="black" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="${paths.join("")}"/></svg>`;
}
