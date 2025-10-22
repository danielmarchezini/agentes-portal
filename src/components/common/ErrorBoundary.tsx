import React from 'react';

type State = { hasError: boolean; error?: any };

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: any): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center p-6">
          <div className="max-w-md text-center border rounded-md p-6 bg-background">
            <h2 className="text-xl font-semibold mb-2">Ocorreu um erro inesperado</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Tente novamente. Se o problema persistir, atualize a página ou contate o administrador.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={this.handleRetry} className="px-3 py-2 rounded-md border">Tentar novamente</button>
              <button onClick={() => window.location.reload()} className="px-3 py-2 rounded-md border">Recarregar</button>
            </div>
            {import.meta.env.DEV && this.state.error && (
              <pre className="text-left text-xs mt-4 overflow-auto max-h-48 bg-muted p-3 rounded">
                {String(this.state.error?.stack || this.state.error)}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children as React.ReactElement;
  }
}
