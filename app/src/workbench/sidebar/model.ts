import type { Fn } from "../model";

export type FnSort = "files" | "address" | "name";

export type FnShow = "all" | "renamed" | "imports";

/** A folder is a package or namespace; a file is a decompiled source file; a class is a C++ or Objective-C class. */
export type TreeKind = "folder" | "file" | "class";

export type FnRow =
  | { readonly kind: "node"; readonly path: string; readonly name: string; readonly tree: TreeKind; readonly ext: string; readonly depth: number; readonly count: number; readonly open: boolean }
  | { readonly kind: "fn"; readonly fn: Fn; readonly label: string; readonly depth: number };

export const SORT_LABEL: Readonly<Record<FnSort, string>> = { files: "By file", address: "By address", name: "A–Z" };

export function nextSort(sort: FnSort): FnSort {
  switch (sort) {
    case "files":
      return "address";
    case "address":
      return "name";
    case "name":
      return "files";
    default: {
      const unhandled: never = sort;
      return unhandled;
    }
  }
}

/** The class or namespace a function belongs to, and its own name: `A::b`, `-[A b]` and `+[A b]` all split. */
export function splitOwner(name: string): { readonly owner: string; readonly member: string } | null {
  const objc = /^[-+]\[(\S+) (.+)\]$/.exec(name);
  if (objc?.[1] && objc[2]) return { owner: objc[1], member: objc[2] };
  const cut = name.lastIndexOf("::");
  if (cut <= 0 || cut + 2 >= name.length) return null;
  return { owner: name.slice(0, cut), member: name.slice(cut + 2) };
}

const byName = (nameOf: (addr: string) => string) => (a: Fn, b: Fn): number => nameOf(a.addr).localeCompare(nameOf(b.addr));

type Placed = { readonly segments: readonly string[]; readonly leaf: TreeKind; readonly sep: string; readonly member: string };

/** Where a function sits in the tree: under its source file when the engine knows it, else under its namespaces and class. */
function place(fn: Fn, name: string): Placed | null {
  if (fn.file) {
    const segments = fn.file.split("/").filter(Boolean);
    const prefix = fn.file.replace(/\.[^./]+$/, "").replaceAll("/", ".");
    const member = name.startsWith(prefix) && name.length > prefix.length ? name.slice(prefix.length).replace(/^[.$]/, "") : name;
    return { segments, leaf: "file", sep: ".", member };
  }
  if (fn.kind !== "function") return null;
  const split = splitOwner(name);
  if (!split) return null;
  return { segments: split.owner.split("::").filter(Boolean), leaf: "class", sep: "::", member: split.member };
}

type TreeNode = {
  readonly name: string;
  readonly path: string;
  readonly sep: string;
  tree: TreeKind;
  count: number;
  readonly children: Map<string, TreeNode>;
  readonly fns: { readonly fn: Fn; readonly member: string }[];
};

function child(parent: TreeNode, name: string, sep: string): TreeNode {
  const found = parent.children.get(name);
  if (found) return found;
  const made: TreeNode = { name, path: parent.path ? `${parent.path}/${name}` : `${sep}${name}`, sep, tree: "folder", count: 0, children: new Map(), fns: [] };
  parent.children.set(name, made);
  return made;
}

const FOLDERS_FIRST: Readonly<Record<TreeKind, number>> = { folder: 0, class: 1, file: 1 };

/** A folder holding only one other folder shows as one row, `com.google.android`, the way editors compact them. */
function compact(node: TreeNode): { readonly node: TreeNode; readonly name: string } {
  let at = node;
  let name = node.name;
  for (;;) {
    const only = at.children.size === 1 ? [...at.children.values()][0] : undefined;
    if (at.tree !== "folder" || at.fns.length > 0 || !only || only.tree !== "folder") return { node: at, name };
    at = only;
    name = `${name}${at.sep}${at.name}`;
  }
}

function emit(node: TreeNode, depth: number, folded: ReadonlySet<string>, out: FnRow[]): void {
  const { node: shown, name } = compact(node);
  const open = !folded.has(shown.path);
  const ext = shown.tree === "file" ? (shown.name.split(".").pop() ?? "").toLowerCase() : "";
  out.push({ kind: "node", path: shown.path, name, tree: shown.tree, ext, depth, count: shown.count, open });
  if (!open) return;
  const kids = [...shown.children.values()].sort((a, b) => FOLDERS_FIRST[a.tree] - FOLDERS_FIRST[b.tree] || a.name.localeCompare(b.name));
  for (const kid of kids) emit(kid, depth + 1, folded, out);
  for (const { fn, member } of [...shown.fns].sort((a, b) => a.member.localeCompare(b.member))) out.push({ kind: "fn", fn, label: member, depth: depth + 1 });
}

