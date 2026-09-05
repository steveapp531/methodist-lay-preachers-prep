import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Badge, Button, Icon, cx } from '@/components/ui';
import { initials } from '@/utils/format';
import GlobalSearch from '@/components/GlobalSearch';

const STUDENT_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/study', label: 'Study', icon: 'book' },
  { to: '/quiz', label: 'Quiz', icon: 'quiz' },
  { to: '/mock-exam', label: 'Mock Exam', icon: 'exam' },
  { to: '/flashcards', label: 'Flashcards', icon: 'cards' },
  { to: '/mistakes', label: 'My Mistakes', icon: 'target' },
  { to: '/bookmarks', label: 'Bookmarks', icon: 'bookmark' },
  { to: '/scripture', label: 'Scripture', icon: 'scroll' },
  { to: '/notes', label: 'Notes', icon: 'note' },
  { to: '/progress', label: 'Progress', icon: 'chart' },
];

const ADMIN_NAV = [
  { to: '/admin', label: 'Overview', icon: 'dashboard', end: true },
  { to: '/admin/questions', label: 'Questions', icon: 'quiz' },
  { to: '/admin/content', label: 'Subjects & Topics', icon: 'book' },
  { to: '/admin/mock-exams', label: 'Mock Exams', icon: 'exam' },
  { to: '/admin/import', label: 'Import', icon: 'upload' },
  { to: '/admin/users', label: 'Users', icon: 'users' },
];

export default function AppLayout({ admin = false }) {
  const { user, logout, isAdmin } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const nav = admin ? ADMIN_NAV : STUDENT_NAV;

  // Navigating on a phone should close the drawer behind you.
  useEffect(() => {
    setDrawerOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  const signOut = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-paper-100">
      {/* Sidebar — permanent on desktop, a drawer on small screens */}
      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-paper-300 bg-white transition-transform duration-200 lg:translate-x-0',
          drawerOpen ? 'translate-x-0 shadow-lift' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-paper-200 px-5">
          <Link to={admin ? '/admin' : '/dashboard'} className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-800 text-paper-50">
              <CrossFlame />
            </span>
            <span className="leading-tight">
              <span className="block font-serif text-sm font-semibold text-ink-900">Lay Preachers</span>
              <span className="block text-[11px] uppercase tracking-wide text-ink-400">
                {admin ? 'Administration' : 'Examination Prep'}
              </span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3 scrollbar-thin" aria-label="Main">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-brand-50 text-brand-800' : 'text-ink-600 hover:bg-paper-100 hover:text-ink-900',
                )
              }
            >
              <Icon name={item.icon} size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-paper-200 p-3">
          {isAdmin && (
            <Link
              to={admin ? '/dashboard' : '/admin'}
              className="mb-2 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
            >
              <Icon name={admin ? 'book' : 'settings'} size={17} />
              {admin ? 'Back to studying' : 'Administration'}
            </Link>
          )}
          <div className="flex items-center gap-2.5 rounded-lg px-3 py-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">
              {initials(user?.name)}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium text-ink-800">{user?.name}</span>
              <span className="block truncate text-[11px] text-ink-400">{user?.examStage?.shortName || 'No stage'}</span>
            </span>
          </div>
        </div>
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-30 bg-ink-900/30 lg:hidden" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-paper-300 bg-paper-100/85 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            className="rounded-lg p-2 text-ink-600 hover:bg-paper-200 lg:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
          >
            <Icon name="menu" size={20} />
          </button>

          <div className="flex-1">{!admin && <GlobalSearch />}</div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-paper-200"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white">
                {initials(user?.name)}
              </span>
              <Icon name="chevronDown" size={14} className="text-ink-400" strokeStyle />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                <div role="menu" className="absolute right-0 z-20 mt-1.5 w-56 rounded-xl border border-paper-300 bg-white p-1.5 shadow-lift">
                  <div className="border-b border-paper-200 px-3 py-2.5">
                    <p className="truncate text-sm font-medium text-ink-900">{user?.name}</p>
                    <p className="truncate text-xs text-ink-500">{user?.email}</p>
                    {user?.role === 'admin' && (
                      <Badge tone="gold" size="sm" className="mt-1.5">
                        Administrator
                      </Badge>
                    )}
                  </div>
                  <Link to="/profile" role="menuitem" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-700 hover:bg-paper-100">
                    <Icon name="user" size={16} />
                    Profile and settings
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={signOut}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ink-700 hover:bg-paper-100"
                  >
                    <Icon name="logout" size={16} />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main id="main-content" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </main>

        <footer className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6">
          <p className="border-t border-paper-300 pt-5 text-center text-xs leading-relaxed text-ink-400">
            Study material is reproduced from the official Methodist Church Ghana Lay Preachers' syllabus for the
            personal use of candidates. Always check the printed syllabus before an examination.
          </p>
        </footer>
      </div>
    </div>
  );
}

/** A cross with a flame: the Methodist emblem, drawn simply. */
export function CrossFlame({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10.4 3h3.2v6.2H20v3.2h-6.4V21h-3.2v-8.6H4V9.2h6.4z" fill="currentColor" />
      <path
        d="M17.2 13.5c1.6 1.1 2.4 2.4 2.4 3.8a3.3 3.3 0 0 1-6.6.1c0-2 2.3-2.7 2.3-5.2.9.2 1.9.8 1.9 1.3z"
        fill="#c8a951"
      />
    </svg>
  );
}
