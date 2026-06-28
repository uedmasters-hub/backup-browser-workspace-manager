import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from "react";

type Props = {
  children: ReactNode;
};

type State = {
  failed: boolean;
};

export default class PopupErrorBoundary extends Component<
  Props,
  State
> {
  state: State = {
    failed: false,
  };

  static getDerivedStateFromError(): State {
    return {
      failed: true,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      "[popup] rendering failed",
      error,
      info.componentStack
    );
  }

  render() {
    if (!this.state.failed) {
      return this.props.children;
    }

    return (
      <main className="flex h-[600px] w-[420px] items-center justify-center bg-[#F6F7FB] p-6">
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <h1 className="text-base font-semibold text-neutral-900">
            The popup needs a refresh
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            Reload the extension after accepting its updated
            permissions.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          >
            Reload popup
          </button>
        </div>
      </main>
    );
  }
}
