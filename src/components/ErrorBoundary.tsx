import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    localStorage.removeItem('cnw_active_session');
    sessionStorage.removeItem('cnw_active_session');
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#02353C] flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full p-6 rounded-3xl shadow-xl text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-2xl">
              ⚠️
            </div>
            <h2 className="text-lg font-black text-slate-800">Application Notice</h2>
            <p className="text-xs text-slate-500">
              The application encountered an unexpected issue while loading data.
            </p>
            {this.state.error && (
              <pre className="p-3 bg-slate-100 rounded-xl text-[11px] text-rose-700 text-left overflow-x-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReset}
              className="w-full py-3 bg-[#02353C] hover:bg-[#034953] text-[#C1F6ED] font-bold text-xs rounded-xl shadow-md transition-colors"
            >
              Reset Session & Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
