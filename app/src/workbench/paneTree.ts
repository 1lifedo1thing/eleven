export type Dir = "row" | "column";

export type Side = "left" | "right" | "top" | "bottom";

/** How the editor panes are arranged: a pane (by its index in `panes`), or panes split side by side or stacked. */
export type PaneTree =
  | { readonly kind: "pane"; readonly pane: number }
  | { readonly kind: "split"; readonly dir: Dir; readonly children: readonly PaneTree[]; readonly weights: readonly number[] };

/** Where a split sits in the tree: the child index taken at each level from the root. */
export type TreePath = readonly number[];

export function leaf(pane: number): PaneTree {
  return { kind: "pane", pane };
}

/** `count` panes side by side with equal widths, the layout before any split down. */
export function rowOf(count: number, weights?: readonly number[]): PaneTree {
  if (count <= 1) return leaf(0);
  const children = Array.from({ length: count }, (_, ix) => leaf(ix));
  return { kind: "split", dir: "row", children, weights: weights ?? children.map(() => 1) };
}

function dirOf(side: Side): Dir {
  return side === "left" || side === "right" ? "row" : "column";
}

function after(side: Side): boolean {
  return side === "right" || side === "bottom";
}

/** Shifts pane numbers by `by` for every pane at or past `from`, as `panes` gains or loses an entry. */
export function renumber(tree: PaneTree, from: number, by: number): PaneTree {
  if (tree.kind === "pane") return tree.pane >= from ? leaf(tree.pane + by) : tree;
  return { ...tree, children: tree.children.map((child) => renumber(child, from, by)) };
}

/** Puts pane `fresh` beside pane `target`, halving the space `target` had. */
export function splitBeside(tree: PaneTree, target: number, fresh: number, side: Side): PaneTree {
  const dir = dirOf(side);
  const pair = (at: PaneTree): readonly PaneTree[] => (after(side) ? [at, leaf(fresh)] : [leaf(fresh), at]);
  if (tree.kind === "pane") return tree.pane === target ? { kind: "split", dir, children: pair(tree), weights: [1, 1] } : tree;
  const at = tree.children.findIndex((child) => child.kind === "pane" && child.pane === target);
  if (at >= 0 && tree.dir === dir) {
    const half = (tree.weights[at] ?? 1) / 2;
    const place = after(side) ? at + 1 : at;
    const weights = tree.weights.map((w, ix) => (ix === at ? half : w));
    return { ...tree, children: [...tree.children.slice(0, place), leaf(fresh), ...tree.children.slice(place)], weights: [...weights.slice(0, place), half, ...weights.slice(place)] };
  }
  return { ...tree, children: tree.children.map((child) => splitBeside(child, target, fresh, side)) };
}

function without(tree: PaneTree, pane: number): PaneTree | null {
  if (tree.kind === "pane") return tree.pane === pane ? null : tree;
  const gone = tree.children.findIndex((child) => child.kind === "pane" && child.pane === pane);
  if (gone < 0) {
    const children = tree.children.map((child) => without(child, pane)).filter((child): child is PaneTree => child !== null);
    return { ...tree, children };
  }
  const heir = gone > 0 ? gone - 1 : gone + 1;
  const weights = tree.weights.map((w, ix) => (ix === heir ? w + (tree.weights[gone] ?? 0) : w)).filter((_, ix) => ix !== gone);
  const children = tree.children.filter((_, ix) => ix !== gone);
  return children.length === 1 && children[0] ? children[0] : { ...tree, children, weights };
}

/** Drops pane `pane`: the pane before it (or after, when it is first) takes its space, and later panes renumber down. */
export function removePane(tree: PaneTree, pane: number): PaneTree {
  return renumber(normalize(without(tree, pane) ?? leaf(0)), pane + 1, -1);
}

/** Folds a split inside a split of the same direction into its parent, so the tree stays flat where it can. */
export function normalize(tree: PaneTree): PaneTree {
  if (tree.kind === "pane") return tree;
  const children: PaneTree[] = [];
  const weights: number[] = [];
  tree.children.forEach((raw, ix) => {
    const child = normalize(raw);
    const weight = tree.weights[ix] ?? 1;
    if (child.kind === "split" && child.dir === tree.dir) {
      const total = child.weights.reduce((sum, w) => sum + w, 0) || 1;
      child.children.forEach((inner, jx) => {
        children.push(inner);
        weights.push((weight * (child.weights[jx] ?? 1)) / total);
      });
      return;
    }
    children.push(child);
    weights.push(weight);
  });
  return children.length === 1 && children[0] ? children[0] : { ...tree, children, weights };
}

/** The split at `path`, or null when the path leads nowhere. */
export function splitAt(tree: PaneTree, path: TreePath): Extract<PaneTree, { kind: "split" }> | null {
  let node: PaneTree | undefined = tree;
  for (const step of path) node = node?.kind === "split" ? node.children[step] : undefined;
  return node?.kind === "split" ? node : null;
}

function mapAt(tree: PaneTree, path: TreePath, change: (split: Extract<PaneTree, { kind: "split" }>) => PaneTree): PaneTree {
  if (tree.kind === "pane") return tree;
  const [step, ...rest] = path;
  if (step === undefined) return change(tree);
  return { ...tree, children: tree.children.map((child, ix) => (ix === step ? mapAt(child, rest, change) : child)) };
}

/** Sets the weights of the two children either side of divider `index` in the split at `path`. */
export function resizeAt(tree: PaneTree, path: TreePath, index: number, pair: readonly [number, number]): PaneTree {
  return mapAt(tree, path, (split) => ({ ...split, weights: split.weights.map((w, ix) => (ix === index ? pair[0] : ix === index + 1 ? pair[1] : w)) }));
}

export function equalize(tree: PaneTree): PaneTree {
  if (tree.kind === "pane") return tree;
  return { ...tree, children: tree.children.map(equalize), weights: tree.children.map(() => 1) };
}

/** Pane numbers in reading order: left to right, top to bottom. */
export function panesIn(tree: PaneTree): readonly number[] {
  return tree.kind === "pane" ? [tree.pane] : tree.children.flatMap(panesIn);
}

/** The most panes that sit side by side anywhere in the tree, to tell how wide the editor must be. */
export function across(tree: PaneTree): number {
  if (tree.kind === "pane") return 1;
  const counts = tree.children.map(across);
  return tree.dir === "row" ? counts.reduce((sum, n) => sum + n, 0) : Math.max(...counts);
}

/** True when the tree names each of panes 0..count-1 exactly once. */
export function fits(tree: PaneTree, count: number): boolean {
  const seen = panesIn(tree);
  return seen.length === count && new Set(seen).size === count && seen.every((n) => n >= 0 && n < count);
}
