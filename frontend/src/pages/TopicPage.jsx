import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { contentApi, libraryApi, quizApi } from '@/services/api';
import { useAsync, useDocumentTitle, useElapsedSeconds } from '@/hooks';
import { useToast } from '@/context/ToastContext';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Icon,
  Input,
  ProgressBar,
  Skeleton,
  SkeletonText,
  Spinner,
  Textarea,
  cx,
} from '@/components/ui';
import {
  PROGRESS_STATUS_LABELS,
  PROGRESS_STATUS_TONES,
  masteryTone,
  minutesLabel,
  plural,
  relativeTime,
} from '@/utils/format';

const STATUSES = ['not_started', 'in_progress', 'completed', 'needs_revision'];
const STATUS_ICONS = {
  not_started: 'inbox',
  in_progress: 'pen',
  completed: 'check',
  needs_revision: 'alert',
};

/** Below this, the candidate was passing through rather than reading. */
const MINIMUM_BANKABLE_SECONDS = 10;
/** The API accepts at most an hour of study time in one go. */
const MAXIMUM_BANKABLE_SECONDS = 3600;

/**
 * The reading screen.
 *
 * The syllabus text is the product, so it is given the width, the typeface and
 * the spacing of a printed manual, and it is reproduced exactly as it stands.
 * Everything else — progress, practice, notes — sits around it without
 * interrupting the paragraph the candidate is in the middle of.
 */
