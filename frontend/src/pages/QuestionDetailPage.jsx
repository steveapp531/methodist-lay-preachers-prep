import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { contentApi, libraryApi, quizApi } from '@/services/api';
import { useAsync, useDocumentTitle } from '@/hooks';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { DIFFICULTY_LABELS, DIFFICULTY_TONES, QUESTION_TYPE_LABELS, plural } from '@/utils/format';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Icon,
  Skeleton,
  SkeletonText,
  SourceBadge,
  cx,
} from '@/components/ui';
import QuestionRenderer from '@/components/quiz/QuestionRenderer';
import AnswerFeedback, { ManualReferenceRow } from '@/components/quiz/AnswerFeedback';

/**
 * One question on its own page, reached from search or from a mistake.
 *
 * A question the candidate has already attempted is shown fully worked; one
 * they have not is offered as a practice attempt first, so the answer is never
 * given away before it has been earned.
 */

const idOf = (value) => (value && typeof value === 'object' ? value._id || value.id : value) || null;

const EMPTY_ANSWER = { selectedOptionKeys: [], textAnswer: '', matchAnswer: {}, viaVoice: false };

function hasAnswer(question, answer) {
  if (!question || !answer) return false;
  switch (question.type) {
    case 'multiple_choice':
    case 'true_false':
    case 'multiple_response':
      return (answer.selectedOptionKeys || []).length > 0;
    case 'fill_blank':
    case 'theory':
      return Boolean((answer.textAnswer || '').trim());
    case 'matching': {
      const pairs = question.matchPairs || [];
      return pairs.length > 0 && pairs.every((pair) => Boolean((answer.matchAnswer || {})[pair.left]));
    }
    default:
      return false;
  }
}

