export type ViewName = "pseudocode" | "assembly" | "graph" | "hex";

/** What the user is looking at, as the screen in front reports it. */
export type ViewState = { readonly fn: string | null; readonly address: string | null; readonly view: ViewName | null };

type Controller = (view: ViewName) => boolean;

let state: ViewState = { fn: null, address: null, view: null };
let controller: Controller | null = null;

export function reportView(next: ViewState): void {
  state = next;
}

export function currentView(): ViewState {
  return state;
}

/** The workbench claims view switching while it is open; anything else has only pseudocode. */
export function claimViewSwitch(next: Controller | null): void {
  controller = next;
}

export function switchView(view: ViewName): boolean {
  return controller?.(view) ?? false;
}
