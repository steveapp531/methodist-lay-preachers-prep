import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { contentApi, libraryApi } from '@/services/api';
import { useAsync, useDocumentTitle, useLocalStorage } from '@/hooks';
import { useToast } from '@/context/ToastContext';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  Icon,
  ProgressBar,
  Select,
  Skeleton,
  SourceBadge,
  StatTile,
  cx,
} from '@/components/ui';
import { citationLine, plural } from '@/utils/format';

const KEYS = [
  { key: '←  →', meaning: 'Move between cards' },
  { key: 'Space', meaning: 'Turn the card over' },
  { key: 'K', meaning: 'I know this' },
  { key: 'R', meaning: 'Needs revision' },
];

/**
 * The review deck.
 *
 * One card at a time, turned over by hand. The keyboard does everything the
 * mouse does, because a candidate revising properly keeps their hands still.
 */
export default function FlashcardsPage() {
  useDocumentTitle('Flashcards');

  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const topicParam = searchParams.get('topic') || '';
  const subjectParam = searchParams.get('subject') || '';
  const dueOnly = searchParams.get('due') === 'true';

  const [shuffle, setShuffle] = useLocalStorage('mlpp:flashcards:shuffle', false);

  const subjects = useAsync(() => contentApi.subjects(), []);
  const { data, error, loading, reload } = useAsync(
    () =>
      libraryApi.flashcards({
        topic: topicParam || undefined,
        subject: subjectParam || undefined,
        due: dueOnly ? 'true' : undefined,
        limit: 60,
      }),
    [topicParam, subjectParam, dueOnly],
  );

  /* ------------------------------------------------------------------- deck */

  const [reshuffleToken, setReshuffleToken] = useState(0);
  const [restrictTo, setRestrictTo] = useState(null);

  const baseDeck = useMemo(() => {
    const cards = [...(data?.flashcards || [])];
    if (!shuffle) return cards;
    for (let i = cards.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, shuffle, reshuffleToken]);

  const deck = useMemo(
    () => (restrictTo ? baseDeck.filter((card) => restrictTo.includes(card._id)) : baseDeck),
    [baseDeck, restrictTo],
  );

  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [finished, setFinished] = useState(false);
  const [outcomes, setOutcomes] = useState({});

  // A new deck is a new round: start at the beginning with a clean tally.
  useEffect(() => {
    setIndex(0);
    setFlipped(false);
    setFinished(false);
    setOutcomes({});
  }, [deck]);

  const card = deck[index];
  const cardRef = useRef(null);

  /* ---------------------------------------------------------------- actions */

  const goTo = useCallback(
    (nextIndex) => {
      if (nextIndex < 0 || !deck.length) return;
      setFlipped(false);
      if (nextIndex >= deck.length) setFinished(true);
      else {
        setFinished(false);
        setIndex(nextIndex);
      }
    },
    [deck.length],
  );

  const record = useCallback(
    (outcome) => {
      const current = deck[index];
      if (!current) return;
      setOutcomes((previous) => ({ ...previous, [current._id]: outcome }));
      libraryApi.reviewFlashcard(current._id, outcome).catch(() => {
        toast.error('We could not save that review, but you can carry on.');
      });
      goTo(index + 1);
    },
    [deck, index, goTo, toast],
  );

  /* --------------------------------------------------------------- keyboard */

  const handlerRef = useRef(null);
  handlerRef.current = (event) => {
    if (finished || !deck.length) return;
    const target = event.target;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)
    ) {
      return;
    }
    // The card is a button: let it handle its own Space and Enter.
    const onCard = cardRef.current?.contains(target);

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        goTo(index + 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        goTo(index - 1);
        break;
      case ' ':
      case 'Spacebar':
        if (onCard) return;
        event.preventDefault();
        setFlipped((value) => !value);
        break;
      case 'k':
      case 'K':
        event.preventDefault();
        record('known');
        break;
      case 'r':
      case 'R':
        event.preventDefault();
        record('needs_revision');
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    const listener = (event) => handlerRef.current?.(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  /* ---------------------------------------------------------------- filters */

  const setParam = (name, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value);
    else next.delete(name);
    setSearchParams(next, { replace: true });
    setRestrictTo(null);
  };

  const tally = useMemo(() => {
    const values = Object.values(outcomes);
    return {
      known: values.filter((value) => value === 'known').length,
      revision: values.filter((value) => value === 'needs_revision').length,
      reviewed: values.length,
    };
  }, [outcomes]);

  const revisionIds = useMemo(
    () => Object.entries(outcomes).filter(([, value]) => value === 'needs_revision').map(([id]) => id),
    [outcomes],
  );

  const topicName = deck[0]?.topic?.title || null;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h1 className="font-serif text-2xl font-semibold text-ink-900 sm:text-3xl">Flashcards</h1>
        <p className="mt-2 max-w-reading text-reading-base leading-relaxed text-ink-600">
          Short prompts drawn from the syllabus. Turn each card over, judge yourself honestly, and the ones you find
          hard will come back to you sooner.
        </p>
      </header>

      <Filters
        subjects={subjects.data?.subjects || []}
        subjectsLoading={subjects.loading}
        subjectParam={subjectParam}
        dueOnly={dueOnly}
        shuffle={shuffle}
        topicParam={topicParam}
        topicName={topicName}
        onSubjectChange={(value) => setParam('subject', value)}
        onDueChange={(value) => setParam('due', value ? 'true' : '')}
        onClearTopic={() => setParam('topic', '')}
        onShuffleChange={(value) => {
          setShuffle(value);
          setRestrictTo(null);
        }}
        onReshuffle={() => setReshuffleToken((token) => token + 1)}
      />

      {loading && <DeckSkeleton />}

      {!loading && error && <ErrorState error={error} onRetry={reload} className="card" />}

      {!loading && !error && deck.length === 0 && (
        <Card>
          <EmptyState
            icon="cards"
            title="No flashcards match these filters"
            message={
              dueOnly
                ? 'Nothing is due for review just now. Clear the "due for review" filter to go through the whole deck, or read a new topic.'
                : 'There are no cards for this selection yet. Try another paper, or read a topic and come back.'
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {(dueOnly || subjectParam || topicParam) && (
                  <Button
                    variant="secondary"
                    onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}
                  >
                    Clear all filters
                  </Button>
                )}
                <Button to="/study" icon={<Icon name="book" size={15} />}>
                  Go to Study
                </Button>
              </div>
            }
          />
        </Card>
      )}

      {!loading && !error && deck.length > 0 && finished && (
        <Summary
          tally={tally}
          total={deck.length}
          canReviseAgain={revisionIds.length > 0}
          onReviseAgain={() => setRestrictTo(revisionIds)}
          onStartAgain={() => {
            setRestrictTo(null);
            setReshuffleToken((token) => token + 1);
            setIndex(0);
            setFinished(false);
            setOutcomes({});
          }}
        />
      )}

      {!loading && !error && deck.length > 0 && !finished && card && (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="tabular text-sm font-medium text-ink-600" aria-live="polite">
              Card {index + 1} of {deck.length}
            </p>
            <p className="text-xs text-ink-500">
              <span className="text-success-600">{tally.known} known</span>
              {' · '}
              <span className="text-warning-600">{tally.revision} for revision</span>
            </p>
          </div>
          <div aria-hidden="true">
            <ProgressBar value={index} max={deck.length} size="sm" tone="brand" />
          </div>
          {!restrictTo && data?._meta?.total > deck.length && (
            <p className="text-xs text-ink-400">
              Showing the first {deck.length} of {data._meta.total} cards. Choose a paper to narrow the deck.
            </p>
          )}

          <FlipCard card={card} flipped={flipped} onFlip={() => setFlipped((value) => !value)} cardRef={cardRef} />

          <Controls
            index={index}
            total={deck.length}
            outcome={outcomes[card._id]}
            onPrevious={() => goTo(index - 1)}
            onNext={() => goTo(index + 1)}
            onKnown={() => record('known')}
            onRevision={() => record('needs_revision')}
          />

          <Legend />
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- filters --- */

function Filters({
  subjects,
  subjectsLoading,
  subjectParam,
  dueOnly,
  shuffle,
  topicParam,
  topicName,
  onSubjectChange,
  onDueChange,
  onClearTopic,
  onShuffleChange,
  onReshuffle,
}) {
  return (
    <Card className="p-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,18rem)_1fr] sm:items-end">
        <Select
          label="Paper"
          value={subjectParam}
          disabled={subjectsLoading}
          onChange={(event) => onSubjectChange(event.target.value)}
        >
          <option value="">All papers</option>
          {subjects.map((subject) => (
            <option key={subject._id} value={subject._id}>
              {subject.name}
            </option>
          ))}
        </Select>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pb-1">
          <Checkbox
            label="Due for review only"
            description="Cards the schedule says are ready"
            checked={dueOnly}
            onChange={(event) => onDueChange(event.target.checked)}
          />
          <Checkbox
            label="Shuffle the deck"
            description="Order the cards at random"
            checked={Boolean(shuffle)}
            onChange={(event) => onShuffleChange(event.target.checked)}
          />
          {shuffle && (
            <Button variant="ghost" size="sm" onClick={onReshuffle} icon={<Icon name="refresh" size={14} />}>
              Shuffle again
            </Button>
          )}
        </div>
      </div>

      {topicParam && (
        <p className="mt-3 flex flex-wrap items-center gap-2 border-t border-paper-200 pt-3 text-sm text-ink-600">
          <Icon name="filter" size={14} className="text-ink-400" />
          <span>Showing one topic{topicName ? `: ${topicName}` : ''}.</span>
          <button type="button" onClick={onClearTopic} className="font-medium text-brand-700 underline">
            Show all topics
          </button>
        </p>
      )}
    </Card>
  );
}

/* --------------------------------------------------------------- the card --- */

const KIND_LABELS = {
  term: 'Term',
  fact: 'Fact',
  scripture: 'Scripture',
  definition: 'Definition',
  person: 'Person',
  event: 'Event',
};

function FlipCard({ card, flipped, onFlip, cardRef }) {
  const backId = 'flashcard-back';

  return (
    <Card className={cx('overflow-hidden', flipped ? 'border-brand-300' : '')}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-paper-200 px-5 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {card.subject?.shortName && (
            <Badge tone="brand" size="sm">
              {card.subject.shortName}
            </Badge>
          )}
          {card.kind && (
            <Badge tone="outline" size="sm">
              {KIND_LABELS[card.kind] || card.kind}
            </Badge>
          )}
          {card.state?.reviews > 0 && (
            <Badge tone="neutral" size="sm">
              Seen {plural(card.state.reviews, 'time')}
            </Badge>
          )}
        </div>
        <SourceBadge sourceKind={card.sourceKind} />
      </div>

      {/* The face of the card. Pressing it turns the card over. */}
      <button
        ref={cardRef}
        type="button"
        onClick={onFlip}
        aria-expanded={flipped}
        aria-controls={backId}
        className={cx(
          'block w-full px-5 py-6 text-left transition-colors sm:px-8 sm:py-8',
          flipped ? 'bg-white' : 'bg-white hover:bg-paper-50',
        )}
      >
        <span className="block text-xs font-semibold uppercase tracking-wide text-ink-400">Question</span>
        <span className="mt-2 block max-w-reading font-serif text-xl leading-relaxed text-ink-900 sm:text-2xl">
          {card.front}
        </span>
        <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-brand-700">
          <Icon name="refresh" size={15} />
          {flipped ? 'Turn back' : 'Turn the card over'}
          <span className="text-ink-400">
            (or press <Kbd>Space</Kbd>)
          </span>
        </span>
      </button>

      <div
        id={backId}
        hidden={!flipped}
        aria-live="polite"
        className="border-t border-paper-200 bg-brand-50/40 px-5 py-6 sm:px-8"
      >
        {flipped && (
          <div className="animate-fade-in">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Answer</p>
            <p className="mt-2 max-w-reading font-serif text-reading-lg leading-relaxed text-ink-800">{card.back}</p>

            {card.scriptureReferences?.length > 0 && (
              <div className="mt-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Scripture</h3>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {card.scriptureReferences.map((reference) => (
                    <li key={reference.reference}>
                      <Link
                        to={`/scripture/${encodeURIComponent(reference.reference)}`}
                        className="inline-flex rounded-full bg-gold-50 px-2.5 py-1 text-xs font-medium text-gold-700 hover:bg-gold-100"
                      >
                        {reference.reference}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-paper-300 pt-3 text-xs text-ink-500">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="book" size={13} className="text-ink-400" />
                {citationLine(card.manualReference) || 'From the official syllabus'}
              </span>
              {card.topic?.title && <span className="text-ink-400">Topic: {card.topic.title}</span>}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function Kbd({ children }) {
  return (
    <kbd className="rounded border border-paper-300 bg-paper-100 px-1.5 py-0.5 font-sans text-[11px] font-medium text-ink-600">
      {children}
    </kbd>
  );
}

function Controls({ index, total, outcome, onPrevious, onNext, onKnown, onRevision }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Button onClick={onKnown} icon={<Icon name="check" size={16} />} fullWidth>
          I know this
        </Button>
        <Button variant="secondary" onClick={onRevision} icon={<Icon name="refresh" size={16} />} fullWidth>
          Needs revision
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={onPrevious}
          disabled={index === 0}
          icon={<Icon name="chevronLeft" size={15} strokeStyle />}
        >
          Previous
        </Button>

        {outcome && (
          <Badge
            tone={outcome === 'known' ? 'success' : 'warning'}
            icon={<Icon name={outcome === 'known' ? 'check' : 'alert'} size={11} />}
          >
            {outcome === 'known' ? 'Marked as known' : 'Marked for revision'}
          </Badge>
        )}

        <Button variant="ghost" onClick={onNext} iconRight={<Icon name="chevronRight" size={15} strokeStyle />}>
          {index + 1 === total ? 'Finish' : 'Next'}
        </Button>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="rounded-xl border border-paper-300 bg-paper-50 px-4 py-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Keyboard</h2>
      <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-ink-600">
        {KEYS.map((entry) => (
          <div key={entry.key} className="inline-flex items-center gap-2">
            <dt>
              <Kbd>{entry.key}</Kbd>
            </dt>
            <dd>{entry.meaning}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ---------------------------------------------------------------- summary --- */

function Summary({ tally, total, canReviseAgain, onReviseAgain, onStartAgain }) {
  const unreviewed = Math.max(0, total - tally.reviewed);

  return (
    <Card className="p-6 text-center sm:p-8">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-100 text-success-600">
        <Icon name="check" size={26} />
      </span>
      <h2 className="mt-4 font-serif text-xl font-semibold text-ink-900">That is the end of the deck</h2>
      <p className="mt-1.5 text-sm text-ink-600">
        You went through {plural(total, 'card')}
        {unreviewed > 0 ? `, judging ${tally.reviewed} of them` : ''}.
      </p>

      <div className="mx-auto mt-6 grid max-w-md gap-3 sm:grid-cols-2">
        <StatTile label="Known" value={tally.known} tone="success" icon={<Icon name="check" size={13} />} />
        <StatTile
          label="For revision"
          value={tally.revision}
          tone="warning"
          icon={<Icon name="alert" size={13} />}
        />
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {canReviseAgain && (
          <Button onClick={onReviseAgain} icon={<Icon name="refresh" size={15} />}>
            Go through the {tally.revision} needing revision
          </Button>
        )}
        <Button variant="secondary" onClick={onStartAgain} icon={<Icon name="cards" size={15} />}>
          Start the deck again
        </Button>
        <Button variant="ghost" to="/study" icon={<Icon name="book" size={15} />}>
          Back to Study
        </Button>
      </div>
    </Card>
  );
}

/* --------------------------------------------------------------- skeleton --- */

function DeckSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-2 w-full" rounded="rounded-full" />
      <div className="card p-6 sm:p-8">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16" rounded="rounded-full" />
          <Skeleton className="h-5 w-20" rounded="rounded-full" />
        </div>
        <Skeleton className="mt-6 h-7 w-4/5" />
        <Skeleton className="mt-3 h-7 w-3/5" />
        <Skeleton className="mt-8 h-4 w-1/2" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}
