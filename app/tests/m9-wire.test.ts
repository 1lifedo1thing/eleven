import { expect, test } from "bun:test";

import { Decoder, frame } from "../src/debug/wire";

test("M9: a framed message round-trips through the decoder", () => {
  const decoder = new Decoder();
  const message = { seq: 1, type: "request", command: "initialize" };
  expect(decoder.push(frame(message))).toEqual([message]);
});

test("M9: the decoder reassembles a message split across chunks", () => {
  const decoder = new Decoder();
  const bytes = frame({ seq: 2, command: "launch" });
  const cut = 12;
  expect(decoder.push(bytes.subarray(0, cut))).toEqual([]);
  expect(decoder.push(bytes.subarray(cut))).toEqual([{ seq: 2, command: "launch" }]);
});

test("M9: the decoder splits two messages coalesced into one chunk", () => {
  const decoder = new Decoder();
  const a = { seq: 1, event: "stopped" };
  const b = { seq: 2, event: "terminated" };
  expect(decoder.push(Buffer.concat([frame(a), frame(b)]))).toEqual([a, b]);
});