export default function TopicPage() {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const { data, error, loading, reload, setData } = useAsync(() => contentApi.topic(topicId), [topicId]);
  const bookmarks = useAsync(() => libraryApi.bookmarks({ targetType: 'topic', limit: 100 }), []);

  const topic = data?.topic;
  const progress = data?.progress || {};
  const navigation = data?.navigation || {};

  useDocumentTitle(topic?.title || 'Study');

  /* ------------------------------------------------------ banking reading time */

  const getElapsed = useElapsedSeconds();
  const bankedRef = useRef(0);

  const bankStudyTime = useCallback(
    (id) => {
      if (!id) return;
      const elapsed = getElapsed();
      const unbanked = elapsed - bankedRef.current;
      if (unbanked < MINIMUM_BANKABLE_SECONDS) return;
      bankedRef.current = elapsed;
      const seconds = Math.min(unbanked, MAXIMUM_BANKABLE_SECONDS);
      // Fire and forget: banking time must never interrupt reading.
      contentApi.updateTopicProgress(id, { studySeconds: seconds }).catch(() => {});
    },
    [getElapsed],
  );

  // Bank on leaving the topic — whether by navigating away or by moving to the
  // next topic, which keeps this component mounted.
  useEffect(() => {
    const id = topicId;
    return () => bankStudyTime(id);
  }, [topicId, bankStudyTime]);

  // And every minute, so a long session is not lost to a closed laptop.
  const topicIdRef = useRef(topicId);
  topicIdRef.current = topicId;
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') bankStudyTime(topicIdRef.current);
    }, 60000);
    return () => clearInterval(timer);
  }, [bankStudyTime]);

  /* ------------------------------------------------------------------ actions */

  const [statusPending, setStatusPending] = useState(null);
  const [bookmarkPending, setBookmarkPending] = useState(false);
  const [practisePending, setPractisePending] = useState(false);

  const practise = useCallback(async () => {
    setPractisePending(true);
    try {
      const result = await quizApi.create({ mode: 'topic_quiz', topic: topicId, size: 10 });
      if (!result?.quiz?.id) throw new Error('The quiz could not be started.');
      navigate(`/quiz/${result.quiz.id}`);
    } catch (err) {
      toast.error(err?.message || 'We could not start a quiz on this topic just now.');
    } finally {
      setPractisePending(false);
    }
  }, [topicId, navigate, toast]);

  const setStatus = async (status) => {
    if (status === progress.status) return;
    const previous = progress;
    setStatusPending(status);
    setData((current) => ({ ...current, progress: { ...current.progress, status } }));
    try {
      const result = await contentApi.updateTopicProgress(topicId, { status });
      if (result?.progress) setData((current) => ({ ...current, progress: result.progress }));
      if (status === 'completed') {
        toast.success('This topic is marked as completed. Test it while it is fresh.', {
          title: 'Well done',
          duration: 9000,
          action: (
            <button
              type="button"
              onClick={practise}
              className="mt-1.5 text-sm font-semibold underline underline-offset-2"
            >
              Practise this topic
            </button>
          ),
        });
      }
    } catch (err) {
      setData((current) => ({ ...current, progress: previous }));
      toast.error(err?.message || 'We could not save your progress.');
    } finally {
      setStatusPending(null);
    }
  };

  const bookmark = useMemo(() => {
    const rows = bookmarks.data?.bookmarks || [];
    return rows.find((row) => idOf(row.topic) === String(topicId)) || null;
  }, [bookmarks.data, topicId]);

  const toggleBookmark = async () => {
    setBookmarkPending(true);
    try {
      if (bookmark) {
        await libraryApi.deleteBookmark(bookmark._id);
        toast.info('Bookmark removed.');
      } else {
        await libraryApi.createBookmark({ targetType: 'topic', topic: topicId });
        toast.success('Saved to your bookmarks.');
      }
      await bookmarks.reload();
    } catch (err) {
      toast.error(err?.message || 'We could not change that bookmark.');
    } finally {
      setBookmarkPending(false);
    }
  };

  /* ------------------------------------------------------------------- render */

  if (loading) return <TopicSkeleton />;
  if (error) return <ErrorState error={error} onRetry={reload} className="card" />;
  if (!topic) return <ErrorState error={{ message: 'That topic was not found.', isRetryable: false }} />;

  const groups = groupBlocks(topic.blocks || []);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <Breadcrumb topic={topic} />

      <TopicHeader topic={topic} progress={progress} />

      {/* On a phone the actions follow you down the page; on a wide screen they
          live in the rail beside the text. */}
      <MobileActionBar
        status={progress.status || 'not_started'}
        statusPending={statusPending}
        onSetStatus={setStatus}
        bookmarked={Boolean(bookmark)}
        bookmarkPending={bookmarkPending || bookmarks.loading}
        onToggleBookmark={toggleBookmark}
        onPractise={practise}
        practisePending={practisePending}
        topicId={topic._id}
        questionCount={topic.questionCount}
      />

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <aside className="hidden space-y-4 lg:order-2 lg:sticky lg:top-20 lg:block">
          <ActionPanel
            progress={progress}
            statusPending={statusPending}
            onSetStatus={setStatus}
            bookmarked={Boolean(bookmark)}
            bookmarkPending={bookmarkPending || bookmarks.loading}
            onToggleBookmark={toggleBookmark}
            onPractise={practise}
            practisePending={practisePending}
            topicId={topic._id}
            questionCount={topic.questionCount}
            flashcardCount={topic.flashcardCount}
          />
        </aside>

        <div className="min-w-0 space-y-8 lg:order-1">
          <ManualText topic={topic} groups={groups} />

          <StudyAids topic={topic} />

          <FlashcardPreview cards={data.flashcards || []} topicId={topic._id} />

          <NotesPanel topicId={topic._id} />

          <TopicNavigation navigation={navigation} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ header --- */

function Breadcrumb({ topic }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      <ol className="flex flex-wrap items-center gap-1.5 text-ink-500">
        <li>
          <Link to="/study" className="hover:text-brand-700 hover:underline">
            Study
          </Link>
        </li>
        <li aria-hidden="true">
          <Icon name="chevronRight" size={13} strokeStyle className="text-ink-400" />
        </li>
        <li>
          {topic.subject?._id ? (
            <Link to={`/study/subject/${topic.subject._id}`} className="hover:text-brand-700 hover:underline">
              {topic.subject.shortName || topic.subject.name}
            </Link>
          ) : (
            <span>{topic.subject?.name}</span>
          )}
        </li>
        {topic.chapter?.title && (
          <>
            <li aria-hidden="true">
              <Icon name="chevronRight" size={13} strokeStyle className="text-ink-400" />
            </li>
            <li className="font-medium text-ink-700" aria-current="page">
              {topic.chapter.title}
            </li>
          </>
        )}
      </ol>
    </nav>
  );
}

