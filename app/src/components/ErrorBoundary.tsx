import { Component, type ErrorInfo, type ReactNode } from "react";

import { errorMessage } from "../lib/guards";
import { MONO } from "../theme";

type State = { readonly error: string | null };

/** Shows a render error in the window instead of taking the app down, so a hot reload can recover from it. */
export class ErrorBoundary extends Component<{ readonly children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: errorMessage(error) };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(errorMessage(error), info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error === null) return this.props.children;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", height: "100%", padding: 40, backgroundColor: "#171717", color: "#ededed" }}>
        <div style={{ fontSize: 16 }}>Something broke while drawing this screen. Save a fix and it reloads.</div>
        <div style={{ fontFamily: MONO, fontSize: 12, color: "#e06c75" }}>{this.state.error}</div>
      </div>
    );
  }
}
