import { Component } from 'react';
import { Button, Icon } from '@/components/ui';

/**
 * Catches render-time failures so a single broken screen does not leave the
 * candidate staring at a blank page mid-revision.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // In production this is where an error reporter would be called.
    console.error('Unhandled interface error', error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-paper-100 px-6">
        <div className="w-full max-w-md rounded-2xl border border-paper-300 bg-white p-8 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger-50 text-danger-500">
            <Icon name="alert" size={26} />
          </div>
          <h1 className="font-serif text-xl font-semibold text-ink-900">This page ran into a problem</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">
            Your work is saved. Reloading usually clears it.
          </p>
          {import.meta.env.DEV && (
            <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-paper-100 p-3 text-left text-[11px] text-ink-600">
              {error.message}
            </pre>
          )}
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="secondary" onClick={() => this.setState({ error: null })}>
              Try again
            </Button>
            <Button onClick={() => window.location.reload()}>Reload the page</Button>
          </div>
        </div>
      </div>
    );
  }
}
