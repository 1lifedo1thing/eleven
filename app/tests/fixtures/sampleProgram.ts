import type { GpuSource } from "../../src/gpu/source";
import type { Dossier } from "../../src/engine/dossier";
import type { Fn, HexRow, Program, Refs, TableRow } from "../../src/workbench/model";

const ENTRY_PSEUDO = `void entry(undefined8 param_1,long param_2)

{
  BOOL BVar6;
  int iVar7;
  uint uVar8;
  char *pcVar12;
  long local_80;

  local_80 = 0;
  iVar11 = (int)param_1;
  if (iVar11 < 1) {
    FUN_100004088();
  }
  _setlocale(0,"");
  BVar6 = _compat_mode("bin/ls","Unix2003");
  DAT_10000c024 = (char)BVar6;
  iVar7 = _isatty(1);
  if (iVar7 == 0) {
    DAT_10000c0d0 = 1;
    pcVar12 = _getenv("COLUMNS");
    if (pcVar12 != (char *)0x0) {
      DAT_10000c000 = _strtonum(pcVar12,0,0x7fffffff,&local_80);
    }
  }
  else {
    DAT_10000c000 = 0x50;
    pcVar12 = _getenv("COLUMNS");
    if ((pcVar12 == (char *)0x0) || (*pcVar12 == '\\0')) {
      iVar7 = _ioctl(1,0x40087468);
    }
    DAT_10000c028 = 1;
  }
  pcVar12 = _getenv("CLICOLOR");
  if (pcVar12 != (char *)0x0) {
    DAT_10000c020 = 1;
  }
  uVar8 = 0x10;
LAB_100000af0:
  iVar7 = _getopt_long(param_1,param_2,"+@1ABCD:FGHILOPRSTUWXabcdefghiklmnopqrstuvwxy%,",
                       &PTR_s_color_1000082d0,0);
  if (iVar7 == -1) {
    FUN_1000016d8(iVar7,param_2,uVar8);
  }
  /* continues */
}`;

const ENTRY_ASM = `0x100000960: pacibsp
0x100000964: stp x28, x27, [sp, #-0x60]!
0x100000968: stp x26, x25, [sp, #0x10]
0x10000096c: stp x24, x23, [sp, #0x20]
0x100000970: stp x22, x21, [sp, #0x30]
0x100000974: stp x20, x19, [sp, #0x40]
0x100000978: stp x29, x30, [sp, #0x50]
0x10000097c: add x29, sp, #0x50
0x100000980: sub sp, sp, #0x640
0x100000984: mov x19, x1
0x100000988: mov x20, x0
0x1000009a4: cmp w0, #0x0
0x1000009a8: b.gt 0x1000009b0
0x1000009ac: bl 0x100004088
0x1000009b0: adrp x1, 0x100004000
0x1000009b4: add x1, x1, #0x8f5
0x1000009b8: mov w0, #0x0
0x1000009bc: bl 0x10000464c
0x1000009c0: adrp x0, 0x100004000
0x1000009c4: add x0, x0, #0x8f6
0x1000009d0: bl 0x1000043bc
0x1000009e0: mov w0, #0x1
0x1000009e4: bl 0x10000454c`;

const USAGE_PSEUDO = `void FUN_100004088(void)

{
  _fprintf(*(FILE **)PTR____stderrp_1000082b0,
           "usage: ls [-@ABCFGHILOPRSTUWXabcdefghiklmnopqrstuvwxy1%%,] [--color=when] [-D format] [file ...]\\n"
          );
                    /* WARNING: Subroutine does not return */
  _exit(1);
}`;

const USAGE_ASM = `0x100004088: pacibsp
0x10000408c: stp x29, x30, [sp, #-0x10]!
0x100004090: mov x29, sp
0x100004094: adrp x8, 0x100008000
0x100004098: ldr x8, [x8, #0x2b0]
0x10000409c: ldr x0, [x8]
0x1000040a0: adrp x1, 0x100004000
0x1000040a4: add x1, x1, #0xd96
0x1000040a8: bl 0x10000442c
0x1000040ac: mov w0, #0x1
0x1000040b0: bl 0x1000043ec`;

const TRAVERSE_PSEUDO = `int * FUN_1000016d8(int param_1,char **param_2,uint param_3)

{
  code *pcVar6;
  FTS *pFVar8;
  FTSENT *pFVar9;

  pcVar6 = (code *)0x0;
  if (DAT_10000c0d8 == '\\0') {
    pcVar6 = FUN_1000019fc;
  }
  pFVar8 = _fts_open(param_2,param_3,(int *)pcVar6);
  if (pFVar8 == (FTS *)0x0) {
    FUN_100004174();
  }
  else {
    pFVar9 = _fts_children(pFVar8,0);
    if (pFVar9 != (FTSENT *)0x0) {
      FUN_100001a7c(0,pFVar9);
    }
    pFVar9 = _fts_read(pFVar8);
    while (pFVar9 != (FTSENT *)0x0) {
      /* walks each directory entry */
    }
  }
}`;

