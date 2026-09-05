import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { libraryApi, quizApi } from '@/services/api';
import { useAsync, useDocumentTitle, useUnsavedChangesWarning } from '@/hooks';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { DIFFICULTY_LABELS, DIFFICULTY_TONES, QUESTION_TYPE_LABELS, plural } from '@/utils/format';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Icon,
  ProgressBar,
  Skeleton,
  SkeletonText,
  SourceBadge,
  cx,
} from '@/components/ui';
import QuestionRenderer from '@/components/quiz/QuestionRenderer';
import AnswerFeedback from '@/components/quiz/AnswerFeedback';

/**
 * The practice session itself.
 *
 * One question at a time, and nothing is marked in the browser: every verdict,
 * every explanation and every mark comes back from the server, so what the
 * candidate is taught here is the same thing an examiner would say.
 */

const MODE_LABELS = {
  practice: 'Practice',
  topic_quiz: 'Topic quiz',
  daily_revision: 'Daily revision',
  weak_areas: 'Weak areas',
  mistakes: 'My mistakes',
  bookmarks: 'Bookmarked questions',
  unseen: 'Questions you have not seen',
};

const OPTION_TYPES = ['multiple_choice', 'true_false', 'multiple_response'];
const EMPTY_ANSWER = { selectedOptionKeys: [], textAnswer: '', matchAnswer: {}, viaVoice: false };

const idOf = (value) => (value && typeof value === 'object' ? value._id || value.id : value) || null;

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

