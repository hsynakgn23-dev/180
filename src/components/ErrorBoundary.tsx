import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-[#121212] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
                    <h1 className="text-4xl font-bold text-sage mb-4">Something went wrong.</h1>
                    <p className="text-gray-400 mb-8 max-w-md">The ritual was interrupted. Please try refreshing the page or clearing your local data.</p>

                    <div className="bg-black/30 p-4 rounded text-left overflow-auto max-w-2xl max-h-64 mb-8 border border-white/10">
                        <p className="text-red-400 font-mono text-xs">{this.state.error?.toString()}</p>
                    </div>

                    <button
                        onClick={() => {
                            localStorage.clear();
                            window.location.reload();
                        }}
                        className="px-6 py-2 bg-sage/20 text-sage border border-sage/50 rounded hover:bg-sage/30 transition-colors uppercase tracking-widest text-xs font-bold"
                    >
                        Clear Data & Restart
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
