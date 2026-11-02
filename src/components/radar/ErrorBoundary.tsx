import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: string }
> {
  state = { error: "" };

  static getDerivedStateFromError(error: unknown) {
    return {
      error: error instanceof Error ? error.message : "The screen failed to load.",
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="radar-screen" role="alert">
        <h1>This screen hit an error</h1>
        <p>{this.state.error}</p>
        <button
          type="button"
          className="campus-primary"
          onClick={() => {
            window.location.hash = "campus";
            window.location.reload();
          }}
        >
          Reload the campus
        </button>
      </section>
    );
  }
}
