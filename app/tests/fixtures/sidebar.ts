import type { Screen } from "../harness";

function anyLabel(node: unknown, test: (label: string) => boolean): boolean {
  if (typeof node !== "object" || node === null) return false;
  const props = "customProps" in node ? node.customProps : null;
  const label = typeof props === "object" && props !== null && "aria-label" in props ? props["aria-label"] : null;
  if (typeof label === "string" && test(label)) return true;
  const children = "children" in node ? node.children : null;
  return Array.isArray(children) && children.some((child: unknown) => anyLabel(child, test));
}

async function openSection(screen: Screen): Promise<void> {
  await screen.until(() => screen.labelled("Functions") !== null, 30_000);
  if (screen.labelled("Filter functions") === null) screen.clickLabel("Functions");
  await screen.until(() => screen.labelled("Filter functions") !== null, 10_000);
}

/** Opens whatever is still closed on the way to the unnamed functions: the Functions section, Your code, then Unnamed. */
export async function showFunctions(screen: Screen): Promise<void> {
  const unnamedShown = (): boolean => anyLabel(screen.ui.renderer.toJSON(), (label) => /^function (?:thunk_)?FUN_/.test(label));
  await openSection(screen);
  await screen.until(() => screen.labelled("Your code") !== null || screen.labelled("Unnamed") !== null, 30_000);
  if (screen.labelled("Unnamed") === null) screen.clickLabel("Your code");
  await screen.until(() => screen.labelled("Unnamed") !== null, 10_000);
  if (!unnamedShown()) screen.clickLabel("Unnamed");
  await screen.until(unnamedShown, 10_000);
}

/** Finds one function the way a person would in a long list: by typing its name into the filter. */
export async function findFunction(screen: Screen, name: string): Promise<void> {
  await openSection(screen);
  screen.type("Filter functions", `cmd-a backspace ${name.split("").join(" ")}`);
  await screen.until(() => screen.labelled(`function ${name}`) !== null, 10_000);
}

export function clearFilter(screen: Screen): void {
  screen.type("Filter functions", "cmd-a backspace");
}
