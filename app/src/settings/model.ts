import type { AgentIcon } from "../agents/icons";

export type Tone = "good" | "warn" | "quiet";

export type Lead =
  | { readonly kind: "img"; readonly src: string; readonly darkSrc?: string }
  | { readonly kind: "agent"; readonly icon: AgentIcon | null }
  | { readonly kind: "box"; readonly text: string };

export type ButtonStyle = "plain" | "primary" | "danger";

export type Action = { readonly label: string; readonly style: ButtonStyle; readonly act: () => void };

export type Confirm = { readonly id: string; readonly text: string; readonly label: string; readonly act: () => void };

export type Option = { readonly value: string; readonly label: string; readonly note?: string };

export type Control =
  | { readonly kind: "none" }
  | { readonly kind: "toggle"; readonly on: boolean; readonly flip: () => void }
  | { readonly kind: "seg"; readonly options: readonly Option[]; readonly value: string; readonly pick: (value: string) => void }
  | { readonly kind: "select"; readonly options: readonly Option[]; readonly value: string; readonly pick: (value: string) => void }
  | { readonly kind: "range"; readonly min: number; readonly max: number; readonly step: number; readonly value: number; readonly unit: string; readonly set: (value: number) => void }
  | { readonly kind: "input"; readonly value: string; readonly placeholder: string; readonly set: (value: string) => void };

export type SettingRowModel = {
  readonly title: string;
  readonly desc: string;
  readonly keywords?: string;
  readonly mono?: boolean;
  readonly lead?: Lead;
  readonly tag?: string;
  readonly status?: { readonly text: string; readonly tone: Tone };
  readonly pick?: { readonly on: boolean; readonly act: () => void };
  readonly dim?: boolean;
  readonly control: Control;
  readonly buttons?: readonly Action[];
  readonly confirm?: Confirm;
};

export type GroupModel = {
  readonly label: string | null;
  readonly foot?: string;
  readonly preview?: "code" | "address" | "window";
  readonly rows: readonly SettingRowModel[];
};
