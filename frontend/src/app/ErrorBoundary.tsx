import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex min-h-screen items-center justify-center px-4"
          style={{ background: 'var(--background)' }}
        >
          <div
            className="w-full max-w-md rounded-2xl border p-8"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--border)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div className="mb-6">
              <h1
                className="mb-2 text-2xl font-bold"
                style={{ color: 'var(--foreground)', fontFamily: 'var(--font-headline)' }}
              >
                Something went wrong
              </h1>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                We encountered an unexpected error. Please try refreshing the page.
              </p>
            </div>

            {import.meta.env.DEV && this.state.error && (
              <div
                className="mb-6 rounded-lg border p-4"
                style={{
                  borderColor: 'var(--destructive)',
                  background: 'rgba(220, 38, 38, 0.06)',
                }}
              >
                <p className="mb-2 font-mono text-xs" style={{ color: 'var(--destructive)' }}>
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <pre
                    className="overflow-auto text-xs"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
                style={{
                  background: 'var(--ember-orange)',
                  color: '#ffffff',
                }}
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                style={{
                  borderColor: 'var(--border)',
                  background: 'transparent',
                  color: 'var(--foreground)',
                }}
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
