import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { libraryApi, quizApi } from '@/services/api';
import { useAsync, useDocumentTitle } from '@/hooks';
import { useToast } from '@/context/ToastContext';
import { DIFFICULTY_LABELS, DIFFICULTY_TONES, QUESTION_TYPE_LABELS, formatDate } from '@/utils/format';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  Skeleton,
  SkeletonText,
  SourceBadge,
  Tabs,
} from '@/components/ui';
import { ManualReferenceRow } from '@/components/quiz/AnswerFeedback';

/**
 * Everything the candidate has saved to come back to.
 *
 * Saved work is only useful if it can be found again and acted on, so each
 * bookmark links straight to where it lives and the saved questions can be
 * turned into a practice set in one click.
 */

const idOf = (value) => (value && typeof value === 'object' ? value._id || value.id : value) || null;

const TAB_META = {
  question: { label: 'Questions', icon: 'quiz' },
  topic: { label: 'Topics', icon: 'book' },
  flashcard: { label: 'Flashcards', icon: 'cards' },
  scripture: { label: 'Scripture', icon: 'scroll' },
};

const TAB_ORDER = ['question', 'topic', 'flashcard', 'scripture'];

export default function BookmarksPage() {
  useDocumentTitle('Bookmarks');

  const navigate = useNavigate();
  const toast = useToast();

  const [active, setActive] = useState('question');
  const [pending, setPending] = useState(null);

  const { data, error, loading, reload, setData } = useAsync(() => libraryApi.bookmarks({ limit: 100 }), []);
  const bookmarks = useMemo(() => data?.bookmarks || [], [data]);

  const counts = useMemo(() => {
    const tally = { question: 0, topic: 0, flashcard: 0, scripture: 0 };
    bookmarks.forEach((bookmark) => {
      if (tally[bookmark.targetType] != null) tally[bookmark.targetType] += 1;
    });
    return tally;
  }, [bookmarks]);

  const visible = useMemo(
    () => bookmarks.filter((bookmark) => bookmark.targetType === active),
    [bookmarks, active],
  );

  const restore = async (bookmark) => {
    try {
      await libraryApi.createBookmark({
        targetType: bookmark.targetType,
        question: idOf(bookmark.question) || undefined,
        topic: idOf(bookmark.topic) || undefined,
        flashcard: idOf(bookmark.flashcard) || undefined,
        scriptureReference: bookmark.scriptureReference || undefined,
        label: bookmark.label || '',
      });
      await reload();
      toast.success('Bookmark restored.');
    } catch (err) {
      toast.error(err.message || 'We could not restore that bookmark.');
    }
  };

  const remove = async (bookmark) => {
    try {
      await libraryApi.deleteBookmark(bookmark._id);
      setData((current) => ({
        ...current,
        bookmarks: (current?.bookmarks || []).filter((entry) => entry._id !== bookmark._id),
      }));
      toast.toast({
        tone: 'info',
        message: 'Bookmark removed.',
        duration: 9000,
        action: (
          <button
            type="button"
            onClick={() => restore(bookmark)}
            className="mt-1.5 text-sm font-semibold underline underline-offset-2 hover:no-underline"
          >
            Undo
          </button>
        ),
      });
    } catch (err) {
      toast.error(err.message || 'We could not remove that bookmark.');
    }
  };

  const quizBookmarks = async () => {
    setPending('quiz');
    try {
      const response = await quizApi.create({ mode: 'bookmarks', size: 10 });
      navigate(`/quiz/${response.quiz.id}`, {
        state: { quiz: response.quiz, questions: response.questions, notice: response.notice || null },
      });
    } catch (err) {
      toast.error(err.message || 'We could not build that set.');
      setPending(null);
    }
  };

  const tabs = TAB_ORDER.map((key) => ({ key, label: TAB_META[key].label, count: counts[key] }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink-900 sm:text-3xl">Bookmarks</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-600">
            Everything you have saved: questions to revisit, topics to reread, flashcards to drill and scripture to sit
            with.
          </p>
        </div>
        {counts.question > 0 && (
          <Button
            onClick={quizBookmarks}
            loading={pending === 'quiz'}
            disabled={Boolean(pending)}
            icon={<Icon name="quiz" size={16} />}
          >
            Quiz my bookmarked questions
          </Button>
        )}
      </header>

      {loading && !data && <BookmarksSkeleton />}

      {error && <ErrorState error={error} onRetry={reload} />}

      {!error && data && bookmarks.length === 0 && (
        <Card>
          <EmptyState
            icon="bookmark"
            title="You have not saved anything yet"
            message="Use the bookmark button on a question, a topic, a flashcard or a scripture reference and it will be gathered here."
            action={
              <Button to="/quiz" icon={<Icon name="quiz" size={16} />}>
                Start a practice set
              </Button>
            }
          />
        </Card>
      )}

      {!error && bookmarks.length > 0 && (
        <>
          <Tabs tabs={tabs} active={active} onChange={setActive} />

          {visible.length === 0 ? (
            <Card>
              <EmptyState
                icon={TAB_META[active].icon}
                title={`No ${TAB_META[active].label.toLowerCase()} saved`}
                message="Bookmarks of this kind will appear here once you save one."
              />
            </Card>
          ) : (
            <ul className="space-y-3" role="list">
              {visible.map((bookmark) => (
                <li key={bookmark._id}>
                  <BookmarkRow bookmark={bookmark} onRemove={() => remove(bookmark)} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function BookmarkRow({ bookmark, onRemove }) {
  const removeButton = (
    <button
      type="button"
      onClick={onRemove}
      aria-label="Remove this bookmark"
      className="shrink-0 rounded-lg p-2 text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600"
    >
      <Icon name="trash" size={16} />
    </button>
  );

  const saved = <span className="text-xs text-ink-400">Saved {formatDate(bookmark.createdAt)}</span>;

  if (bookmark.targetType === 'question' && bookmark.question) {
    return <QuestionBookmark question={bookmark.question} saved={saved} removeButton={removeButton} />;
  }

  if (bookmark.targetType === 'topic' && bookmark.topic) {
    const topicId = idOf(bookmark.topic);
    return (
      <Card className="flex items-start gap-3 p-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Icon name="book" size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <Link
            to={`/study/topic/${topicId}`}
            className="font-serif text-base font-semibold text-ink-900 hover:text-brand-700 hover:underline"
          >
            {bookmark.topic.title}
          </Link>
          <p className="mt-1">{saved}</p>
          <Link
            to={`/study/topic/${topicId}`}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
          >
            Read this topic
            <Icon name="chevronRight" size={14} strokeStyle />
          </Link>
        </div>
        {removeButton}
      </Card>
    );
  }

  if (bookmark.targetType === 'flashcard' && bookmark.flashcard) {
    return (
      <Card as="details" className="group overflow-hidden">
        <summary className="flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden px-5 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold-50 text-gold-700">
            <Icon name="cards" size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-serif text-base leading-relaxed text-ink-900">{bookmark.flashcard.front}</span>
            <span className="mt-1 block">{saved}</span>
          </span>
          <Icon
            name="chevronDown"
            size={18}
            strokeStyle
            className="mt-2 shrink-0 text-ink-400 transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="border-t border-paper-200 px-5 py-4">
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">The answer</h3>
          <p className="whitespace-pre-line font-serif text-sm leading-relaxed text-ink-700">{bookmark.flashcard.back}</p>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-paper-200 pt-3">
            <Link to="/flashcards" className="text-sm font-medium text-brand-700 hover:underline">
              Go to flashcards
            </Link>
            {removeButton}
          </div>
        </div>
      </Card>
    );
  }

  if (bookmark.targetType === 'scripture' && bookmark.scriptureReference) {
    return (
      <Card className="flex items-start gap-3 p-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold-50 text-gold-700">
          <Icon name="scroll" size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <Link
            to={`/scripture/${encodeURIComponent(bookmark.scriptureReference)}`}
            className="font-serif text-base font-semibold text-ink-900 hover:text-brand-700 hover:underline"
          >
            {bookmark.scriptureReference}
          </Link>
          {bookmark.label && <p className="mt-1 text-sm leading-relaxed text-ink-600">{bookmark.label}</p>}
          <p className="mt-1">{saved}</p>
        </div>
        {removeButton}
      </Card>
    );
  }

  // A bookmark whose target has since been withdrawn.
  return (
    <Card className="flex items-start gap-3 p-5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-paper-200 text-ink-400">
        <Icon name="alert" size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-700">This bookmark no longer points at anything</p>
        <p className="mt-0.5 text-sm leading-relaxed text-ink-500">
          The item it was saved against has been withdrawn. You can safely remove it.
        </p>
      </div>
      {removeButton}
    </Card>
  );
}

function QuestionBookmark({ question, saved, removeButton }) {
  const questionId = idOf(question);
  const topicId = idOf(question.topic);

  return (
    <Card as="details" className="group overflow-hidden">
      <summary className="flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden px-5 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Icon name="quiz" size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-serif text-base leading-relaxed text-ink-900">{question.prompt}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge tone={DIFFICULTY_TONES[question.difficulty] || 'neutral'} size="sm">
              {DIFFICULTY_LABELS[question.difficulty] || 'Unrated'}
            </Badge>
            <Badge tone="outline" size="sm">
              {QUESTION_TYPE_LABELS[question.type] || question.type}
            </Badge>
            {saved}
          </span>
        </span>
        <Icon
          name="chevronDown"
          size={18}
          strokeStyle
          className="mt-2 shrink-0 text-ink-400 transition-transform group-open:rotate-180"
        />
      </summary>

      <div className="space-y-4 border-t border-paper-200 px-5 py-4">
        <div>
          <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
            <Icon name="check" size={13} />
            The answer
          </h3>
          <BookmarkedAnswer question={question} />
        </div>

        {question.explanation && (
          <div>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
              <Icon name="info" size={13} />
              Why
            </h3>
            <p className="text-sm leading-relaxed text-ink-700">{question.explanation}</p>
          </div>
        )}

        <ManualReferenceRow reference={question.manualReference} scriptures={question.scriptureReferences} />

        <div className="flex flex-wrap items-center gap-3 border-t border-paper-200 pt-3">
          <SourceBadge
            sourceKind={question.sourceKind}
            source={question.source}
            answerConfidence={question.answerConfidence}
          />
          <span className="ml-auto flex flex-wrap items-center gap-3">
            {topicId && (
              <Link
                to={`/study/topic/${topicId}`}
                className="flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
              >
                <Icon name="book" size={14} />
                Study this topic
              </Link>
            )}
            <Link
              to={`/questions/${questionId}`}
              className="flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
            >
              <Icon name="eye" size={14} />
              Open the question
            </Link>
            {removeButton}
          </span>
        </div>
      </div>
    </Card>
  );
}

function BookmarkedAnswer({ question }) {
  if (['multiple_choice', 'true_false', 'multiple_response'].includes(question.type)) {
    const keys = question.correctOptionKeys || [];
    if (!keys.length) return <p className="text-sm italic text-ink-500">Not recorded.</p>;
    return (
      <ul className="space-y-1">
        {keys.map((key) => {
          const option = (question.options || []).find((entry) => entry.key === key);
          return (
            <li key={key} className="flex gap-2 text-sm leading-relaxed text-success-700">
              <Icon name="check" size={15} className="mt-0.5 shrink-0" />
              <span>
                <span className="font-semibold">{key}.</span> {option?.text || '—'}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  if (question.type === 'fill_blank') {
    return <p className="text-sm leading-relaxed text-success-700">{(question.acceptedAnswers || []).join(', ') || '—'}</p>;
  }

  if (question.type === 'matching') {
    return (
      <ul className="space-y-1">
        {(question.matchPairs || []).map((pair) => (
          <li key={pair.left} className="text-sm leading-relaxed text-success-700">
            {pair.left} → {pair.right}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-3">
      {question.idealAnswer && (
        <p className="whitespace-pre-line font-serif text-sm leading-relaxed text-ink-700">{question.idealAnswer}</p>
      )}
      {question.keyPoints?.length > 0 && (
        <ul className="space-y-1">
          {question.keyPoints.map((point, index) => (
            <li key={index} className="flex gap-2 text-sm leading-relaxed text-ink-700">
              <Icon name="check" size={14} className="mt-0.5 shrink-0 text-success-500" />
              {point}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BookmarksSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full max-w-md" />
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="p-5">
          <div className="flex gap-3">
            <Skeleton className="h-9 w-9" />
            <div className="flex-1 space-y-2.5">
              <SkeletonText lines={2} />
            </div>
          </div>
        </Card>
      ))}
      <p className="sr-only" role="status">
        Loading your bookmarks
      </p>
    </div>
  );
}