const fn = (addr: string, name: string): Fn => ({ addr, name, kind: "function" });
const thunk = (addr: string, name: string): Fn => ({ addr, name, kind: "thunk" });

const FUNCS: readonly Fn[] = [
  fn("0x100000960", "entry"), fn("0x100000700", "FUN_100000700"), fn("0x10000070c", "FUN_10000070c"),
  fn("0x1000016d8", "FUN_1000016d8"), fn("0x1000019fc", "FUN_1000019fc"), fn("0x100001a7c", "FUN_100001a7c"),
  fn("0x10000232c", "FUN_10000232c"), fn("0x100002404", "FUN_100002404"), fn("0x10000252c", "FUN_10000252c"),
  fn("0x100002cb4", "FUN_100002cb4"), fn("0x100003074", "FUN_100003074"), fn("0x1000036a0", "FUN_1000036a0"),
  fn("0x100004088", "FUN_100004088"), fn("0x100004174", "FUN_100004174"), thunk("0x1000042bc", "___error"),
  thunk("0x1000043bc", "_compat_mode"), thunk("0x1000043ec", "_exit"), thunk("0x10000442c", "_fprintf"),
  thunk("0x10000454c", "_isatty"), thunk("0x10000464c", "_setlocale"),
];

const CODE: ReadonlyMap<string, { readonly pseudo: string; readonly asm: string | null }> = new Map([
  ["0x100000960", { pseudo: ENTRY_PSEUDO, asm: ENTRY_ASM }],
  ["0x100004088", { pseudo: USAGE_PSEUDO, asm: USAGE_ASM }],
  ["0x1000016d8", { pseudo: TRAVERSE_PSEUDO, asm: null }],
]);

const REFS: ReadonlyMap<string, Refs> = new Map([
  ["0x100000960", { callers: [], callees: ["0x1000016d8", "0x1000036a0", "0x100004088", "0x1000043bc", "0x1000043ec", "0x10000454c", "0x10000464c"] }],
  ["0x100004088", { callers: [{ addr: "0x100000960", at: "0x1000009ac" }], callees: ["0x10000442c", "0x1000043ec"] }],
  ["0x1000016d8", { callers: [{ addr: "0x100000960", at: "0x100000960" }], callees: ["0x1000019fc", "0x100001a7c", "0x100004174", "0x1000042bc"] }],
]);

const row = (a: string, b: string): TableRow => ({ a, b });

const STRINGS: readonly TableRow[] = [
  row("0x1000047f0", "@(#)PROGRAM:ls  PROJECT:file_cmds-475"), row("0x1000048f6", "bin/ls"), row("0x1000048fd", "Unix2003"),
  row("0x100004906", "COLUMNS"), row("0x10000490e", "LS_SAMESORT"), row("0x10000491a", "CLICOLOR"),
  row("0x100004923", "+@1ABCD:FGHILOPRSTUWXabcdefghiklmnopqrstuvwxy%,"), row("0x100004993", "TERM"), row("0x1000049aa", "LSCOLORS"),
  row("0x1000049b3", "vfs.nspace.prevent_materialization"), row("0x1000049d6", "prevent materialization sysctl failed"),
  row("0x1000049fc", "stdout"), row("0x100004a03", "color"), row("0x100004a09", "always"), row("0x100004a14", "force"), row("0x100004a1a", "auto"),
];

const IMPORTS: readonly TableRow[] = [
  row("libSystem", "_setlocale"), row("libSystem", "_compat_mode"), row("libSystem", "_isatty"), row("libSystem", "_getenv"),
  row("libSystem", "_strtonum"), row("libSystem", "_ioctl"), row("libSystem", "_getopt_long"), row("libncurses", "_tgetent"),
  row("libncurses", "_tgetstr"), row("libSystem", "_fts_open"), row("libSystem", "_fts_read"), row("libSystem", "_fprintf"), row("libSystem", "_exit"),
];

const SEGMENTS: readonly TableRow[] = [
  row("__PAGEZERO", "0x0 to 0x100000000"), row("__TEXT", "0x100000000 to 0x100008000"), row("__DATA_CONST", "0x100008000 to 0x10000c000"),
  row("__DATA", "0x10000c000 to 0x100010000"), row("__LINKEDIT", "0x100010000 to 0x100018000"),
];

