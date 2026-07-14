import { Component, type ReactNode } from "react";

/** Aísla fallos de render de un dashboard bespoke: si uno rompe, mostramos
    el respaldo en vez de tumbar toda la app. */
export default class ErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean; message: string }
> {
  state = { failed: false, message: "" };

  static getDerivedStateFromError(err: unknown) {
    return { failed: true, message: String((err as Error)?.message ?? err) };
  }

  render() {
    if (this.state.failed) {
      return (
        <>
          <div className="error-caja" style={{ marginBottom: "1rem" }}>
            El panel bespoke falló ({this.state.message}). Mostrando la vista genérica.
          </div>
          {this.props.fallback}
        </>
      );
    }
    return this.props.children;
  }
}
