import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { contentApi } from '@/services/api';
import { useDebounced } from '@/hooks';
import { Badge, Icon, Spinner, cx } from '@/components/ui';

const KIND_LABELS = {
  topic: 'Topic',
  question: 'Question',
  flashcard: 'Flashcard',
  scripture: 'Scripture',
  note: 'Note',
};

const KIND_ICONS = {
  topic: 'book',
  question: 'quiz',
  flashcard: 'cards',
  scripture: 'scroll',
  note: 'note',
};

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const debounced = useDebounced(query, 250);

  // Ctrl/Cmd-K focuses search from anywhere.
  useEffect(() => {
    const handler = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (debounced.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    contentApi
      .search({ q: debounced.trim(), limit: 4 }, { signal: controller.signal })
      .then((data) => {
        setResults(data?.results || []);
        setHighlighted(0);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [debounced]);

  const go = (result) => {
    setOpen(false);
    setQuery('');
    navigate(result.route);
  };

  const onKeyDown = (event) => {
    if (!open || !results.length) {
      if (event.key === 'Enter' && query.trim().length >= 2) {
        setOpen(false);
        navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlighted((h) => (h + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((h) => (h - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      go(results[highlighted]);
    }
  };

  return (
    <div className="relative max-w-md">
      <div className="relative">
        <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls="global-search-results"
          aria-autocomplete="list"
          placeholder="Search topics, questions, scripture…"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          className="w-full rounded-lg border border-paper-300 bg-white py-2 pl-9 pr-16 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-paper-300 bg-paper-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-400 sm:block">
          ⌘K
        </kbd>
      </div>

      {open && query.trim().length >= 2 && (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-paper-300 bg-white shadow-lift"
        >
          {loading && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-ink-500">
              <Spinner size={14} />
              Searching…
            </div>
          )}

          {!loading && !results.length && (
            <p className="px-4 py-3 text-sm text-ink-500">
              Nothing found for “{query.trim()}”.
            </p>
          )}

          {!loading &&
            results.map((result, index) => (
              <button
                key={`${result.kind}-${result.id}`}
                type="button"
                role="option"
                aria-selected={index === highlighted}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(result)}
                onMouseEnter={() => setHighlighted(index)}
                className={cx(
                  'flex w-full items-start gap-3 border-b border-paper-100 px-4 py-2.5 text-left last:border-0',
                  index === highlighted ? 'bg-brand-50' : 'hover:bg-paper-100',
                )}
              >
                <Icon name={KIND_ICONS[result.kind] || 'search'} size={16} className="mt-0.5 text-ink-400" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink-800">{result.title}</span>
                    <Badge size="sm" tone="outline">
                      {KIND_LABELS[result.kind]}
                    </Badge>
                  </span>
                  {result.subtitle && <span className="mt-0.5 block truncate text-xs text-ink-500">{result.subtitle}</span>}
                </span>
              </button>
            ))}

          {!loading && results.length > 0 && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setOpen(false);
                navigate(`/search?q=${encodeURIComponent(query.trim())}`);
              }}
              className="w-full bg-paper-100 px-4 py-2.5 text-left text-xs font-medium text-brand-700 hover:bg-paper-200"
            >
              See all results for “{query.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}
