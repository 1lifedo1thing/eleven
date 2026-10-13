import type { ReactElement, ReactNode } from "react";

import { MenuRows } from "../components/MenuRows";
import { useTheme } from "../theme";
import { Icon, MenuSurface, Popover, usePopover } from "../components/ui";

const ROW = 33;
const ROW_WITH_HINT = 51.5;
const ROWS_MAX = 348;

export type Choice<T extends string | number> = {
  readonly value: T;
  readonly label: string;
  readonly hint?: string;
  readonly lead?: ReactNode;
};

function ChoiceRow<T extends string | number>({ choice, selected, onPick }: {
  readonly choice: Choice<T>;
  readonly selected: boolean;
  readonly onPick: () => void;
}): ReactElement {
  const { p } = useTheme();
  return (
    <div onClick={onPick} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 32, flexShrink: 0, paddingTop: 6, paddingBottom: 6, paddingLeft: 9, paddingRight: 9, borderRadius: 8, cursor: "pointer", hover: { opacity: 0.72 }, ...(selected ? { backgroundColor: p.sel } : {}) }}>
      {choice.lead}
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, minWidth: 0 }}>
        <div style={{ color: p.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{choice.label}</div>
        {choice.hint && <div style={{ fontSize: 11.5, color: p.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{choice.hint}</div>}
      </div>
      <div style={{ display: "flex", width: 16 }}>{selected && <Icon name="check" size={14} color={p.text} />}</div>
    </div>
  );
}

/** A bordered "Value ⌄" button that opens a menu of choices under it. */
export function Dropdown<T extends string | number>({ label, value, choices, width = 240, onPick }: {
  readonly label: string;
  readonly value: T;
  readonly choices: readonly Choice<T>[];
  readonly width?: number;
  readonly onPick: (value: T) => void;
}): ReactElement {
  const { p } = useTheme();
  const menu = usePopover();
  const current = choices.find((choice) => choice.value === value);
  const choose = (next: T): void => {
    menu.close();
    onPick(next);
  };
  return (
    <div style={{ display: "flex", position: "relative", flexShrink: 0 }}>
      <div onMouseDown={menu.onTriggerDown} onClick={menu.onTriggerClick} aria-label={label} style={{ display: "flex", alignItems: "center", gap: 7, height: 28, paddingLeft: 10, paddingRight: 8, borderWidth: 1, borderColor: p.line3, borderRadius: 8, fontSize: 12.5, color: p.text2, cursor: "pointer", hover: { opacity: 0.72 } }}>
        {current?.lead}
        <div style={{ whiteSpace: "nowrap" }}>{current?.label ?? String(value)}</div>
        <Icon name="disclosure" size={12} color={p.muted} />
      </div>
      {menu.open && (
        <Popover side="bottom" align="end" gap={6} onDismiss={menu.dismiss}>
          <MenuSurface width={width} maxHeight={360}>
            <MenuRows heights={choices.map((choice) => (choice.hint ? ROW_WITH_HINT : ROW))} maxHeight={ROWS_MAX}>
              {choices.map((choice) => (
                <ChoiceRow key={choice.value} choice={choice} selected={choice.value === value} onPick={() => choose(choice.value)} />
              ))}
            </MenuRows>
          </MenuSurface>
        </Popover>
      )}
    </div>
  );
}
