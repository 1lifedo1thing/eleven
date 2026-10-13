import type { ReactElement, ReactNode } from "react";

import { useTheme } from "../theme";
import { Icon } from "../components/ui";

export type StepStatus = "complete" | "active" | "pending";

/** The steps an agent took, folded under one line: its icon, what it's doing, and a chevron to open or close them. */
export function ChainOfThought({ label, open, onToggle, children }: {
  readonly label: string;
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly children: ReactNode;
}): ReactElement {
  const { p } = useTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <div onClick={onToggle} role="button" aria-expanded={open} aria-label={label} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", fontSize: 14, color: p.muted, cursor: "pointer", hover: { opacity: 0.72 } }}>
        <Icon name="brain" size={16} color={p.muted} />
        <div style={{ flexGrow: 1, minWidth: 0 }}>{label}</div>
        <Icon name={open ? "collapse" : "disclosure"} size={16} color={p.muted} />
      </div>
      {open && <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>{children}</div>}
    </div>
  );
}

/** One step: an icon on a line that runs down to the next step, the label, a quieter description, and anything it found. */
export function ChainOfThoughtStep({ icon, label, description, status, tone = null, children }: {
  readonly icon: string | null;
  readonly label: ReactNode;
  readonly description?: ReactNode;
  readonly status: StepStatus;
  readonly tone?: string | null;
  readonly children?: ReactNode;
}): ReactElement {
  const { p } = useTheme();
  const color = tone ?? (status === "active" ? p.text : p.muted);
  return (
    <div style={{ display: "flex", gap: 8, fontSize: 14, color, ...(status === "pending" ? { opacity: 0.5 } : {}) }}>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", width: 16, flexShrink: 0, marginTop: 2 }}>
        {icon ? <Icon name={icon} size={16} color={color} /> : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 16, height: 16 }}><div style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: color }} /></div>}
        <div style={{ position: "absolute", top: 28, bottom: 0, left: 7.5, width: 1, backgroundColor: p.line2 }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flexGrow: 1, minWidth: 0, overflow: "hidden" }}>
        <div>{label}</div>
        {description && <div style={{ fontSize: 12, color: p.muted }}>{description}</div>}
        {children}
      </div>
    </div>
  );
}

/** What a step turned up, as small badges; each can be clicked when it names something you can open. */
export function ChainOfThoughtResults({ items, onPick }: { readonly items: readonly string[]; readonly onPick: ((item: string) => void) | null }): ReactElement {
  const { p } = useTheme();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      {items.map((item) => (
        <div key={item} {...(onPick ? { onClick: () => onPick(item), role: "button" } : {})} aria-label={item} style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 6, backgroundColor: p.fill2, fontSize: 12, color: p.text3, whiteSpace: "nowrap", ...(onPick ? { cursor: "pointer", hover: { opacity: 0.72 } } : {}) }}>
          {item}
        </div>
      ))}
    </div>
  );
}
