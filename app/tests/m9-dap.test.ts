import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { findLldbDap } from "../src/debug/adapter";
import { DapClient, type DapEvent } from "../src/debug/dap";

const SOURCE = ["int main(void) {", "  int answer = 42;", "  return answer - 42;", "}", ""].join("\n");
const BREAK_LINE = 3;

class Events {
  private readonly seen: DapEvent[] = [];
  private readonly pending: { readonly name: string; readonly resolve: (event: DapEvent) => void; readonly reject: (err: Error) => void }[] = [];

  constructor(client: DapClient) {
    client.on((event) => {
      const index = this.pending.findIndex((p) => p.name === event.event);
      if (index >= 0) this.pending.splice(index, 1)[0]?.resolve(event);
      else this.seen.push(event);
    });
  }

  wait(name: string, ms = 20_000): Promise<DapEvent> {
    const index = this.seen.findIndex((event) => event.event === name);
    const found = index >= 0 ? this.seen.splice(index, 1)[0] : undefined;
    if (found) return Promise.resolve(found);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no ${name} event`)), ms);
      this.pending.push({ name, resolve: (event) => { clearTimeout(timer); resolve(event); }, reject });
    });
  }
}

function threadId(event: DapEvent): number {
  const body = event.body as { threadId?: number } | undefined;
  return body?.threadId ?? 1;
}

const adapter = findLldbDap();
const run = adapter && process.platform === "darwin" ? test : test.skip;

run("M9: lldb-dap launches a program, stops at a breakpoint, reads a local, and runs to exit", async () => {
  const dir = mkdtempSync(join(tmpdir(), "eleven-dap-"));
  const src = join(dir, "tiny.c");
  const bin = join(dir, "tiny");
  writeFileSync(src, SOURCE);
  execFileSync("cc", ["-g", "-O0", src, "-o", bin]);

  const client = new DapClient(adapter as string);
  const events = new Events(client);
  try {
    await client.initialize();
    const launched = client.launch({ program: bin, stopOnEntry: false });
    await events.wait("initialized");
    await client.setBreakpoints(src, [BREAK_LINE]);
    await client.configurationDone();
    await launched;

    const stopped = await events.wait("stopped");
    const tid = threadId(stopped);
    const frames = await client.stackTrace(tid);
    expect(frames[0]?.name).toContain("main");
    expect(frames[0]?.line).toBe(BREAK_LINE);

    const scopes = await client.scopes(frames[0]?.id ?? 0);
    expect(scopes.some((s) => /local/i.test(s.name))) .toBe(true);
    const locals = scopes.find((s) => /local/i.test(s.name)) ?? scopes[0];
    const vars = locals ? await client.variables(locals.reference) : [];
    expect(vars.find((v) => v.name === "answer")?.value).toBe("42");

    await client.next(tid, "instruction");
    await events.wait("stopped");

    await client.continue(tid);
    await events.wait("exited");
  } finally {
    await client.disconnect();
  }
}, 60_000);
