import { Component, type ErrorInfo, type ReactNode } from 'react';

type SectionErrorBoundaryProps = {
    title: string;
    fallbackMessage?: string;
    children?: ReactNode;
};

type SectionErrorBoundaryState = {
    hasError: boolean;
};

export class SectionErrorBoundary extends Component<SectionErrorBoundaryProps, SectionErrorBoundaryState> {
    public state: SectionErrorBoundaryState = {
        hasError: false
    };

    public static getDerivedStateFromError(): SectionErrorBoundaryState {
        return { hasError: true };
    }

    public componentDidCatch(error: Error, info: ErrorInfo) {
        console.error(`[SectionErrorBoundary] ${this.props.title}`, error, info);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <section className="max-w-6xl mx-auto mb-10 rounded-xl border border-red-400/25 bg-red-500/5 px-5 py-6">
                    <h3 className="text-[11px] uppercase tracking-[0.18em] text-red-200 mb-2">{this.props.title}</h3>
                    <p className="text-xs text-red-100/80">
                        {this.props.fallbackMessage || 'This module is temporarily unavailable. Refresh to retry.'}
                    </p>
                </section>
            );
        }

        return this.props.children;
    }
}
