import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { contentApi, libraryApi, quizApi } from '@/services/api';
import { useAsync, useDocumentTitle } from '@/hooks';
import { useToast } from '@/context/ToastContext';
import {
  DIFFICULTY_LABELS,
  DIFFICULTY_TONES,
  QUESTION_TYPE_LABELS,
  plural,
  relativeTime,
} from '@/utils/format';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  Select,
  Skeleton,
  SkeletonText,
  SourceBadge,
  cx,
} from '@/components/ui';
import { ManualReferenceRow } from '@/components/quiz/AnswerFeedback';

/**
 * Every question the candidate has answered wrongly.
 *
 * A mistake is only useful if it is repaired, so each entry carries the right
 * answer, the reason for it and a way straight into the syllabus passage, and
 * the whole list can be turned into a practice set in one click.
 */

const idOf = (value) => (value && typeof value === 'object' ? value._id || value.id : value) || null;

export default function MistakesPage() {
  useDocumentTitle('My mistakes');

  const navigate = useNavigate();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [bookmarks, setBookmarks] = useState({});
  const [pending, setPending] = useState(null);

  const { data, error, loading, reload } = useAsync(() => quizApi.mistakes({ page, limit: 10 }), [page]);
  const subjects = useAsync(() => contentApi.subjects(), []);

  const mistakes = data?.mistakes || [];
  const meta = data?._meta || { page: 1, pages: 1, total: 0 };

  const visible = useMemo(
    () => (subjectFilter ? mistakes.filter((entry) => idOf(entry.question.subject) === subjectFilter) : mistakes),
    [mistakes, subjectFilter],
  );

  const practiseMistakes = async () => {
    setPending('quiz');
    try {
      const response = await quizApi.create({ mode: 'mistakes', size: 20 });
      navigate(`/quiz/${response.quiz.id}`, {
        state: { quiz: response.quiz, questions: response.questions, notice: response.notice || null },
      });
    } catch (err) {
      toast.error(err.message || 'We could not build that set.');
      setPending(null);
    }
  };

  const toggleBookmark = async (questionId) => {
    try {
      const response = await libraryApi.toggleQuestionBookmark(questionId);
      setBookmarks((state) => ({ ...state, [questionId]: Boolean(response?.bookmarked) }));
      toast.success(response?.bookmarked ? 'Saved to your bookmarks.' : 'Removed from your bookmarks.');
    } catch (err) {
      toast.error(err.message || 'We could not update that bookmark.');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink-900 sm:text-3xl">My mistakes</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-600">
            Every question you have answered wrongly, with the right answer and the reason for it. Working through these
            is the quickest way to raise your marks.
          </p>
        </div>
        {meta.total > 0 && (
          <Button
            onClick={practiseMistakes}
            loading={pending === 'quiz'}
            disabled={Boolean(pending)}
            icon={<Icon name="target" size={16} />}
          >
            Practise all my mistakes
          </Button>
        )}
      </header>

      {loading && !data && <MistakesSkeleton />}

      {error && <ErrorState error={error} onRetry={reload} />}

      {!error && data && mistakes.length === 0 && (
        <Card>
          <EmptyState
            icon="award"
            title={page > 1 ? 'Nothing more on this page' : 'No mistakes recorded'}
            message={
              page > 1
                ? 'You have reached the end of the list.'
                : 'You have not answered anything wrongly yet — or you have not started. Either way, a practice set is the way to find out where you stand.'
            }
            action={
              page > 1 ? (
                <Button variant="secondary" onClick={() => setPage(1)}>
                  Back to the first page
                </Button>
              ) : (
                <Button to="/quiz" icon={<Icon name="quiz" size={16} />}>
                  Start a practice set
                </Button>
              )
            }
          />
        </Card>
      )}

      {!error && mistakes.length > 0 && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Select
              label="Subject"
              className="w-full sm:w-64"
              value={subjectFilter}
              onChange={(event) => setSubjectFilter(event.target.value)}
              hint="Filters the mistakes shown on this page."
            >
              <option value="">All subjects</option>
              {(subjects.data?.subjects || []).map((subject) => (
                <option key={subject._id} value={subject._id}>
                  {subject.name}
                </option>
              ))}
            </Select>
            <p className="pb-6 text-sm text-ink-500" aria-live="polite">
              {plural(meta.total, 'question')} to put right
            </p>
          </div>

          {visible.length === 0 ? (
            <Card>
              <EmptyState
                icon="filter"
                title="Nothing on this page for that subject"
                message="Try another page, or clear the filter to see everything."
                action={
                  <Button variant="secondary" onClick={() => setSubjectFilter('')}>
                    Clear the filter
                  </Button>
                }
              />
            </Card>
          ) : (
            <ul className="space-y-3">
              {visible.map((entry) => (
                <li key={entry.question.id}>
                  <MistakeRow
                    entry={entry}
                    bookmarked={Boolean(bookmarks[entry.question.id])}
                    onBookmark={() => toggleBookmark(entry.question.id)}
                  />
                </li>
              ))}
            </ul>
          )}

          {meta.pages > 1 && (
            <nav className="flex items-center justify-between gap-3 pt-2" aria-label="Mistakes pages">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                icon={<Icon name="chevronLeft" size={15} strokeStyle />}
              >
                Previous
              </Button>
              <p className="tabular text-sm text-ink-500">
                Page {meta.page} of {meta.pages}
              </p>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= meta.pages || loading}
                onClick={() => setPage((current) => current + 1)}
                iconRight={<Icon name="chevronRight" size={15} strokeStyle />}
              >
                Next
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function MistakeRow({ entry, bookmarked, onBookmark }) {
  const question = entry.question;
  const topicId = idOf(question.topic);
  const topicTitle = typeof question.topic === 'object' ? question.topic?.title : null;
  const subjectName = typeof question.subject === 'object' ? question.subject?.shortName || question.subject?.name : null;

  return (
    <Card as="details" className="group overflow-hidden">
      <summary className="flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden px-5 py-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger-50 text-danger-500">
          <Icon name="close" size={14} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="danger" size="sm" icon={<Icon name="refresh" size={11} />}>
              Missed {entry.misses} {entry.misses === 1 ? 'time' : 'times'}
            </Badge>
            <span className="text-xs text-ink-500">Last attempted {relativeTime(entry.lastAttemptedAt)}</span>
            {subjectName && (
              <Badge tone="outline" size="sm">
                {subjectName}
              </Badge>
            )}
          </span>
          <span className="mt-2 block font-serif text-base leading-relaxed text-ink-900">{question.prompt}</span>
          {topicTitle && <span className="mt-1 block text-xs text-ink-500">{topicTitle}</span>}
        </span>

        <Icon
          name="chevronDown"
          size={18}
          strokeStyle
          className="mt-1.5 shrink-0 text-ink-400 transition-transform group-open:rotate-180"
        />
      </summary>

      <div className="space-y-4 border-t border-paper-200 px-5 py-4">
        {question.context && (
          <p className="whitespace-pre-line rounded-lg border-l-[3px] border-paper-400 bg-paper-50 px-4 py-3 font-serif text-sm leading-relaxed text-ink-600">
            {question.context}
          </p>
        )}

        <div>
          <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
            <Icon name="check" size={13} />
            The correct answer
          </h3>
          <CorrectAnswer question={question} />
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

        {question.manualReference?.excerpt && (
          <blockquote className="rounded-lg border-l-[3px] border-brand-500 bg-brand-50 px-4 py-3">
            <p className="font-serif text-sm italic leading-relaxed text-ink-700">“{question.manualReference.excerpt}”</p>
            <cite className="mt-2 block text-xs not-italic text-brand-700">
              {question.manualReference.citation || 'Official syllabus'}
            </cite>
          </blockquote>
        )}

        <ManualReferenceRow reference={question.manualReference} scriptures={question.scriptureReferences} />

        <div className="flex flex-wrap items-center gap-3 border-t border-paper-200 pt-3">
          <Badge tone={DIFFICULTY_TONES[question.difficulty] || 'neutral'} size="sm">
            {DIFFICULTY_LABELS[question.difficulty] || 'Unrated'}
          </Badge>
          <Badge tone="outline" size="sm">
            {QUESTION_TYPE_LABELS[question.type] || question.type}
          </Badge>
          <SourceBadge
            sourceKind={question.sourceKind}
            source={question.source}
            answerConfidence={question.answerConfidence}
          />

          <span className="ml-auto flex flex-wrap items-center gap-3">
            {topicId && (
              <Link
                to={`/study/topic/${topicId}`}
                className="flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline"
              >
                <Icon name="book" size={14} />
                Study this topic
              </Link>
            )}
            <button
              type="button"
              onClick={onBookmark}
              aria-pressed={bookmarked}
              className={cx(
                'flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium transition-colors',
                bookmarked ? 'text-gold-700 hover:bg-gold-50' : 'text-ink-500 hover:bg-paper-100 hover:text-ink-700',
              )}
            >
              <Icon name={bookmarked ? 'bookmark-check' : 'bookmark'} size={14} />
              {bookmarked ? 'Bookmarked' : 'Bookmark'}
            </button>
          </span>
        </div>
      </div>
    </Card>
  );
}

function CorrectAnswer({ question }) {
  if (['multiple_choice', 'true_false', 'multiple_response'].includes(question.type)) {
    return (
      <ul className="space-y-1">
        {(question.correctOptionKeys || []).map((key) => {
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

function MistakesSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="p-5">
          <div className="flex gap-3">
            <Skeleton className="h-8 w-8" rounded="rounded-full" />
            <div className="flex-1 space-y-2.5">
              <Skeleton className="h-4 w-40" rounded="rounded" />
              <SkeletonText lines={2} />
            </div>
          </div>
        </Card>
      ))}
      <p className="sr-only" role="status">
        Loading your mistakes
      </p>
    </div>
  );
}
