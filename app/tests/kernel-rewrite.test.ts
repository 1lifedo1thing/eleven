import { expect, test } from "bun:test";

import { customAgentEntry } from "../src/agents/registry";
import { tokenize } from "../src/components/code";
import { kernelExplainPrompt, kernelRewritePrompt, type KernelRequest, parseNotes } from "../src/gpu/kernelRewrite";
import { DARK } from "../src/theme";

const roles = (line: string): readonly string[] => tokenize(line, "ptx", DARK).flatMap((part) => (part.kind === "text" && part.text.trim() ? [part.text.trim()] : []));

test("PTX: opcodes, registers, predicates, labels and memory operands are separate tokens", () => {
  expect(roles("@%p1 bra $L__BB0_13;")).toEqual(["@%p1", "bra", "$L__BB0_13", ";"]);
  expect(roles("ld.param.u64 %rd15, [_Z3foo_param_0];")).toEqual(["ld.param.u64", "%rd15", ",", "[_Z3foo_param_0]", ";"]);
  expect(roles(".reg .b64 %rd<54>;")).toEqual([".reg", ".b64", "%rd<54>", ";"]);
  const parts = tokenize("and.b64 %rd28, %rd27, -4294967296;", "ptx", DARK);
  const colorOf = (text: string): string | null => {
    const part = parts.find((candidate) => candidate.text === text);
    return part?.kind === "text" ? part.color : null;
  };
  expect(colorOf("and.b64")).not.toBe(colorOf("%rd28"));
  expect(colorOf("%rd28")).toBe(colorOf("%rd27"));
  expect(colorOf("-4294967296")).not.toBe(colorOf("%rd27"));
});

test("notes: reads the JSON array out of a chatty reply, in order, without overlaps or empty notes", () => {
  const reply = 'Here you go:\n[{"from": 5, "to": 9, "note": "Bounds check.", "surprise": false}, {"from": 1, "to": 4, "note": "Reads the parameters."}, {"from": 8, "to": 12, "note": "Overlaps."}, {"from": 13, "to": 99, "note": "Fast divide.", "surprise": true}, {"from": 20, "to": 21, "note": " "}]';
  expect(parseNotes(reply, 15)).toEqual([
    { from: 1, to: 4, note: "Reads the parameters.", surprise: false },
    { from: 5, to: 9, note: "Bounds check.", surprise: false },
    { from: 13, to: 15, note: "Fast divide.", surprise: true },
  ]);
  expect(parseNotes("no json here", 10)).toEqual([]);
  expect(parseNotes("[not json]", 10)).toEqual([]);
});

test("prompts: the rewrite asks for one fenced block in the target language, the explanation numbers every line", () => {
  const agent = customAgentEntry("my-agent --acp");
  if (!agent) throw new Error("no agent");
  const req: KernelRequest = {
    agent,
    native: null,
    projectId: "p",
    binary: { path: "/tmp/acc.fatbin" },
    library: "acc.fatbin",
    kernel: "acc_f32(float const*)",
    ptx: ".entry k(\n)\n{\nret;\n}",
    params: [{ slot: "param 0", type: "float const*" }],
    stats: [],
  };
  expect(kernelRewritePrompt(req, "Metal")).toContain("```metal code block");
  expect(kernelRewritePrompt(req, "HIP C++")).toContain("hipcc");
  expect(kernelExplainPrompt(req)).toContain("4: ret;");
});