export default function QuestionDetailPage() {
  const { questionId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  useDocumentTitle('Question');

  const { data, error, loading, reload } = useAsync(() => contentApi.question(questionId), [questionId]);

  const [answer, setAnswer] = useState(EMPTY_ANSWER);
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const shownAtRef = useRef(Date.now());

  useEffect(() => {
    setAnswer(EMPTY_ANSWER);
    setFeedback(null);
    shownAtRef.current = Date.now();
  }, [questionId]);

  const question = feedback?.review || data?.question || null;
  const revealed = Boolean(feedback) || Boolean(data?.revealed);

  const submit = useCallback(async () => {
    if (!question || submitting || !hasAnswer(question, answer)) return;
    setSubmitting(true);
    const timeSpentSeconds = Math.min(7200, Math.max(0, Math.round((Date.now() - shownAtRef.current) / 1000)));
    try {
      const response = await quizApi.answer(questionId, {
        selectedOptionKeys: answer.selectedOptionKeys || [],
        textAnswer: answer.textAnswer || '',
        matchAnswer: answer.matchAnswer || {},
        viaVoice: Boolean(answer.viaVoice),
        timeSpentSeconds,
        mode: 'practice',
      });
      setFeedback({
        result: response.result,
        review: response.review,
        theoryEvaluation: response.theoryEvaluation || null,
      });
      (response.achievements || []).forEach((achievement) => {
        toast.toast({
          tone: 'success',
          title: `Achievement earned — ${achievement.title}`,
          message: achievement.description,
          duration: 8000,
        });
      });
    } catch (err) {
      toast.error(err.message || 'Your answer could not be sent. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [answer, question, questionId, submitting, toast]);

  const toggleBookmark = useCallback(async () => {
    try {
      const response = await libraryApi.toggleQuestionBookmark(questionId);
      setBookmarked(Boolean(response?.bookmarked));
      toast.success(response?.bookmarked ? 'Saved to your bookmarks.' : 'Removed from your bookmarks.');
    } catch (err) {
      toast.error(err.message || 'We could not update that bookmark.');
    }
  }, [questionId, toast]);

  if (loading && !data) return <QuestionSkeleton />;

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState error={error} onRetry={reload} />
        <div className="flex justify-center">
          <Button variant="secondary" to="/quiz">
            Back to practice
          </Button>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-paper-200 text-ink-400">
            <Icon name="search" size={26} />
          </div>
          <h1 className="font-serif text-lg font-semibold text-ink-800">That question is not available</h1>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-ink-500">
            It may have been withdrawn or is not published for your examination stage.
          </p>
          <Button className="mt-5" to="/quiz">
            Practise something else
          </Button>
        </Card>
      </div>
    );
  }

  const topicId = idOf(question.topic);
  const answerable = hasAnswer(question, answer);
  const attemptedEarlier = Boolean(data?.revealed) && !feedback;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <nav aria-label="Breadcrumb">
        <Link
          to="/quiz"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-700"
        >
          <Icon name="chevronLeft" size={15} strokeStyle />
          Practice
        </Link>
      </nav>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-paper-200 bg-paper-50 px-5 py-3">
          <Badge tone={DIFFICULTY_TONES[question.difficulty] || 'neutral'} size="sm">
            {DIFFICULTY_LABELS[question.difficulty] || 'Unrated'}
          </Badge>
          <Badge tone="outline" size="sm">
            {QUESTION_TYPE_LABELS[question.type] || question.type}
          </Badge>
          <Badge tone="outline" size="sm">
            {plural(question.marks || 1, 'mark')}
          </Badge>
          <span className="ml-auto flex flex-wrap items-center gap-2">
            <SourceBadge
              sourceKind={question.sourceKind}
              source={question.source}
              answerConfidence={question.answerConfidence}
            />
            <button
              type="button"
              onClick={toggleBookmark}
              aria-pressed={bookmarked}
              aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark this question'}
              className={cx(
                'rounded-lg p-1.5 transition-colors',
                bookmarked ? 'text-gold-600 hover:bg-gold-50' : 'text-ink-400 hover:bg-paper-200 hover:text-ink-700',
              )}
            >
              <Icon name={bookmarked ? 'bookmark-check' : 'bookmark'} size={17} />
            </button>
          </span>
        </div>

        <div className="px-5 py-5 sm:px-6">
          {attemptedEarlier && (
            <p className="mb-4 flex items-start gap-2 rounded-lg bg-brand-50 p-3 text-sm leading-relaxed text-brand-800">
              <Icon name="info" size={15} className="mt-0.5 shrink-0" />
              You have attempted this question before, so the worked answer is shown below.
            </p>
          )}

          {question.context && (
            <div className="mb-4 rounded-xl border-l-[3px] border-paper-400 bg-paper-50 px-4 py-3">
              <p className="whitespace-pre-line font-serif text-sm leading-relaxed text-ink-600">{question.context}</p>
            </div>
          )}

          <h1 className="font-serif text-xl leading-relaxed text-ink-900 sm:text-2xl sm:leading-relaxed">
            {question.prompt}
          </h1>

          {/* An empty, disabled essay box teaches nothing, so a theory question
              already attempted goes straight to its worked answer below. */}
          {!(attemptedEarlier && question.type === 'theory') && (
            <div className="mt-5">
              <QuestionRenderer
                question={question}
                value={answer}
                onChange={setAnswer}
                revealed={revealed}
                correctKeys={question.correctOptionKeys || []}
                disabled={revealed || submitting}
              />
            </div>
          )}
        </div>

        {!revealed && (
          <div className="flex flex-wrap items-center gap-3 border-t border-paper-200 bg-paper-50 px-5 py-4">
            <Button
              onClick={submit}
              loading={submitting}
              disabled={!answerable || submitting}
              size="lg"
              className="w-full sm:w-auto"
            >
              Submit answer
            </Button>
            {!answerable && (
              <p className="text-xs leading-relaxed text-ink-500">
                {question.type === 'matching'
                  ? 'Match every item before you submit.'
                  : question.type === 'theory' || question.type === 'fill_blank'
                    ? 'Write your answer to submit it.'
                    : 'Choose an answer to submit it.'}
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Just answered: the full marked feedback. */}
      {feedback && (
        <AnswerFeedback
          result={feedback.result}
          review={feedback.review}
          theoryEvaluation={feedback.theoryEvaluation}
          soundEnabled={user?.preferences?.soundEffectsEnabled !== false}
          bookmarked={bookmarked}
          onBookmark={toggleBookmark}
          onRetry={() => {
            setFeedback(null);
            setAnswer(EMPTY_ANSWER);
            shownAtRef.current = Date.now();
          }}
          onStudyTopic={topicId ? () => navigate(`/study/topic/${topicId}`) : undefined}
        />
      )}

      {/* Attempted on an earlier occasion: the worked answer, without a verdict. */}
      {attemptedEarlier && <WorkedAnswer question={question} topicId={topicId} />}
    </div>
  );
}

function WorkedAnswer({ question, topicId }) {
  return (
    <Card className="overflow-hidden">
      <div className="space-y-4 px-5 py-5">
        <div>
          <h2 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
            <Icon name="check" size={13} />
            The correct answer
          </h2>
          <Answer question={question} />
        </div>

        {question.type === 'theory' && question.markingRubric?.length > 0 && (
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
              What the marking scheme looks for
            </h2>
            <ul className="space-y-1.5">
              {question.markingRubric.map((criterion) => (
                <li key={criterion.id} className="flex items-start justify-between gap-3 rounded-lg border border-paper-200 p-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink-800">{criterion.label}</span>
                    {criterion.description && (
                      <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">{criterion.description}</span>
                    )}
                  </span>
                  <Badge tone="neutral" size="sm" className="shrink-0 tabular">
                    {plural(criterion.marks, 'mark')}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}

        {question.explanation && (
          <div>
            <h2 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
              <Icon name="info" size={13} />
              Why
            </h2>
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
      </div>

      <div className="flex flex-wrap gap-2 border-t border-paper-200 bg-paper-50 px-5 py-3.5">
        {topicId && (
          <Button variant="secondary" to={`/study/topic/${topicId}`} icon={<Icon name="book" size={15} />}>
            Study this topic
          </Button>
        )}
        <Button variant="ghost" to="/quiz" icon={<Icon name="quiz" size={15} />}>
          Practise more like this
        </Button>
      </div>
    </Card>
  );
}

function Answer({ question }) {
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
    return (
      <p className="text-sm leading-relaxed text-success-700">
        {(question.acceptedAnswers || []).join(', ') || '—'}
      </p>
    );
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

function QuestionSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Skeleton className="h-4 w-24" rounded="rounded" />
      <Card className="p-5">
        <div className="mb-5 flex gap-2">
          <Skeleton className="h-5 w-20" rounded="rounded-full" />
          <Skeleton className="h-5 w-24" rounded="rounded-full" />
        </div>
        <SkeletonText lines={2} className="mb-6" />
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" rounded="rounded-xl" />
          ))}
        </div>
      </Card>
      <p className="sr-only" role="status">
        Loading this question
      </p>
    </div>
  );
}
