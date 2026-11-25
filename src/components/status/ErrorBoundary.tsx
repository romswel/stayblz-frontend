import { Component, type ErrorInfo, type ReactNode } from "react";
import StatusPage, { type StatusKind } from "./StatusPage";
import { isStaleBuildError, reloadForUpdate } from "../../staleBuild";

interface Props {
  children: ReactNode;
  /** Full page (top level) or inside the signed-in layout (keeps the navigation). */
  standalone?: boolean;
}

/**
 * Catches crashes so people see a friendly page instead of a blank screen or code. A page file that no longer exists
 * after a release reloads once by itself ("outdated"); offline, it says so instead of "something went wrong".
 */
export default class ErrorBoundary extends Component<Props, { failed: StatusKind | null }> {
  state: { failed: StatusKind | null } = { failed: null };

  static getDerivedStateFromError(error: unknown) {
    const stale = isStaleBuildError(error);
    return { failed: (stale && navigator.onLine === false ? "offline" : stale ? "outdated" : "error") as StatusKind };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (this.state.failed === "outdated" && reloadForUpdate()) return;
    // Only the developer console sees details.
    console.error("Stayblz page error", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <StatusPage kind={this.state.failed} standalone={this.props.standalone} />;
  }
}