const HEX: readonly HexRow[] = [
  { addr: "0x100000960", bytes: "7f 23 03 d5 fc 6f ba a9 fa 67 01 a9 f8 5f 02 a9", ascii: ".#...o...g..._.." },
  { addr: "0x100000970", bytes: "f6 57 03 a9 f4 4f 04 a9 fd 7b 05 a9 fd 43 01 91", ascii: ".W...O...{...C.." },
  { addr: "0x100000980", bytes: "ff 03 19 d1 f3 03 01 aa f4 03 00 aa b5 c3 01 d1", ascii: "................" },
  { addr: "0x100000990", bytes: "bf 0a 00 f9 bf c3 19 b8 bf 02 00 f9 e8 83 00 91", ascii: "................" },
  { addr: "0x1000009a0", bytes: "e8 0f 00 f9 1f 00 00 71 4c 00 00 54 b7 0d 00 94", ascii: ".......qL..T...." },
  { addr: "0x1000009b0", bytes: "21 00 00 90 21 d4 23 91 00 00 80 52 24 0f 00 94", ascii: "!...!.#....R$..." },
  { addr: "0x1000009c0", bytes: "20 00 00 90 00 d8 23 91 21 00 00 90 21 f4 23 91", ascii: " .....#.!...!.#." },
  { addr: "0x1000009d0", bytes: "7b 0e 00 94 7a 00 00 90 40 93 00 39 36 00 80 52", ascii: "{...z...@..96..R" },
  { addr: "0x1000009e0", bytes: "20 00 80 52 da 0e 00 94 7b 00 00 90 78 00 00 90", ascii: " ..R....{...x..." },
];

const LOG: readonly string[] = [
  "open_binary ls-arm64e                 100 ms",
  "list_procedures                      7801 ms  first open, now cached",
  "procedure_pseudo_code entry           157 ms",
  "procedure_callers FUN_100004088         4 ms",
];

const ENTRY_BLOCKS: Dossier = {
  blocks: [
    { start: "0x100000960", end: "0x1000009ac", successors: ["0x1000009ac", "0x1000009b0"] },
    { start: "0x1000009ac", end: "0x1000009b0", successors: [] },
    { start: "0x1000009b0", end: "0x1000009c4", successors: [] },
  ],
  callers: [],
  callees: [],
  comments: new Map(),
};

const NO_BLOCKS: Dossier = { blocks: [], callers: [], callees: [], comments: new Map() };

function nameAt(addr: string): string {
  return FUNCS.find((f) => f.addr === addr)?.name ?? addr;
}

function sampleCode(addr: string, view: "pseudo" | "asm"): string {
  const code = CODE.get(addr);
  if (view === "asm") return code?.asm ?? `; Assembly for ${nameAt(addr)} loads when you open it.`;
  return code?.pseudo ?? `// Ghidra decompiles ${nameAt(addr)} the first time you open it.\n// After that it opens from the cache.`;
}

/** A fixed `ls`-shaped program, so workbench tests run without REA or Ghidra. */
export const SAMPLE_PROGRAM: Program = {
  id: "sample",
  path: "",
  origin: "",
  name: "ls",
  arch: "arm64e",
  total: 134,
  functions: FUNCS,
  strings: STRINGS,
  imports: IMPORTS,
  segments: SEGMENTS,
  evidence: "ev_7475c05a…",
  engine: "Ghidra",
  log: () => LOG,
  code: (addr, view) => Promise.resolve(sampleCode(addr, view)),
  dossier: (addr) => Promise.resolve(addr === "0x100000960" ? ENTRY_BLOCKS : NO_BLOCKS),
  refs: (addr) => Promise.resolve(REFS.get(addr) ?? { callers: [], callees: [] }),
  hex: () => Promise.resolve(HEX),
  focusLine: (addr, view) => (addr === "0x100000960" && view === "pseudo" ? 12 : -1),
  retype: null,
};

/** A GPU source with no shaders, models or recordings. */
export const NO_GPU: GpuSource = {
  live: false,
  executable: () => Promise.resolve(SAMPLE_PROGRAM.name),
  listLibraries: () => Promise.resolve([]),
  functionIr: (library, name) => Promise.reject(new Error(`${library} has no function named ${name}`)),
  loadedBy: () => Promise.resolve(null),
  listModels: () => Promise.resolve([]),
  listRecordings: () => Promise.resolve([]),
  record: () => Promise.reject(new Error("The sample program can't be recorded.")),
};
