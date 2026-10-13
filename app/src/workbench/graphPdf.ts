import { arrowPath, BLOCK_WIDTH, type EdgeKind, edgePath, type Layout, LINE_HEIGHT } from "./cfg";

const MARGIN = 24;
const FONT = 8;

const EDGE_RGB: Readonly<Record<EdgeKind, string>> = {
  taken: "0.31 0.63 0.31",
  fallthrough: "0.89 0.34 0.29",
  always: "0.55 0.55 0.55",
  back: "0.18 0.44 0.82",
};

function rgb(hex: string): string {
  const value = parseInt(hex.replace("#", ""), 16);
  return [16, 8, 0].map((shift) => (((value >> shift) & 0xff) / 255).toFixed(3)).join(" ");
}

/** PDF text is ASCII here: parentheses and backslashes escaped, anything else outside ASCII replaced. */
function pdfText(text: string): string {
  return text.replace(/[^\x20-\x7e]/g, "?").replace(/([()\\])/g, "\\$1");
}

/** An SVG path (M, L, C, Z, absolute) as PDF path operators, flipped so y grows upward. */
function pdfPath(d: string, height: number): string {
  const ops: string[] = [];
  for (const [, cmd, args] of d.matchAll(/([MLCZ])([^MLCZ]*)/g)) {
    const nums = (args ?? "").trim().split(/[\s,]+/).filter(Boolean).map(Number);
    const pts: string[] = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push(`${((nums[i] ?? 0) + MARGIN).toFixed(1)} ${(height - (nums[i + 1] ?? 0) - MARGIN).toFixed(1)}`);
    if (cmd === "M") ops.push(`${pts.join(" ")} m`);
    if (cmd === "L") ops.push(...pts.map((pt) => `${pt} l`));
    if (cmd === "C") ops.push(`${pts.join(" ")} c`);
    if (cmd === "Z") ops.push("h");
  }
  return ops.join("\n");
}

export type PdfBlock = { readonly start: string; readonly title: string; readonly lines: readonly string[]; readonly color: string | null };

/** A one-page, vector PDF of a laid-out graph: blocks with their instructions, and edges colored by kind. */
export function graphPdf(layout: Layout, blocks: ReadonlyMap<string, PdfBlock>, title: string): string {
  const width = layout.width + BLOCK_WIDTH + MARGIN * 2;
  const height = layout.height + MARGIN * 2 + 20;
  const draw: string[] = ["BT /F1 11 Tf 0 0 0 rg", `${MARGIN} ${height - 18} Td (${pdfText(title)}) Tj ET`];
  for (const edge of layout.edges) {
    const color = EDGE_RGB[edge.kind];
    draw.push(`${color} RG 1 w`, pdfPath(edgePath(edge), height), "S", `${color} rg`, pdfPath(arrowPath(edge), height), "f");
  }
  for (const placed of layout.blocks) {
    const info = blocks.get(placed.block.start);
    const x = placed.x + MARGIN;
    const y = height - placed.y - MARGIN - placed.height;
    draw.push("0.97 0.97 0.96 rg", `${info?.color ? rgb(info.color) : "0.75 0.75 0.74"} RG ${info?.color ? 2 : 0.8} w`, `${x} ${y} ${BLOCK_WIDTH} ${placed.height} re B`);
    const lines = [info?.title ?? placed.block.start, ...(info?.lines ?? placed.lines), ...(placed.hidden > 0 ? [`... ${placed.hidden} more`] : [])];
    lines.forEach((line, ix) => {
      const ty = height - placed.y - MARGIN - 14 - ix * LINE_HEIGHT;
      draw.push(`BT /F1 ${FONT} Tf ${ix === 0 ? "0.18 0.44 0.82" : "0.15 0.15 0.15"} rg ${x + 8} ${ty} Td (${pdfText(line.slice(0, 58))}) Tj ET`);
    });
  }
  const stream = draw.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, ix) => {
    offsets.push(body.length);
    body += `${ix + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((at) => `${String(at).padStart(10, "0")} 00000 n \n`).join("")}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return body;
}
