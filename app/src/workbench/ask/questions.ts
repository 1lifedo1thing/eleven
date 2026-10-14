import type { Syntax } from "../../components/code";

export const EXPLAIN = "What does this do?";

const UNNAMED = /\b(?:DAT|FUN|PTR|LAB)_[0-9a-fA-F]+\b/;
const ODD_NUMBER = /(?<![\w.$%])-?(?:0x[0-9a-fA-F]{5,}|\d{6,})\b/;
const BRANCH = /\b(?:if|while|for|switch)\b/;

/** Up to three questions that fit the picked lines: what they do, a name worth giving, a number worth explaining. */
export function suggestedQuestions(lines: readonly string[], syntax: Syntax): readonly string[] {
  const text = lines.join("\n");
  const unnamed = UNNAMED.exec(text)?.[0];
  const odd = ODD_NUMBER.exec(text)?.[0];
  const lowLevel = syntax === "asm" || syntax === "ptx";
  return [
    EXPLAIN,
    ...(unnamed ? [`Name ${unnamed}`] : []),
    ...(odd ? [`Why ${odd}?`] : []),
    ...(!lowLevel && BRANCH.test(text) ? ["When does this branch run?"] : []),
    ...(lowLevel ? ["What would this look like in C?"] : []),
    "Where does this get used?",
  ].slice(0, 3);
}
