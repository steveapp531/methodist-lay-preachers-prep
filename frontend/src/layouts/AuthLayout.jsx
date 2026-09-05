import { Link, Outlet } from 'react-router-dom';
import { CrossFlame } from './AppLayout';

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-paper-100 lg:flex-row">
      {/* Left: identity and reassurance. Hidden on small screens. */}
      <div className="relative hidden overflow-hidden bg-brand-900 lg:flex lg:w-[45%] lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cpath d='M36 8h8v24h24v8H44v32h-8V40H12v-8h24z' fill='%23ffffff'/%3E%3C/svg%3E\")",
            backgroundSize: '120px',
          }}
          aria-hidden="true"
        />
        <Link to="/" className="relative flex items-center gap-3 text-paper-50">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
            <CrossFlame size={24} />
          </span>
          <span className="leading-tight">
            <span className="block font-serif text-lg font-semibold">Lay Preachers</span>
            <span className="block text-xs uppercase tracking-widest text-brand-200">Examination Preparation</span>
          </span>
        </Link>

        <div className="relative max-w-md">
          <h1 className="font-serif text-3xl font-semibold leading-snug text-white">
            Study the syllabus. Practise the questions. Know why.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-brand-100">
            Every answer points back to the passage of the official syllabus it came from, so a question you get wrong
            teaches you something instead of simply marking you down.
          </p>
          <p className="mt-8 border-l-2 border-gold-500 pl-4 font-serif text-sm italic text-brand-100">
            “Study to shew thyself approved unto God, a workman that needeth not to be ashamed, rightly dividing the word
            of truth.”
            <span className="mt-1 block not-italic text-xs text-brand-300">2 Timothy 2:15</span>
          </p>
        </div>

        <p className="relative text-xs text-brand-300">
          The Methodist Church Ghana — Connexional Lay Preachers' Examination
        </p>
      </div>

      {/* Right: the form itself */}
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between px-6 py-5 lg:hidden">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-800 text-paper-50">
              <CrossFlame />
            </span>
            <span className="font-serif text-sm font-semibold text-ink-900">Lay Preachers Prep</span>
          </Link>
        </div>

        <main id="main-content" className="flex flex-1 items-center justify-center px-6 py-8 sm:py-12">
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
