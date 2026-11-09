import { Component, type ErrorInfo, type ReactNode } from "react";
import StatusPage from "./StatusPage";

interface Props {
  children: ReactNode;
  /** Full page (top level) or inside the signed-in layout (keeps the navigation). */
  standalone?: boolean;
}

/** Catches crashes so people see a friendly page instead of a blank screen or code. */
export default class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Only the developer console sees details.
    console.error("Stayblz page error", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <StatusPage kind="error" standalone={this.props.standalone} />;
  }
}
