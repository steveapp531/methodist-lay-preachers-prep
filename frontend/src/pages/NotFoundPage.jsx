import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useDocumentTitle } from '@/hooks';
import { Button, Icon } from '@/components/ui';
import { CrossFlame } from '@/layouts/AppLayout';

export default function NotFoundPage() {
  useDocumentTitle('Page not found');

  const { isAuthenticated } = useAuth();
  const location = useLocation();

  const home = isAuthenticated ? '/dashboard' : '/';
  const homeLabel = isAuthenticated ? 'Back to your dashboard' : 'Back to the home page';

  return (
    <div className="flex min-h-screen flex-col bg-paper-100">
      <header className="border-b border-paper-300 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center px-4 sm:px-6">
          <Link to={home} className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-800 text-paper-50">
              <CrossFlame />
            </span>
            <span className="leading-tight">
              <span className="block font-serif text-sm font-semibold text-ink-900">Lay Preachers</span>
              <span className="block text-[11px] uppercase tracking-wide text-ink-400">Examination Preparation</span>
            </span>
          </Link>
        </div>
      </header>

      <main id="main-content" className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-lg text-center">
          <p className="tabular font-serif text-5xl font-semibold text-brand-200 sm:text-6xl">404</p>
          <h1 className="mt-4 font-serif text-2xl font-semibold text-ink-900 sm:text-3xl">We cannot find that page</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-600">
            The address may have been mistyped, or the page may have been moved. Nothing of yours has been lost.
          </p>

          <p className="mt-5 inline-flex max-w-full items-center gap-2 rounded-lg border border-paper-300 bg-white px-3.5 py-2 text-sm text-ink-500">
            <Icon name="search" size={15} className="shrink-0 text-ink-400" />
            <span className="truncate font-mono text-xs">{location.pathname}</span>
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button to={home} size="lg">
              {homeLabel}
            </Button>
            {isAuthenticated ? (
              <Button to="/study" variant="secondary" size="lg" icon={<Icon name="book" size={16} />}>
                Go to your study material
              </Button>
            ) : (
              <Button to="/login" variant="secondary" size="lg">
                Sign in
              </Button>
            )}
          </div>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-3xl px-4 pb-8 sm:px-6">
        <p className="border-t border-paper-300 pt-5 text-center text-xs leading-relaxed text-ink-400">
          The Methodist Church Ghana — Connexional Lay Preachers&rsquo; Examination preparation.
        </p>
      </footer>
    </div>
  );
}