function TopicHeader({ topic, progress }) {
  const status = progress.status || 'not_started';
  return (
    <header className="mt-4 max-w-reading">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={PROGRESS_STATUS_TONES[status]} icon={<Icon name={STATUS_ICONS[status]} size={12} />}>
          {PROGRESS_STATUS_LABELS[status]}
        </Badge>
        {progress.attempts > 0 && (
          <Badge tone="outline">
            Mastery {Math.round(progress.mastery || 0)}% · {plural(progress.attempts, 'attempt')}
          </Badge>
        )}
      </div>

      <h1 className="mt-3 font-serif text-2xl font-semibold leading-tight text-ink-900 sm:text-3xl">
        {topic.number && <span className="mr-2 tabular text-ink-400">{topic.number}</span>}
        {topic.title}
      </h1>

      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-500">
        <span className="inline-flex items-center gap-1.5">
          <Icon name="clock" size={14} className="text-ink-400" />
          About {minutesLabel(topic.estimatedMinutes || 0)} to read
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Icon name="note" size={14} className="text-ink-400" />
          {(topic.wordCount || 0).toLocaleString('en-GB')} words
        </span>
      </p>
    </header>
  );
}

/* ------------------------------------------------------------------- rail --- */

function ActionPanel({
  progress,
  statusPending,
  onSetStatus,
  bookmarked,
  bookmarkPending,
  onToggleBookmark,
  onPractise,
  practisePending,
  topicId,
  questionCount,
  flashcardCount,
}) {
  const current = progress.status || 'not_started';

  return (
    <Card>
      <CardHeader title="Your progress" subtitle="Only you can see this." />
      <div className="space-y-4 p-4">
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
            Mark where you have got to
          </legend>
          <div className="grid grid-cols-2 gap-1.5">
            {STATUSES.map((status) => {
              const selected = current === status;
              return (
                <button
                  key={status}
                  type="button"
                  aria-pressed={selected}
                  disabled={Boolean(statusPending)}
                  onClick={() => onSetStatus(status)}
                  className={cx(
                    'flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors',
                    'disabled:cursor-wait disabled:opacity-70',
                    selected
                      ? STATUS_SELECTED_CLASSES[status]
                      : 'border-paper-300 bg-white text-ink-600 hover:bg-paper-100',
                  )}
                >
                  {statusPending === status ? (
                    <Spinner size={12} />
                  ) : (
                    <Icon name={selected ? 'check' : STATUS_ICONS[status]} size={12} />
                  )}
                  <span>{PROGRESS_STATUS_LABELS[status]}</span>
                  {selected && <span className="sr-only">(current)</span>}
                </button>
              );
            })}
          </div>
        </fieldset>

        {progress.attempts > 0 && (
          <div>
            <ProgressBar
              value={Math.round(progress.mastery || 0)}
              tone={masteryTone(progress.mastery) === 'neutral' ? 'brand' : masteryTone(progress.mastery)}
              size="sm"
              label="Mastery"
              showValue
            />
            <p className="mt-1.5 text-xs text-ink-500">
              From {plural(progress.attempts, 'question')} you have answered on this topic.
            </p>
          </div>
        )}

        <div className="space-y-2 border-t border-paper-200 pt-4">
          <Button
            fullWidth
            onClick={onPractise}
            loading={practisePending}
            disabled={!questionCount}
            icon={<Icon name="quiz" size={15} />}
          >
            Practise this topic
          </Button>
          {!questionCount && (
            <p className="text-xs text-ink-500">There are no questions on this topic yet.</p>
          )}

          <Button
            fullWidth
            variant="secondary"
            to={`/flashcards?topic=${encodeURIComponent(topicId)}`}
            icon={<Icon name="cards" size={15} />}
          >
            Flashcards
            {flashcardCount > 0 && <span className="tabular text-ink-500">({flashcardCount})</span>}
          </Button>

          <Button
            fullWidth
            variant={bookmarked ? 'gold' : 'ghost'}
            onClick={onToggleBookmark}
            loading={bookmarkPending}
            aria-pressed={bookmarked}
            icon={<Icon name={bookmarked ? 'bookmark-check' : 'bookmark'} size={15} />}
          >
            {bookmarked ? 'Bookmarked' : 'Bookmark this topic'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

const STATUS_SELECTED_CLASSES = {
  not_started: 'border-ink-400 bg-paper-200 font-semibold text-ink-800',
  in_progress: 'border-brand-600 bg-brand-50 font-semibold text-brand-800',
  completed: 'border-success-500 bg-success-50 font-semibold text-success-700',
  needs_revision: 'border-warning-500 bg-warning-50 font-semibold text-warning-600',
};

/** A slim bar that stays with the reader on small screens. */
function MobileActionBar({
  status,
  statusPending,
  onSetStatus,
  bookmarked,
  bookmarkPending,
  onToggleBookmark,
  onPractise,
  practisePending,
  topicId,
  questionCount,
}) {
  return (
    <div className="sticky top-16 z-20 -mx-4 mt-4 border-y border-paper-300 bg-paper-100/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6 lg:hidden">
      <div className="flex items-center gap-2">
        <label htmlFor="topic-status-mobile" className="sr-only">
          Your progress on this topic
        </label>
        <select
          id="topic-status-mobile"
          value={status}
          disabled={Boolean(statusPending)}
          onChange={(event) => onSetStatus(event.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-paper-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25 disabled:opacity-60"
        >
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {PROGRESS_STATUS_LABELS[value]}
            </option>
          ))}
        </select>

        <Button size="sm" onClick={onPractise} loading={practisePending} disabled={!questionCount}>
          Practise
        </Button>

        <Link
          to={`/flashcards?topic=${encodeURIComponent(topicId)}`}
          aria-label="Review the flashcards for this topic"
          className="rounded-lg border border-paper-300 bg-white p-2 text-ink-600 hover:bg-paper-100"
        >
          <Icon name="cards" size={17} />
        </Link>

        <button
          type="button"
          onClick={onToggleBookmark}
          disabled={bookmarkPending}
          aria-pressed={bookmarked}
          aria-label={bookmarked ? 'Remove this topic from your bookmarks' : 'Bookmark this topic'}
          className={cx(
            'rounded-lg border p-2 transition-colors disabled:opacity-60',
            bookmarked
              ? 'border-gold-500 bg-gold-50 text-gold-700'
              : 'border-paper-300 bg-white text-ink-600 hover:bg-paper-100',
          )}
        >
          <Icon name={bookmarked ? 'bookmark-check' : 'bookmark'} size={17} />
        </button>
      </div>
    </div>
  );
}

function ScriptureCard({ references }) {
  return (
    <Card>
      <CardHeader title="Scripture in this topic" icon={<Icon name="scroll" size={17} />} />
      <ul className="flex flex-wrap gap-1.5 p-4">
        {references.map((reference) => (
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
    </Card>
  );
}

/* --------------------------------------------------------- the manual text --- */

/**
 * Groups consecutive list items so they can be marked up as a real list. No
 * text is altered: every block keeps its own anchor so it can be linked to.
 */
function groupBlocks(blocks) {
  const groups = [];
  blocks.forEach((block) => {
    const last = groups[groups.length - 1];
    if (block.kind === 'list_item' && last?.kind === 'list') {
      last.items.push(block);
    } else if (block.kind === 'list_item') {
      groups.push({ kind: 'list', items: [block] });
    } else {
      groups.push({ kind: 'block', block });
    }
  });
  return groups;
}

function ManualText({ topic, groups }) {
  if (groups.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="book"
          title="This topic has no syllabus text yet"
          message="The passage for this topic has not been transcribed. The study aids and questions below may still help."
        />
      </Card>
    );
  }

  return (
    <article className="card px-5 py-6 sm:px-8 sm:py-8">
      {topic.summary && (
        <div className="mb-7 rounded-xl border-l-[3px] border-brand-500 bg-brand-50 px-4 py-3.5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-brand-700">In brief</h2>
          <p className="mt-1.5 max-w-reading text-sm leading-relaxed text-ink-700">{topic.summary}</p>
        </div>
      )}

      <div className="prose-manual">
        {groups.map((group, index) =>
          group.kind === 'list' ? (
            <ul key={`list-${group.items[0].anchor ?? index}`} className="mt-4 space-y-2 first:mt-0">
              {group.items.map((item) => (
                <li
                  key={item.anchor}
                  id={`block-${item.anchor}`}
                  className="flex scroll-mt-24 gap-3 target:bg-gold-50"
                >
                  <span aria-hidden="true" className="mt-[0.65em] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <ManualBlock key={group.block.anchor ?? index} block={group.block} />
          ),
        )}
      </div>

      <footer className="mt-8 border-t border-paper-200 pt-4">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-500">
          <Icon name="book" size={13} className="mt-0.5 shrink-0 text-ink-400" />
          <span>
            Reproduced verbatim from the official syllabus
            {topic.citation ? ` — ${topic.citation}` : ''}
            {topic.pageNumber ? ` (page ${topic.pageNumber})` : ''}.
          </span>
        </p>
      </footer>
    </article>
  );
}

function ManualBlock({ block }) {
  const id = `block-${block.anchor}`;

  if (block.kind === 'heading') {
    return (
      <h2 id={id} className="mt-8 scroll-mt-24 font-serif text-lg font-semibold text-ink-900 first:mt-0">
        {block.text}
      </h2>
    );
  }

  if (block.kind === 'quote') {
    return (
      <blockquote id={id} className="mt-4 scroll-mt-24 border-l-[3px] border-gold-400 pl-4 italic text-ink-600">
        {block.text}
      </blockquote>
    );
  }

  // `mt-4 first:mt-0` keeps the rhythm after a list or a heading, where the
  // `.prose-manual > p + p` rule alone would leave a paragraph flush.
  return (
    <p id={id} className="mt-4 scroll-mt-24 target:bg-gold-50 first:mt-0">
      {block.text}
    </p>
  );
}

/* -------------------------------------------------------------- study aids --- */

function StudyAids({ topic }) {
  const hasKeyPoints = topic.keyPoints?.length > 0;
  const hasKeyTerms = topic.keyTerms?.length > 0;
  const hasExamFocus = topic.examFocus?.length > 0;
  const hasFigures = topic.importantFigures?.length > 0;
  const hasScripture = topic.scriptureReferences?.length > 0;

  if (!hasKeyPoints && !hasKeyTerms && !hasExamFocus && !hasFigures && !hasScripture) return null;

  return (
    <section aria-labelledby="study-aids-heading" className="space-y-4">
      <h2 id="study-aids-heading" className="font-serif text-lg font-semibold text-ink-900">
        Study aids
      </h2>

      <div className="grid gap-4 md:grid-cols-2">
        {hasKeyPoints && (
          <Card>
            <CardHeader title="Key points" icon={<Icon name="check" size={17} />} />
            <ul className="space-y-2 p-4">
              {topic.keyPoints.map((point, index) => (
                <li key={index} className="flex gap-2.5 text-sm leading-relaxed text-ink-700">
                  <Icon name="check" size={14} className="mt-1 shrink-0 text-success-500" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {hasExamFocus && (
          <Card>
            <CardHeader title="What the examiners look for" icon={<Icon name="target" size={17} />} />
            <ul className="space-y-2 p-4">
              {topic.examFocus.map((item, index) => (
                <li key={index} className="flex gap-2.5 text-sm leading-relaxed text-ink-700">
                  <Icon name="target" size={14} className="mt-1 shrink-0 text-flame-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {hasScripture && <ScriptureCard references={topic.scriptureReferences} />}

        {hasKeyTerms && (
          <Card className={cx(hasKeyPoints && hasExamFocus ? 'md:col-span-2' : '')}>
            <CardHeader title="Key terms" icon={<Icon name="scroll" size={17} />} />
            <dl className="divide-y divide-paper-200">
              {topic.keyTerms.map((term) => (
                <div key={term.term} className="px-4 py-3 sm:flex sm:gap-4">
                  <dt className="font-serif text-sm font-semibold text-ink-900 sm:w-48 sm:shrink-0">{term.term}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-ink-600 sm:mt-0">{term.definition}</dd>
                </div>
              ))}
            </dl>
          </Card>
        )}

        {hasFigures && (
          <Card className={cx(!hasKeyTerms && hasKeyPoints && hasExamFocus ? 'md:col-span-2' : '')}>
            <CardHeader title="People and places to know" icon={<Icon name="users" size={17} />} />
            <ul className="flex flex-wrap gap-1.5 p-4">
              {topic.importantFigures.map((figure) => (
                <li key={figure}>
                  <Badge tone="outline">{figure}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- flashcards --- */

function FlashcardPreview({ cards, topicId }) {
  if (!cards.length) return null;

  return (
    <section aria-label="Flashcards from this topic">
      <Card>
        <CardHeader
          title="Flashcards from this topic"
          subtitle={plural(cards.length, 'card')}
          icon={<Icon name="cards" size={18} />}
          action={
            <Button size="sm" variant="secondary" to={`/flashcards?topic=${encodeURIComponent(topicId)}`}>
              Review the deck
            </Button>
          }
        />
        <ul className="divide-y divide-paper-200">
          {cards.slice(0, 8).map((card) => (
            <li key={card._id}>
              <details className="group px-4 py-3">
                <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium text-ink-800">
                  <span>{card.front}</span>
                  <Icon
                    name="chevronDown"
                    size={15}
                    strokeStyle
                    className="shrink-0 text-ink-400 transition-transform group-open:rotate-180"
                  />
                </summary>
                <p className="mt-2 border-t border-paper-200 pt-2 text-sm leading-relaxed text-ink-600">{card.back}</p>
                {card.scriptureReferences?.length > 0 && (
                  <p className="mt-2 flex flex-wrap gap-1.5">
                    {card.scriptureReferences.map((reference) => (
                      <Link
                        key={reference.reference}
                        to={`/scripture/${encodeURIComponent(reference.reference)}`}
                        className="rounded-full bg-gold-50 px-2 py-0.5 text-[11px] font-medium text-gold-700 hover:bg-gold-100"
                      >
                        {reference.reference}
                      </Link>
                    ))}
                  </p>
                )}
              </details>
            </li>
          ))}
        </ul>
        {cards.length > 8 && (
          <p className="border-t border-paper-200 px-4 py-3 text-xs text-ink-500">
            {cards.length - 8} more in the full deck.
          </p>
        )}
      </Card>
    </section>
  );
}

/* ------------------------------------------------------------------- notes --- */

function NotesPanel({ topicId }) {
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(() => libraryApi.notes({ topic: topicId, limit: 100 }), [topicId]);

  const [body, setBody] = useState('');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ title: '', body: '' });
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const notes = data?.notes || [];

  const add = async (event) => {
    event.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    try {
      await libraryApi.createNote({
        targetType: 'topic',
        topic: topicId,
        title: title.trim(),
        body: body.trim(),
      });
      setBody('');
      setTitle('');
      await reload();
      toast.success('Note saved.');
    } catch (err) {
      toast.error(err?.message || 'We could not save that note.');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (note) => {
    if (!editDraft.body.trim()) return;
    try {
      await libraryApi.updateNote(note._id, { title: editDraft.title.trim(), body: editDraft.body.trim() });
      setEditingId(null);
      await reload();
      toast.success('Note updated.');
    } catch (err) {
      toast.error(err?.message || 'We could not update that note.');
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await libraryApi.deleteNote(pendingDelete._id);
      setPendingDelete(null);
      await reload();
      toast.success('Note deleted.');
    } catch (err) {
      toast.error(err?.message || 'We could not delete that note.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section aria-label="Your notes on this topic">
      <Card>
        <CardHeader
          title="Your notes on this topic"
          subtitle="Private to you. Nobody else — not your tutor, not another candidate — can read them."
          icon={<Icon name="note" size={18} />}
        />
        <form onSubmit={add} className="space-y-3 border-b border-paper-200 p-4">
          <Input
            label="Title (optional)"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            placeholder="A short heading"
          />
          <Textarea
            label="Note"
            required
            rows={3}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={20000}
            placeholder="What you want to remember from this passage…"
          />
          <div className="flex justify-end gap-2">
            {(body || title) && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setBody('');
                  setTitle('');
                }}
              >
                Clear
              </Button>
            )}
            <Button type="submit" loading={saving} disabled={!body.trim()} icon={<Icon name="plus" size={15} />}>
              Add note
            </Button>
          </div>
        </form>

        {loading && (
          <div className="space-y-3 p-4" aria-hidden="true">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {!loading && error && <ErrorState error={error} onRetry={reload} />}

        {!loading && !error && notes.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-ink-500">
            You have not written anything on this topic yet.
          </p>
        )}

        {!loading && !error && notes.length > 0 && (
          <ul className="divide-y divide-paper-200">
            {notes.map((note) => {
              const own = note.isOwn !== false;
              const editing = editingId === note._id;

              return (
                <li key={note._id} className="p-4">
                  {editing ? (
                    <div className="space-y-3">
                      <Input
                        label="Title (optional)"
                        value={editDraft.title}
                        onChange={(event) => setEditDraft((d) => ({ ...d, title: event.target.value }))}
                        maxLength={200}
                      />
                      <Textarea
                        label="Note"
                        rows={4}
                        value={editDraft.body}
                        onChange={(event) => setEditDraft((d) => ({ ...d, body: event.target.value }))}
                        maxLength={20000}
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                        <Button onClick={() => saveEdit(note)} disabled={!editDraft.body.trim()}>
                          Save changes
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {note.title && <p className="font-serif text-sm font-semibold text-ink-900">{note.title}</p>}
                        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-700">{note.body}</p>
                        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-400">
                          <span>Updated {relativeTime(note.updatedAt)}</span>
                          {!own && (
                            <Badge tone="gold" size="sm">
                              Shared by an administrator
                            </Badge>
                          )}
                        </p>
                      </div>

                      {own && (
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(note._id);
                              setEditDraft({ title: note.title || '', body: note.body || '' });
                            }}
                            className="rounded-lg p-1.5 text-ink-400 hover:bg-paper-100 hover:text-ink-700"
                            aria-label={`Edit note${note.title ? `: ${note.title}` : ''}`}
                          >
                            <Icon name="pen" size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDelete(note)}
                            className="rounded-lg p-1.5 text-ink-400 hover:bg-danger-50 hover:text-danger-600"
                            aria-label={`Delete note${note.title ? `: ${note.title}` : ''}`}
                          >
                            <Icon name="trash" size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
        onConfirm={remove}
        loading={deleting}
        tone="danger"
        confirmLabel="Delete note"
        title="Delete this note?"
        message="This cannot be undone."
      />
    </section>
  );
}

/* -------------------------------------------------------------- navigation --- */

function TopicNavigation({ navigation }) {
  const { previous, next } = navigation;
  if (!previous && !next) return null;

  return (
    <nav aria-label="Topics in this chapter" className="grid gap-3 sm:grid-cols-2">
      {previous ? (
        <Link
          to={`/study/topic/${previous._id}`}
          className="card card-hover group flex items-center gap-3 p-4 text-left"
        >
          <Icon name="chevronLeft" size={18} strokeStyle className="shrink-0 text-ink-400" />
          <span className="min-w-0">
            <span className="block text-xs uppercase tracking-wide text-ink-400">Previous topic</span>
            <span className="mt-0.5 block truncate font-serif text-sm font-medium text-ink-900 group-hover:text-brand-800">
              {previous.title}
            </span>
          </span>
        </Link>
      ) : (
        <span aria-hidden="true" className="hidden sm:block" />
      )}

      {next && (
        <Link
          to={`/study/topic/${next._id}`}
          className="card card-hover group flex items-center justify-end gap-3 p-4 text-right sm:col-start-2"
        >
          <span className="min-w-0">
            <span className="block text-xs uppercase tracking-wide text-ink-400">Next topic</span>
            <span className="mt-0.5 block truncate font-serif text-sm font-medium text-ink-900 group-hover:text-brand-800">
              {next.title}
            </span>
          </span>
          <Icon name="chevronRight" size={18} strokeStyle className="shrink-0 text-ink-400" />
        </Link>
      )}
    </nav>
  );
}

/* --------------------------------------------------------------- utilities --- */

function idOf(value) {
  if (!value) return '';
  return String(typeof value === 'object' ? value._id : value);
}

function TopicSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl" aria-hidden="true">
      <Skeleton className="h-4 w-56" />
      <Skeleton className="mt-4 h-5 w-28" rounded="rounded-full" />
      <Skeleton className="mt-3 h-9 w-3/4" />
      <Skeleton className="mt-3 h-4 w-64" />

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <div className="space-y-4 lg:order-2">
          <div className="card p-4">
            <Skeleton className="h-4 w-28" />
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-9" />
              ))}
            </div>
            <Skeleton className="mt-4 h-10 w-full" />
            <Skeleton className="mt-2 h-10 w-full" />
          </div>
        </div>

        <div className="lg:order-1">
          <div className="card px-5 py-6 sm:px-8 sm:py-8">
            <SkeletonText lines={4} />
            <div className="mt-6">
              <SkeletonText lines={5} />
            </div>
            <div className="mt-6">
              <SkeletonText lines={4} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
