export type StepId = "engine" | "agent" | "keys" | "try";

export type Step = { readonly id: StepId; readonly label: string };

export const STEPS: readonly Step[] = [
  { id: "engine", label: "Engine" },
  { id: "agent", label: "Agent" },
  { id: "keys", label: "Shortcuts" },
  { id: "try", label: "Try it" },
];

export function nextStep(id: StepId): StepId | null {
  return STEPS[STEPS.findIndex((step) => step.id === id) + 1]?.id ?? null;
}

export function previousStep(id: StepId): StepId | null {
  return STEPS[STEPS.findIndex((step) => step.id === id) - 1]?.id ?? null;
}
