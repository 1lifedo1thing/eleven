import type { ReactElement } from "react";

import { useTheme } from "../theme";
import { useCodeLook } from "../settings/look";
import { alertColors, text } from "./look";
import type { ModelInfo, ModelLayer, ModelRisk, Tensor } from "./types";

type Fact = { readonly label: string; readonly value: string; readonly mono: boolean };

const COLUMNS = [
  { label: "Layer", weight: 262 },
  { label: "Op", weight: 317.4 },
  { label: "Output shape", weight: 280.5 },
  { label: "Type", weight: 280.5 },
] as const;

function Cell({ value, weight, color }: { readonly value: string; readonly weight: number; readonly color: string }): ReactElement {
  return <div style={{ flexGrow: weight, flexBasis: 0, minWidth: 0, paddingLeft: 12, paddingRight: 12, color }}>{value}</div>;
}

function FactCard({ fact }: { readonly fact: Fact }): ReactElement {
  const { p } = useTheme();
  const { family } = useCodeLook();
  return (
    <div style={{ display: "flex", flexDirection: "column", padding: 12, borderWidth: 1, borderColor: p.sel, borderRadius: 10 }}>
      <div style={{ color: p.muted, ...text(12) }}>{fact.label}</div>
      <div style={fact.mono ? { fontFamily: family } : { fontWeight: 500 }}>{fact.value}</div>
    </div>
  );
}

function LayerRow({ layer }: { readonly layer: ModelLayer }): ReactElement {
  const { p } = useTheme();
  const { family } = useCodeLook();
  const [name, op, shape, type] = COLUMNS;
  return (
    <div style={{ display: "flex", alignItems: "center", height: 33.1, borderTopWidth: 1, borderColor: p.raised2, fontFamily: family, ...text(12.5) }}>
      <Cell value={layer.name} weight={name.weight} color={p.text} />
      <Cell value={layer.op} weight={op.weight} color={p.keyword} />
      <Cell value={layer.shape} weight={shape.weight} color={p.text4} />
      <Cell value={layer.type} weight={type.weight} color={p.kind} />
    </div>
  );
}

function tensorText(tensor: Tensor): string {
  switch (tensor.kind) {
    case "image":
      return `${tensor.name} ${tensor.shape.join("×")}`;
    case "tensor":
      return `${tensor.name}[${tensor.shape.join(",")}]`;
    default: {
      const unhandled: never = tensor;
      return unhandled;
    }
  }
}

function factsOf(model: ModelInfo): readonly Fact[] {
  return [
    { label: "Format", value: model.format, mono: false },
    { label: "Weights", value: model.weights, mono: false },
    { label: "Input", value: model.inputs.map(tensorText).join(", ") || "Unknown", mono: true },
    { label: "Output", value: model.outputs.map(tensorText).join(", ") || "Unknown", mono: true },
  ];
}

function Layers({ layers }: { readonly layers: readonly ModelLayer[] }): ReactElement {
  const { p } = useTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", borderWidth: 1, borderColor: p.sel, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", height: 34.6, fontWeight: 500, color: p.muted, ...text(12.5) }}>
        {COLUMNS.map((c) => <Cell key={c.label} value={c.label} weight={c.weight} color={p.muted} />)}
      </div>
      {layers.map((layer) => <LayerRow key={layer.name} layer={layer} />)}
    </div>
  );
}

function RiskAlert({ risk }: { readonly risk: ModelRisk }): ReactElement {
  const { p } = useTheme();
  const tone = alertColors(p);
  return (
    <div role="alert" style={{ display: "flex", flexDirection: "column", paddingTop: 12, paddingBottom: 12, paddingLeft: 14, paddingRight: 14, borderWidth: 1, borderColor: tone.line, borderRadius: 10, backgroundColor: tone.bg }}>
      <div style={{ fontWeight: 500 }}>{risk.title}</div>
      <div style={{ color: p.text2 }}>{risk.detail}</div>
    </div>
  );
}

/** A model's header facts and layer list, read without loading it, plus every model file that runs code on load. */
export function ModelView({ model, risks, onAsk }: { readonly model: ModelInfo; readonly risks: readonly ModelRisk[]; readonly onAsk: () => void }): ReactElement {
  const { p } = useTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, flexGrow: 1, minHeight: 0, overflowY: "scroll", padding: 18 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 10, flexShrink: 0 }}>
        <div style={{ fontWeight: 600, ...text(18) }}>{model.name}</div>
        <div style={{ flexGrow: 1, paddingBottom: 2.3, color: p.muted }}>Read from the file's headers only. Nothing was loaded or run.</div>
        <div onClick={onAsk} role="button" style={{ display: "flex", alignItems: "center", height: 28, paddingLeft: 10, paddingRight: 10, borderWidth: 1, borderColor: p.line3, borderRadius: 8, backgroundColor: p.sel, color: p.text, cursor: "pointer", hover: { opacity: 0.72 } }}>
          <div>Ask AI about this model</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: 4, gap: 10, flexShrink: 0 }}>
        {factsOf(model).map((f) => <FactCard key={f.label} fact={f} />)}
      </div>
      {model.layers.length > 0 && <Layers layers={model.layers} />}
      {risks.map((r) => <RiskAlert key={r.title} risk={r} />)}
    </div>
  );
}