/** The functions as a tree: packages and source files, or namespaces and classes, then the functions that belong to neither. */
function fileRows(fns: readonly Fn[], nameOf: (addr: string) => string, folded: ReadonlySet<string>): readonly FnRow[] {
  const root: TreeNode = { name: "", path: "", sep: "", tree: "folder", count: 0, children: new Map(), fns: [] };
  const loose: Fn[] = [];
  for (const fn of fns) {
    const placed = place(fn, nameOf(fn.addr));
    if (!placed) {
      loose.push(fn);
      continue;
    }
    let at = root;
    placed.segments.forEach((segment, ix) => {
      at = child(at, segment, placed.sep);
      at.count++;
      if (ix === placed.segments.length - 1) at.tree = placed.leaf;
    });
    at.fns.push({ fn, member: placed.member });
  }
  const out: FnRow[] = [];
  const tops = [...root.children.values()].sort((a, b) => FOLDERS_FIRST[a.tree] - FOLDERS_FIRST[b.tree] || a.name.localeCompare(b.name));
  for (const top of tops) emit(top, 0, folded, out);
  const rank = (fn: Fn): number => (fn.kind === "thunk" ? 1 : 0);
  for (const fn of [...loose].sort((a, b) => rank(a) - rank(b) || byName(nameOf)(a, b))) out.push({ kind: "fn", fn, label: nameOf(fn.addr), depth: 0 });
  return out;
}

/** The function list as the sidebar draws it: filtered, then as a file tree or sorted flat. */
export function functionRows(fns: readonly Fn[], options: {
  readonly nameOf: (addr: string) => string;
  readonly renamed: ReadonlySet<string>;
  readonly query: string;
  readonly show: FnShow;
  readonly sort: FnSort;
  readonly folded: ReadonlySet<string>;
}): readonly FnRow[] {
  const { nameOf, renamed, query, show, sort, folded } = options;
  const needle = query.trim().toLowerCase();
  const shown = fns.filter((fn) => {
    if (show === "renamed" && !renamed.has(fn.addr)) return false;
    if (show === "imports" && fn.kind !== "thunk") return false;
    return !needle || nameOf(fn.addr).toLowerCase().includes(needle) || fn.addr.includes(needle) || (fn.file?.toLowerCase().includes(needle) ?? false);
  });
  const flat = (list: readonly Fn[]): readonly FnRow[] => list.map((fn) => ({ kind: "fn", fn, label: nameOf(fn.addr), depth: 0 }));
  if (sort === "address") return flat([...shown].sort((a, b) => (BigInt(a.addr) < BigInt(b.addr) ? -1 : 1)));
  if (sort === "name") return flat([...shown].sort(byName(nameOf)));
  return fileRows(shown, nameOf, folded);
}

export type SourceNode = {
  readonly path: string;
  readonly name: string;
  readonly depth: number;
  readonly folder: boolean;
  readonly ext: string;
  /** The path as the binary spells it; empty for folders. */
  readonly full: string;
};

const SOURCE = /(?:^|[\s"'(])((?:\/|[A-Za-z]:\\|\.{0,2}\/)?(?:[\w.@+-]+\/)+[\w.@+-]+\.(?:swift|mm|m|c|cc|cpp|cxx|h|hh|hpp|metal|rs|go|kt|java))(?=$|[\s"':),])/;

/** Source file paths that compilers leave in a binary's strings (asserts, logging, #file), deduplicated. */
export function sourcePaths(strings: readonly string[]): readonly string[] {
  const found = new Set<string>();
  for (const text of strings) {
    const match = SOURCE.exec(text);
    if (match?.[1]) found.add(match[1].replace(/\\/g, "/"));
  }
  return [...found];
}

function commonDir(paths: readonly (readonly string[])[]): number {
  const first = paths[0];
  if (!first) return 0;
  let depth = 0;
  while (depth < first.length - 1 && paths.every((parts) => parts.length - 1 > depth && parts[depth] === first[depth])) depth++;
  return depth;
}

/** The paths as a tree, the shared build-machine prefix dropped, folders before files, open folders expanded. */
export function sourceTree(paths: readonly string[], closed: ReadonlySet<string>): readonly SourceNode[] {
  const split = paths.map((path) => path.split("/").filter(Boolean));
  const keep = Math.max(0, commonDir(split) - 1);
  const files = split.map((parts) => parts.slice(keep));
  const nodes = new Map<string, SourceNode>();
  files.forEach((parts, ix) => {
    parts.forEach((name, depth) => {
      const path = parts.slice(0, depth + 1).join("/");
      const folder = depth < parts.length - 1;
      if (!nodes.has(path)) nodes.set(path, { path, name, depth, folder, ext: folder ? "" : (name.split(".").pop() ?? "").toLowerCase(), full: folder ? "" : (paths[ix] ?? "") });
    });
  });
  const sorted = [...nodes.values()].sort((a, b) => {
    const pa = a.path.split("/");
    const pb = b.path.split("/");
    for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
      if (pa[i] === pb[i]) continue;
      const aFolder = i < pa.length - 1 || a.folder;
      const bFolder = i < pb.length - 1 || b.folder;
      if (aFolder !== bFolder) return aFolder ? -1 : 1;
      return (pa[i] ?? "").localeCompare(pb[i] ?? "");
    }
    return pa.length - pb.length;
  });
  return sorted.filter((node) => ![...closed].some((dir) => node.path.startsWith(`${dir}/`)));
}

const LOGOS: Readonly<Record<string, string>> = {
  swift: "lang-swift", m: "lang-objc", mm: "lang-objcpp", c: "lang-c", cc: "lang-cpp", cpp: "lang-cpp", cxx: "lang-cpp",
  h: "lang-h", hh: "lang-hpp", hpp: "lang-hpp", metal: "lang-metal", rs: "lang-rust", go: "lang-go", kt: "lang-kotlin", java: "lang-java",
};

export function logoFor(ext: string): string {
  return LOGOS[ext] ?? "lang-plist";
}
