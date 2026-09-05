import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { contentApi } from '@/services/api';
import { useAsync, useDebounced, useDocumentTitle } from '@/hooks';
import { Badge, Button, Card, EmptyState, ErrorState, Icon, Skeleton, SourceBadge, Tabs } from '@/components/ui';
import { plural } from '@/utils/format';

const KINDS = [
  { key: 'topic', label: 'Topics', icon: 'book' },
  { key: 'question', label: 'Questions', icon: 'quiz' },
  { key: 'flashcard', label: 'Flashcards', icon: 'cards' },
  { key: 'scripture', label: 'Scripture', icon: 'scroll' },
  { key: 'note', label: 'Notes', icon: 'note' },
];

const KIND_BY_KEY = Object.fromEntries(KINDS.map((k) => [k.key, k]));
const MIN_QUERY = 2;

/**
 * Full search results.
 *
 * The query lives in the URL, so a search can be shared, bookmarked and
 * returned to with the back button, and the box at the top edits that same
 * query rather than starting a new one somewhere else.
 */
export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = (params.get('q') || '').trim();
  const kind = params.get('kind') || 'all';

  useDocumentTitle(query ? `Search: ${query}` : 'Search');

  const [input, setInput] = useState(params.get('q') || '');
  const debounced = useDebounced(input.trim(), 350);

  // Typing rewrites the query string in place rather than stacking history.
  useEffect(() => {
    if (debounced === query) return;
    const next = new URLSearchParams(params);
    if (debounced) next.set('q', debounced);
    else next.delete('q');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // Keep the box in step when the query changes from elsewhere (back button).
  useEffect(() => {
    if (query !== debounced) setInput(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const tooShort = query.length < MIN_QUERY;

  const { data, error, loading, reload } = useAsync(
    () =>
      tooShort
        ? Promise.resolve(null)
        : contentApi.search({ q: query, limit: 20, types: kind === 'all' ? undefined : [kind] }),
    [query, kind, tooShort],
  );

  // Counts come from the unfiltered search; they survive a narrowing filter.
  const countsRef = useRef({});
  if (data?.byKind && kind === 'all') countsRef.current = data.byKind;
  const counts = kind === 'all' ? data?.byKind || {} : countsRef.current;

  const results = useMemo(() => data?.results || [], [data]);
  const grouped = useMemo(
    () => KINDS.map((k) => ({ ...k, items: results.filter((r) => r.kind === k.key) })).filter((g) => g.items.length),
    [results],
  );

  const setKind = (nextKind) => {
    const next = new URLSearchParams(params);
    if (nextKind === 'all') next.delete('kind');
    else next.set('kind', nextKind);
    setParams(next, { replace: true });
  };

  const totalCount = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="font-serif text-2xl font-semibold text-ink-900 sm:text-3xl">Search</h1>
      <p className="mt-1.5 max-w-reading text-sm leading-relaxed text-ink-600">
        Topics, questions, flashcards, scripture references and your own notes, all in one place.
      </p>

      <form role="search" className="mt-5" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="search-input" className="mb-1.5 block text-sm font-medium text-ink-700">
          What are you looking for?
        </label>
        <div className="relative">
          <Icon
            name="search"
            size={17}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <input
            id="search-input"
            type="search"
            value={input}
            autoFocus
            autoComplete="off"
            onChange={(event) => setInput(event.target.value)}
            placeholder="For example, means of grace, Amos, or John Wesley"
            aria-describedby="search-status"
            className="w-full rounded-lg border border-paper-300 bg-white py-3 pl-11 pr-3.5 text-base text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
          />
        </div>
        <p id="search-status" className="mt-1.5 text-xs text-ink-500" role="status" aria-live="polite">
          {tooShort
            ? `Type at least ${MIN_QUERY} characters.`
            : loading
              ? 'Searching…'
              : `${plural(results.length, 'result')} for “${query}”${kind === 'all' ? '' : ` in ${KIND_BY_KEY[kind]?.label.toLowerCase() || kind}`}`}
        </p>
      </form>

      {!tooShort && (
        <Tabs
          className="mt-5"
          active={kind}
          onChange={setKind}
          tabs={[
            { key: 'all', label: 'Everything', count: totalCount || undefined },
            ...KINDS.map((k) => ({ key: k.key, label: k.label, count: counts[k.key] })),
          ]}
        />
      )}

      <div className="mt-6">
        {tooShort && (
          <Card>
            <EmptyState
              icon="search"
              title="Type a little more"
              message={`Search needs at least ${MIN_QUERY} characters. Try a topic name, a phrase from the syllabus, a scripture reference, or a word from one of your notes.`}
            />
          </Card>
        )}

        {!tooShort && loading && <ResultsSkeleton />}

        {!tooShort && error && !loading && <ErrorState error={error} onRetry={reload} />}

        {!tooShort && !loading && !error && !results.length && (
          <Card>
            <EmptyState
              icon="search"
              title={`Nothing found for “${query}”`}
              message={
                kind === 'all'
                  ? 'Try a shorter phrase, a different spelling, or the name of the topic rather than a sentence from it.'
                  : `Nothing of this kind matched. Search everything instead — there may be results elsewhere.`
              }
              action={
                kind === 'all' ? (
                  <Button variant="secondary" to="/study" icon={<Icon name="book" size={15} />}>
                    Browse the syllabus
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => setKind('all')}>
                    Search everything
                  </Button>
                )
              }
            />
          </Card>
        )}

        {!tooShort && !loading && !error && results.length > 0 && (
          <div className="space-y-7">
            {grouped.map((group) => (
              <section key={group.key} aria-labelledby={`group-${group.key}`}>
                <h2
                  id={`group-${group.key}`}
                  className="mb-3 flex items-center gap-2 border-b border-paper-300 pb-2 font-serif text-base font-semibold text-ink-900"
                >
                  <Icon name={group.icon} size={16} className="text-ink-400" />
                  {group.label}
                  <span className="text-sm font-normal text-ink-500">{group.items.length}</span>
                </h2>

                <ul className="space-y-2.5">
                  {group.items.map((result) => (
                    <li key={`${result.kind}-${result.id}`}>
                      <ResultCard result={result} term={query} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultCard({ result, term }) {
  const kind = KIND_BY_KEY[result.kind];

  return (
    <Card hover as={Link} to={result.route} className="block px-4 py-3.5 sm:px-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-paper-200 text-ink-500">
          <Icon name={kind?.icon || 'search'} size={16} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-base font-semibold text-ink-900">
              <Highlight text={result.title} term={term} />
            </h3>
            <Badge tone="outline" size="sm">
              {kind?.label?.replace(/s$/, '') || result.kind}
            </Badge>
            {result.kind === 'question' && result.badge && <SourceBadge sourceKind={result.badge} />}
          </div>

          {result.subtitle && (
            <p className="mt-0.5 truncate text-xs text-ink-500">
              <Highlight text={result.subtitle} term={term} />
            </p>
          )}

          {result.excerpt && (
            <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
              <Highlight text={result.excerpt} term={term} />
            </p>
          )}
        </div>

        <Icon name="chevronRight" size={16} className="mt-1.5 shrink-0 text-ink-300" strokeStyle />
      </div>
    </Card>
  );
}

/** Marks the matched term without letting the query become a regular expression. */
function Highlight({ text, term }) {
  const value = String(text ?? '');
  const needle = String(term || '').trim();
  if (!needle) return <>{value}</>;

  const parts = value.split(new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'));

  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-sm bg-gold-100 px-0.5 font-semibold text-ink-900">
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      {[0, 1].map((group) => (
        <div key={group}>
          <Skeleton className="mb-3 h-4 w-32" rounded="rounded" />
          <ul className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <li key={i}>
                <Card className="px-5 py-4">
                  <Skeleton className="h-4 w-2/5" rounded="rounded" />
                  <Skeleton className="mt-2 h-3 w-1/4" rounded="rounded" />
                  <Skeleton className="mt-2.5 h-3 w-full" rounded="rounded" />
                </Card>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