export default function QuizPage() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { user } = useAuth();

  useDocumentTitle('Practice session');

  const seeded = location.state?.questions?.length ? location.state : null;

  const { data, error, loading, reload } = useAsync(() => quizApi.get(quizId), [quizId]);

  const questions = data?.questions || seeded?.questions || [];
  const total = questions.length;
  const mode = data?.quiz?.mode || seeded?.quiz?.mode || 'practice';

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [revealed, setRevealed] = useState({});
  const [outcomes, setOutcomes] = useState({});
  const [bookmarked, setBookmarked] = useState(() => new Set());
  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [notice, setNotice] = useState(location.state?.notice || null);

  const shownAtRef = useRef(Date.now());
  const initialisedRef = useRef(false);
  const finishingRef = useRef(false);

  /* Reconcile with the server once: pick up where the candidate left off, and
     send them to the results if this set is already finished. */
  useEffect(() => {
    if (!data || initialisedRef.current) return;
    initialisedRef.current = true;
    if (data.quiz?.status === 'completed' && !finishingRef.current) {
      navigate(`/quiz/${quizId}/results`, { replace: true });
      return;
    }
    const firstUnanswered = data.questions.findIndex((question) => !question.answered);
    setIndex(firstUnanswered === -1 ? 0 : firstUnanswered);
    shownAtRef.current = Date.now();
  }, [data, navigate, quizId]);

  const question = questions[index] || null;
  const answer = (question && answers[question.id]) || EMPTY_ANSWER;
  const feedback = question ? revealed[question.id] : null;

  const priorIds = useMemo(
    () => new Set(questions.filter((entry) => entry.answered).map((entry) => entry.id)),
    [questions],
  );

  const sessionOutcomes = useMemo(
    () => Object.entries(outcomes).filter(([id]) => !priorIds.has(id)),
    [outcomes, priorIds],
  );

  const answeredCount = Math.min(total, priorIds.size + sessionOutcomes.length);
  const correctCount = Math.min(
    answeredCount,
    (data?.quiz?.correctCount || 0) + sessionOutcomes.filter(([, outcome]) => outcome.isCorrect).length,
  );
  const finished = total > 0 && answeredCount >= total;

  useUnsavedChangesWarning(total > 0 && !finished && !finishing);

  // A fresh timestamp whenever a question is put in front of the candidate.
  useEffect(() => {
    shownAtRef.current = Date.now();
  }, [index]);

  const setAnswerFor = useCallback((questionId, value) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }, []);

  const submit = useCallback(async () => {
    if (!question || submitting || revealed[question.id]) return;
    const current = answers[question.id] || EMPTY_ANSWER;
    if (!hasAnswer(question, current)) return;

    setSubmitting(true);
    const timeSpentSeconds = Math.min(7200, Math.max(0, Math.round((Date.now() - shownAtRef.current) / 1000)));

    try {
      const response = await quizApi.answer(question.id, {
        selectedOptionKeys: current.selectedOptionKeys || [],
        textAnswer: current.textAnswer || '',
        matchAnswer: current.matchAnswer || {},
        viaVoice: Boolean(current.viaVoice),
        timeSpentSeconds,
        quiz: quizId,
      });

      setRevealed((state) => ({
        ...state,
        [question.id]: {
          result: response.result,
          review: response.review,
          theoryEvaluation: response.theoryEvaluation || null,
        },
      }));
      setOutcomes((state) => ({
        ...state,
        [question.id]: {
          isCorrect: response.result?.isCorrect,
          marksAwarded: response.result?.marksAwarded,
          marksAvailable: response.result?.marksAvailable,
          theoryEvaluation: response.theoryEvaluation || null,
          answer: current,
        },
      }));

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
  }, [answers, question, quizId, revealed, submitting, toast]);

  const finish = useCallback(async () => {
    if (finishing) return;
    finishingRef.current = true;
    setFinishing(true);
    try {
      await quizApi.complete(quizId);
      navigate(`/quiz/${quizId}/results`, { replace: true, state: { outcomes } });
    } catch (err) {
      finishingRef.current = false;
      setFinishing(false);
      toast.error(err.message || 'We could not close this set. Please try again.');
    }
  }, [finishing, navigate, outcomes, quizId, toast]);

  const goNext = useCallback(() => {
    if (index < total - 1) {
      setIndex(index + 1);
      return;
    }
    if (finished) finish();
  }, [finish, finished, index, total]);

  const retry = useCallback(() => {
    if (!question) return;
    setRevealed((state) => {
      const next = { ...state };
      delete next[question.id];
      return next;
    });
    setAnswerFor(question.id, EMPTY_ANSWER);
    shownAtRef.current = Date.now();
  }, [question, setAnswerFor]);

  const toggleBookmark = useCallback(async () => {
    if (!question) return;
    try {
      const response = await libraryApi.toggleQuestionBookmark(question.id);
      setBookmarked((state) => {
        const next = new Set(state);
        if (response?.bookmarked) next.add(question.id);
        else next.delete(question.id);
        return next;
      });
      toast.success(response?.bookmarked ? 'Saved to your bookmarks.' : 'Removed from your bookmarks.');
    } catch (err) {
      toast.error(err.message || 'We could not update that bookmark.');
    }
  }, [question, toast]);

  /* Keyboard: the candidate should be able to work through a set without
     reaching for the mouse. Held in a ref so the listener is registered once. */
  const keyHandlerRef = useRef(null);
  keyHandlerRef.current = (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || !question) return;
    const target = event.target;
    const tag = target?.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable;

    if (revealed[question.id]) {
      if (event.key === 'ArrowRight' && !typing) {
        event.preventDefault();
        goNext();
      }
      return;
    }

    if (!typing && OPTION_TYPES.includes(question.type)) {
      const letter = event.key.length === 1 ? event.key.toUpperCase() : '';
      let optionIndex = -1;
      if (/^[1-9]$/.test(event.key)) optionIndex = Number(event.key) - 1;
      else if (/^[A-H]$/.test(letter)) optionIndex = letter.charCodeAt(0) - 65;

      const option = (question.options || [])[optionIndex];
      if (option) {
        event.preventDefault();
        const current = answers[question.id] || EMPTY_ANSWER;
        if (question.type === 'multiple_response') {
          const keys = new Set(current.selectedOptionKeys || []);
          if (keys.has(option.key)) keys.delete(option.key);
          else keys.add(option.key);
          setAnswerFor(question.id, { ...current, selectedOptionKeys: [...keys] });
        } else {
          setAnswerFor(question.id, { ...current, selectedOptionKeys: [option.key] });
        }
        return;
      }
    }

    if (event.key === 'Enter' && !typing && tag !== 'BUTTON' && tag !== 'A') {
      event.preventDefault();
      submit();
    }
  };

  useEffect(() => {
    const listener = (event) => keyHandlerRef.current?.(event);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);

  /* ------------------------------------------------------------- states --- */

  if (loading && !questions.length) return <QuizSkeleton />;

  if (error && !questions.length) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorState error={error} onRetry={reload} />
        <div className="flex justify-center">
          <Button variant="secondary" to="/quiz">
            Choose another set
          </Button>
        </div>
      </div>
    );
  }

  if (!loading && !questions.length) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-paper-200 text-ink-400">
            <Icon name="quiz" size={26} />
          </div>
          <h1 className="font-serif text-lg font-semibold text-ink-800">This set has no questions</h1>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-ink-500">
            Nothing was drawn for this session. Build another set and it should come back with questions.
          </p>
          <Button className="mt-5" to="/quiz">
            Build another set
          </Button>
        </Card>
      </div>
    );
  }

  const answerable = hasAnswer(question, answer);
  const topicId = idOf(feedback?.review?.topic) || idOf(question?.topic);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Where you are */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge tone="brand">{MODE_LABELS[mode] || 'Practice'}</Badge>
            <span className="text-sm text-ink-500">{plural(total, 'question')}</span>
          </div>
          <Link
            to="/quiz"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-ink-500 hover:bg-paper-200 hover:text-ink-700"
          >
            <Icon name="close" size={14} />
            Leave this set
          </Link>
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-ink-700">
              Question {Math.min(index + 1, total)} of {total}
            </p>
            <p className="tabular text-sm text-ink-500">
              <span className="font-semibold text-ink-800">{correctCount}</span> correct of {answeredCount} answered
            </p>
          </div>
          <ProgressBar value={answeredCount} max={total} tone="brand" label={null} />
        </div>

        <QuestionNavigator
          questions={questions}
          index={index}
          outcomes={outcomes}
          priorIds={priorIds}
          onJump={setIndex}
        />
      </header>

      {notice && (
        <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-3.5" role="status">
          <Icon name="info" size={18} className="mt-0.5 shrink-0 text-brand-600" />
          <p className="min-w-0 flex-1 text-sm leading-relaxed text-ink-700">{notice}</p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss this notice"
            className="rounded p-1 text-ink-400 hover:bg-white/70 hover:text-ink-700"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      {/* The question */}
      {question && (
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
            <span className="ml-auto">
              <SourceBadge sourceKind={question.sourceKind} source={question.source} />
            </span>
          </div>

          <div className="px-5 py-5 sm:px-6">
            {question.context && (
              <div className="mb-4 rounded-xl border-l-[3px] border-paper-400 bg-paper-50 px-4 py-3">
                <p className="whitespace-pre-line font-serif text-sm leading-relaxed text-ink-600">{question.context}</p>
              </div>
            )}

            <h1 className="font-serif text-xl leading-relaxed text-ink-900 sm:text-2xl sm:leading-relaxed">
              {question.prompt}
            </h1>

            <div className="mt-5">
              <QuestionRenderer
                question={question}
                value={answer}
                onChange={(value) => setAnswerFor(question.id, value)}
                revealed={Boolean(feedback)}
                correctKeys={feedback?.review?.correctOptionKeys || []}
                disabled={Boolean(feedback) || submitting}
              />
            </div>
          </div>

          {!feedback && (
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
      )}

      {/* What it teaches */}
      {feedback && question && (
        <AnswerFeedback
          result={feedback.result}
          review={feedback.review}
          theoryEvaluation={feedback.theoryEvaluation}
          soundEnabled={user?.preferences?.soundEffectsEnabled !== false}
          bookmarked={bookmarked.has(question.id)}
          onBookmark={toggleBookmark}
          onRetry={retry}
          onStudyTopic={topicId ? () => navigate(`/study/topic/${topicId}`) : undefined}
          onNextQuestion={index < total - 1 ? goNext : undefined}
        />
      )}

      {/* Finishing */}
      {finished && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-success-500 bg-success-50 p-4">
          <p className="text-sm leading-relaxed text-ink-700">
            You have answered every question in this set.
          </p>
          <Button onClick={finish} loading={finishing} iconRight={<Icon name="chevronRight" size={15} strokeStyle />}>
            See your results
          </Button>
        </Card>
      )}

      {/* Keyboard help — of no use on a phone, so it is kept for larger screens. */}
      <p className="hidden flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-ink-400 sm:flex">
        <span className="font-medium uppercase tracking-wide">Keyboard</span>
        <span>
          <Key>1</Key>–<Key>4</Key> or <Key>A</Key>–<Key>D</Key> to choose
        </span>
        <span>
          <Key>Enter</Key> to submit
        </span>
        <span>
          <Key>→</Key> for the next question
        </span>
      </p>
    </div>
  );
}

function Key({ children }) {
  return (
    <kbd className="rounded border border-paper-300 bg-white px-1.5 py-0.5 font-sans text-[11px] font-medium text-ink-600">
      {children}
    </kbd>
  );
}

/** Numbered dots showing what has been answered, and how it went. */
function QuestionNavigator({ questions, index, outcomes, priorIds, onJump }) {
  return (
    <nav aria-label="Questions in this set">
      <ul className="flex flex-wrap gap-1.5">
        {questions.map((question, position) => {
          const outcome = outcomes[question.id];
          const answered = Boolean(outcome) || priorIds.has(question.id);
          const isCurrent = position === index;
          const reachable = answered || position === index || position <= index;

          const state = outcome
            ? outcome.isCorrect
              ? 'correct'
              : 'incorrect'
            : answered
              ? 'answered'
              : 'unanswered';

          const label = `Question ${position + 1}: ${
            state === 'correct'
              ? 'answered correctly'
              : state === 'incorrect'
                ? 'answered incorrectly'
                : state === 'answered'
                  ? 'already answered'
                  : 'not yet answered'
          }`;

          return (
            <li key={question.id}>
              <button
                type="button"
                onClick={() => reachable && onJump(position)}
                disabled={!reachable}
                aria-current={isCurrent ? 'true' : undefined}
                aria-label={label}
                title={label}
                className={cx(
                  'flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold transition-colors',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  isCurrent && 'ring-2 ring-brand-500 ring-offset-1 ring-offset-paper-100',
                  state === 'correct'
                    ? 'border-success-500 bg-success-50 text-success-700'
                    : state === 'incorrect'
                      ? 'border-danger-500 bg-danger-50 text-danger-600'
                      : state === 'answered'
                        ? 'border-brand-300 bg-brand-50 text-brand-800'
                        : 'border-paper-300 bg-white text-ink-500 hover:border-brand-300',
                )}
              >
                {/* Never colour alone: correct and incorrect carry a mark too. */}
                {state === 'correct' ? (
                  <Icon name="check" size={14} />
                ) : state === 'incorrect' ? (
                  <Icon name="close" size={12} />
                ) : (
                  position + 1
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function QuizSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-2 w-full" rounded="rounded-full" />
        <div className="flex gap-1.5">
          {Array.from({ length: 10 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-8" />
          ))}
        </div>
      </div>
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
        Loading your practice set
      </p>
    </div>
  );
}
