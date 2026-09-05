import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { contentApi } from '@/services/api';
import { useAsync, useDebounced, useDocumentTitle } from '@/hooks';
import { Badge, Button, Card, EmptyState, ErrorState, Icon, Skeleton } from '@/components/ui';
import { plural } from '@/utils/format';

const TESTAMENTS = [
  { key: 'OT', label: 'Old Testament' },
  { key: 'NT', label: 'New Testament' },
];

const PAGE_SIZE = 100;

/**
 * The scripture index.
 *
 * Every passage the syllabus cites, with its text and the places that cite it.
 * The text is the Authorised (King James) Version, which is out of copyright
 * and is what the syllabus itself quotes. A handful of references resolve to
 * nothing because the syllabus mis-cites them; those say so rather than
 * silently showing an empty entry.
 */
export default function ScripturePage() {
  useDocumentTitle('Scripture index');

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounced(search.trim(), 300);

  // A new search always starts from the first page.
  useEffect(() => {
    setPage(1);
  }, [debounced]);

  const { data, error, loading, reload } = useAsync(
    () => contentApi.scriptures({ limit: PAGE_SIZE, page, search: debounced || undefined }),
    [debounced, page],
  );

  const scriptures = useMemo(() => data?.scriptures || [], [data]);
  const meta = data?._meta || null;
  const grouped = useMemo(() => groupByTestament(scriptures), [scriptures]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-5">
        <h1 className="font-serif text-2xl font-semibold text-ink-900 sm:text-3xl">Scripture index</h1>
        <p className="mt-2 max-w-reading text-sm leading-relaxed text-ink-600">
          Every passage the syllabus cites, in the order the books appear in the Bible, with the places it is cited.
        </p>
      </header>

      <Card className="mb-6 border-brand-200 bg-brand-50 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Icon name="info" size={18} className="mt-0.5 shrink-0 text-brand-700" />
          <div>
            <h2 className="font-serif text-sm font-semibold text-brand-800">About this index</h2>
            <p className="mt-1 max-w-reading text-sm leading-relaxed text-ink-700">
              Every passage the syllabus cites, with the text itself and a note of where it is cited. The text is the
              Authorised (King James) Version, which is out of copyright and is the version the syllabus quotes from.
              A few references the syllabus mis-cites carry no text — those are marked, and worth checking against your
              own Bible.
            </p>
          </div>
        </div>
      </Card>

      <div className="mb-6">
        <label htmlFor="scripture-search" className="mb-1.5 block text-sm font-medium text-ink-700">
          Search by reference or book
        </label>
        <div className="relative">
          <Icon
            name="search"
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <input
            id="scripture-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="For example, Amos or John 3"
            autoComplete="off"
            className="w-full rounded-lg border border-paper-300 bg-white py-2.5 pl-9 pr-3.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
          />
        </div>
        <p className="mt-1.5 text-xs text-ink-500" role="status" aria-live="polite">
          {loading
            ? 'Searching…'
            : meta
              ? `${plural(meta.total, 'passage')}${debounced ? ` matching “${debounced}”` : ''}`
              : ''}
        </p>
      </div>

      {loading && <IndexSkeleton />}

      {error && !loading && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && !scriptures.length && (
        <Card>
          <EmptyState
            icon="scroll"
            title={debounced ? `Nothing matches “${debounced}”` : 'No scripture has been indexed yet'}
            message={
              debounced
                ? 'Try the book name on its own — for example “Amos” rather than “Amos 5:24”.'
                : 'Once the syllabus has been loaded, every passage it cites will be listed here.'
            }
            action={
              debounced ? (
                <Button variant="secondary" onClick={() => setSearch('')}>
                  Clear the search
                </Button>
              ) : (
                <Button to="/study" variant="secondary">
                  Go to Study
                </Button>
              )
            }
          />
        </Card>
      )}

      {!loading && !error && scriptures.length > 0 && (
        <div className="space-y-8">
          {grouped.map((testament) => (
            <section key={testament.key} aria-labelledby={`testament-${testament.key}`}>
              <h2
                id={`testament-${testament.key}`}
                className="mb-3 border-b border-paper-300 pb-2 font-serif text-lg font-semibold text-ink-900"
              >
                {testament.label}
                <span className="ml-2 text-sm font-normal text-ink-500">
                  {plural(testament.books.reduce((n, b) => n + b.items.length, 0), 'passage')}
                </span>
              </h2>

              <div className="space-y-5">
                {testament.books.map((book) => (
                  <div key={book.book}>
                    <h3 className="mb-2 font-serif text-base font-semibold text-ink-800">{book.book}</h3>
                    <Card className="overflow-hidden">
                      <ul className="divide-y divide-paper-200">
                        {book.items.map((scripture) => (
                          <li key={scripture._id}>
                            <ScriptureRow scripture={scripture} />
                          </li>
                        ))}
                      </ul>
                    </Card>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {!loading && !error && meta && meta.pages > 1 && (
        <nav className="mt-8 flex items-center justify-between gap-4 border-t border-paper-300 pt-5" aria-label="Pagination">
          <Button
            variant="secondary"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={meta.page <= 1}
            icon={<Icon name="chevronLeft" size={15} strokeStyle />}
          >
            Previous
          </Button>
          <p className="tabular text-sm text-ink-600">
            Page {meta.page} of {meta.pages}
          </p>
          <Button
            variant="secondary"
            onClick={() => setPage((p) => Math.min(meta.pages, p + 1))}
            disabled={meta.page >= meta.pages}
            iconRight={<Icon name="chevronRight" size={15} strokeStyle />}
          >
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}

function ScriptureRow({ scripture }) {
  const citations = scripture.citedIn || [];
  const shown = citations.slice(0, 3);
  const rest = citations.length - shown.length;

  return (
    <Link
      to={`/scripture/${encodeURIComponent(scripture.reference)}`}
      className="flex items-start gap-4 px-4 py-3.5 transition-colors hover:bg-paper-50 sm:px-5"
    >
      <Icon name="scroll" size={18} className="mt-0.5 shrink-0 text-gold-600" />

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-serif text-base font-semibold text-ink-900">{scripture.reference}</span>
          <Badge tone="outline" size="sm">
            cited {plural(scripture.citationCount || 0, 'time')}
          </Badge>
        </p>

        {/* A line of the passage itself, so the index is readable at a glance. */}
        {scripture.text ? (
          <p className="mt-1 line-clamp-2 max-w-reading font-serif text-[15px] leading-relaxed text-ink-700">
            {scripture.text}
          </p>
        ) : (
          <p className="mt-1 text-sm italic text-ink-400">
            No text — the syllabus cites a chapter or verse that does not exist.
          </p>
        )}

        {shown.length > 0 ? (
          <p className="mt-1.5 text-xs leading-relaxed text-ink-500">
            {shown
              .map((citation) =>
                [citation.subjectName, citation.topicTitle].filter(Boolean).join(' — ') || citation.citation || 'Syllabus',
              )
              .join(' · ')}
            {rest > 0 && <span className="text-ink-400"> · and {rest} more</span>}
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-ink-500">Indexed from the syllabus.</p>
        )}
      </div>

      <Icon name="chevronRight" size={16} className="mt-1 shrink-0 text-ink-300" strokeStyle />
    </Link>
  );
}

/** Testament, then book, keeping the canonical order the API sorted by. */
function groupByTestament(rows) {
  const byTestament = new Map();
  rows.forEach((row) => {
    if (!byTestament.has(row.testament)) byTestament.set(row.testament, new Map());
    const books = byTestament.get(row.testament);
    if (!books.has(row.book)) books.set(row.book, []);
    books.get(row.book).push(row);
  });

  return TESTAMENTS.filter((t) => byTestament.has(t.key)).map((t) => ({
    ...t,
    books: [...byTestament.get(t.key).entries()].map(([book, items]) => ({ book, items })),
  }));
}

function IndexSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      {[0, 1].map((section) => (
        <div key={section}>
          <Skeleton className="mb-3 h-5 w-40" rounded="rounded" />
          <Card className="overflow-hidden">
            <ul className="divide-y divide-paper-200">
              {[0, 1, 2, 3].map((i) => (
                <li key={i} className="px-5 py-4">
                  <Skeleton className="h-4 w-1/3" rounded="rounded" />
                  <Skeleton className="mt-2 h-3 w-2/3" rounded="rounded" />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ))}
    </div>
  );
}
