import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Catches an error while drawing the page, so one bad file or saved setting shows a message and a
 * way back instead of a blank window.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="crash" role="alert">
        <h1>Something went wrong</h1>
        <p>Speedrunner hit an error drawing this page. Your profile and split files are still saved.</p>
        <p className="crash-detail">{this.state.error.message}</p>
        <button
          className="primary"
          onClick={() => {
            // Back to Analyse a run, where nothing is loaded yet.
            history.replaceState(null, "", window.location.pathname);
            window.location.reload();
          }}
        >
          Start over
        </button>
      </main>
    );
  }
}
