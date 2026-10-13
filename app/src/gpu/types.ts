export type FunctionKind = "compute" | "vertex" | "fragment";

export type Binding = { readonly slot: string; readonly type: string };

export type LoadedBy = { readonly symbol: string; readonly note: string };

export type ShaderFunction = {
  readonly name: string;
  readonly kind: FunctionKind;
  readonly ir: string;
  readonly bindings: readonly Binding[];
  readonly loadedBy: LoadedBy | null;
};

export type ShaderLibrary = { readonly name: string; readonly format: string; readonly functions: readonly ShaderFunction[] };

export type Tensor =
  | { readonly kind: "image"; readonly name: string; readonly shape: readonly number[] }
  | { readonly kind: "tensor"; readonly name: string; readonly shape: readonly number[] };

export type ModelLayer = { readonly name: string; readonly op: string; readonly shape: string; readonly type: string };

export type ModelRisk = { readonly title: string; readonly detail: string };

export type ModelInfo = {
  readonly name: string;
  readonly format: string;
  readonly weights: string;
  readonly inputs: readonly Tensor[];
  readonly outputs: readonly Tensor[];
  readonly layers: readonly ModelLayer[];
  readonly risk: ModelRisk | null;
};

export type SpanTone = "cpu" | "wait" | "kernel" | "light";

export type SpanStat = { readonly label: string; readonly value: string };

export type Span = {
  readonly id: string;
  readonly label: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly tone: SpanTone;
  readonly stats: readonly SpanStat[];
  readonly advice: readonly string[];
};

export type Lane = { readonly name: string; readonly spans: readonly Span[] };

export type Recording = {
  readonly title: string;
  readonly source: string;
  readonly frameMs: number;
  readonly tickMs: number;
  readonly lanes: readonly Lane[];
};

