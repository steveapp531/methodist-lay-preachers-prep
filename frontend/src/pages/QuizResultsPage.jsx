import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { contentApi, quizApi } from '@/services/api';
import { formatDuration, useAsync, useDocumentTitle } from '@/hooks';
import { useToast } from '@/context/ToastContext';
import { DIFFICULTY_LABELS, DIFFICULTY_TONES, QUESTION_TYPE_LABELS, accuracyTone, percent } from '@/utils/format';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Icon,
  ProgressBar,
  ProgressRing,
  Skeleton,
  SkeletonText,
  SourceBadge,
  cx,
} from '@/components/ui';
import { ManualReferenceRow, TheoryBreakdown } from '@/components/quiz/AnswerFeedback';

/**
 * The end of a practice session.
 *
 * The score is the smallest part of this page. What matters is the topic
 * breakdown, which says where to go next, and the question-by-question review,
 * which carries the correct answer, the reason for it and the syllabus passage
 * it rests on.
 */

const idOf = (value) => (value && typeof value === 'object' ? value._id || value.id : value) || null;

function verdictFor(accuracy, answered) {
  if (!answered) return 'You did not answer anything in this set.';
  if (accuracy >= 0.85) return 'A strong showing. This material looks close to secure.';
  if (accuracy >= 0.7) return 'A sound result, with a few gaps worth closing before the examination.';
  if (accuracy >= 0.5) return 'Half of this is secure and half is not. The topics below show where the work is.';
  if (accuracy >= 0.3) return 'This material is not yet secure. Read the topics below before practising them again.';
  return 'This was hard going. Study the topics below first, then come back to the questions.';
}

export default function QuizResultsPage() {
  const { quizId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  useDocumentTitle('Your results');

  // Carried across from the session so we can show what was actually answered.
  const outcomes = location.state?.outcomes || {};

  const [pending, setPending] = useState(null);

  const { data, error, loading, reload } = useAsync(() => quizApi.complete(quizId), [quizId]);

  const quiz = data?.quiz || null;
  const summary = data?.summary || null;
  const questionIds = useMemo(() => (quiz?.questions || []).map(idOf).filter(Boolean), [quiz]);

  const review = useAsync(async () => {
    if (!questionIds.length) return [];
    const settled = await Promise.allSettled(questionIds.map((id) => contentApi.question(id)));
    return settled
      .map((entry, position) =>
        entry.status === 'fulfilled' ? { ...entry.value, id: questionIds[position] } : null,
      )
      .filter(Boolean);
  }, [questionIds.join(',')]);

  const startQuiz = async (key, payload) => {
    setPending(key);
    try {
      const response = await quizApi.create(payload);
      navigate(`/quiz/${response.quiz.id}`, {
        state: { quiz: response.quiz, questions: response.questions, notice: response.notice || null },
      });
    } catch (err) {
      toast.error(err.message || 'We could not build that set.');
      setPending(null);
    }
  };

  if (loading && !data) return <ResultsSkeleton />;

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

  if (!summary) return <ResultsSkeleton />;

  if (!summary.answered) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <EmptyState
            icon="quiz"
            title="Nothing was answered in this set"
            message="This session was closed before any question was attempted, so there is nothing to review. Start another set whenever you are ready."
            action={
              <Button to="/quiz" icon={<Icon name="quiz" size={16} />}>
                Start another set
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const accuracy = summary.accuracy || 0;
  const tone = accuracyTone(accuracy);
  const breakdown = [...(summary.topicBreakdown || [])].sort((a, b) => a.accuracy - b.accuracy);
  const weakestIds = new Set((summary.weakest || []).map((topic) => idOf(topic.topicId)));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Headline */}
      <Card className="overflow-hidden">
        <div className="flex flex-col items-center gap-5 px-5 py-6 text-center sm:flex-row sm:items-center sm:text-left">
          <ProgressRing value={accuracy * 100} size={104} stroke={9} tone={tone} sublabel="Accuracy" />
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-400">Practice complete</p>
            <h1 className="mt-1 font-serif text-2xl font-semibold text-ink-900">
              {summary.correct} of {summary.answered} correct
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{verdictFor(accuracy, summary.answered)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px border-t border-paper-200 bg-paper-200 sm:grid-cols-4">
          <SummaryCell label="Correct" value={summary.correct} tone="success" icon="check" />
          <SummaryCell label="Incorrect" value={summary.incorrect} tone="danger" icon="close" />
          <SummaryCell
            label="Marks"
            value={`${summary.marksAwarded}/${summary.marksAvailable}`}
            tone="neutral"
            icon="award"
          />
          <SummaryCell
            label="Time taken"
            value={formatDuration(summary.timeSpentSeconds)}
            tone="neutral"
            icon="clock"
          />
        </div>
      </Card>

      {/* Where the marks went */}
      <Card>
        <CardHeader
          title="How each topic went"
          subtitle="Weakest first, because that is where the next hour is best spent."
          icon={<Icon name="chart" size={18} />}
        />
        {breakdown.length === 0 ? (
          <EmptyState
            icon="chart"
            title="No topic breakdown"
            message="These questions were not linked to topics, so there is nothing to break down."
          />
        ) : (
          <ul className="divide-y divide-paper-200">
            {breakdown.map((topic) => {
              const topicId = idOf(topic.topicId);
              const isWeak = weakestIds.has(topicId) || topic.accuracy < 0.6;
              return (
                <li key={topicId || topic.topicTitle} className="px-5 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-ink-800">
                        {topic.topicTitle}
                        {isWeak && (
                          <Badge tone="warning" size="sm" icon={<Icon name="alert" size={11} />}>
                            Needs work
                          </Badge>
                        )}
                      </p>
                      {topic.subjectName && <p className="mt-0.5 text-xs text-ink-500">{topic.subjectName}</p>}
                    </div>
                    <p className="tabular text-sm text-ink-600">
                      {topic.correct}/{topic.attempted} · {percent(topic.accuracy)}
                    </p>
                  </div>

                  <ProgressBar
                    className="mt-2.5"
                    value={topic.accuracy * 100}
                    tone={accuracyTone(topic.accuracy)}
                    size="sm"
                    label={null}
                  />

                  {isWeak && topicId && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" to={`/study/topic/${topicId}`} icon={<Icon name="book" size={14} />}>
                        Revise this topic
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={pending === `topic:${topicId}`}
                        disabled={Boolean(pending)}
                        onClick={() => startQuiz(`topic:${topicId}`, { mode: 'topic_quiz', topic: topicId, size: 10 })}
                        icon={<Icon name="quiz" size={14} />}
                      >
                        Practise these
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Question by question */}
      <section aria-labelledby="question-review">
        <h2 id="question-review" className="mb-3 font-serif text-lg font-semibold text-ink-900">
          Question by question
        </h2>

        {review.loading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="p-5">
                <SkeletonText lines={2} />
              </Card>
            ))}
          </div>
        )}

        {review.error && <ErrorState error={review.error} onRetry={review.reload} />}

        {!review.loading && !review.error && (
          <ul className="space-y-3">
            {(review.data || []).map((entry, position) => (
              <li key={entry.id}>
                <QuestionReview
                  position={position + 1}
                  question={entry.question}
                  revealed={entry.revealed}
                  outcome={outcomes[entry.id]}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Where next */}
      <Card>
        <CardHeader title="What next" icon={<Icon name="sprout" size={18} />} />
        <div className="flex flex-wrap gap-2 p-5">
          <Button
            loading={pending === 'mistakes'}
            disabled={Boolean(pending)}
            onClick={() => startQuiz('mistakes', { mode: 'mistakes', size: 10 })}
            icon={<Icon name="target" size={16} />}
          >
            Practise your mistakes
          </Button>
          <Button variant="secondary" to="/quiz" icon={<Icon name="quiz" size={16} />}>
            Another quiz
          </Button>
          <Button variant="ghost" to="/dashboard" icon={<Icon name="dashboard" size={16} />}>
            Back to dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
}

function SummaryCell({ label, value, tone, icon }) {
  const tones = { success: 'text-success-600', danger: 'text-danger-600', neutral: 'text-ink-900' };
  return (
    <div className="bg-white px-4 py-3.5 text-center">
      <p className="flex items-center justify-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-400">
        <Icon name={icon} size={12} />
        {label}
      </p>
      <p className={cx('mt-1 tabular font-serif text-xl font-semibold', tones[tone])}>{value}</p>
    </div>
  );
}

/** One question, with everything needed to learn from it. */
function QuestionReview({ position, question, revealed, outcome }) {
  const isCorrect = outcome?.isCorrect;
  const known = outcome != null;
  const topicId = idOf(question.topic);

  return (
    <Card
      as="details"
      // Wrong answers open by default: those are the ones worth reading.
      open={known ? !isCorrect : false}
      className="group overflow-hidden"
    >
      <summary className="flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden px-5 py-4">
        <span
          className={cx(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
            !known
              ? 'bg-paper-200 text-ink-500'
              : isCorrect
                ? 'bg-success-500 text-white'
                : 'bg-danger-500 text-white',
          )}
        >
          {known ? <Icon name={isCorrect ? 'check' : 'close'} size={isCorrect ? 15 : 12} /> : position}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block font-serif text-base leading-relaxed text-ink-900">{question.prompt}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone="outline" size="sm">
              Question {position}
            </Badge>
            <Badge tone={DIFFICULTY_TONES[question.difficulty] || 'neutral'} size="sm">
              {DIFFICULTY_LABELS[question.difficulty] || 'Unrated'}
            </Badge>
            <Badge tone="outline" size="sm">
              {QUESTION_TYPE_LABELS[question.type] || question.type}
            </Badge>
            {known && (
              <Badge tone={isCorrect ? 'success' : 'danger'} size="sm">
                {isCorrect ? 'You were right' : 'You were wrong'}
              </Badge>
            )}
          </span>
        </span>

        <Icon
          name="chevronDown"
          size={18}
          strokeStyle
          className="mt-1 shrink-0 text-ink-400 transition-transform group-open:rotate-180"
        />
      </summary>

      <div className="space-y-4 border-t border-paper-200 px-5 py-4">
        {question.context && (
          <p className="whitespace-pre-line rounded-lg border-l-[3px] border-paper-400 bg-paper-50 px-4 py-3 font-serif text-sm leading-relaxed text-ink-600">
            {question.context}
          </p>
        )}

        {!revealed && (
          <p className="flex items-start gap-1.5 rounded-lg bg-warning-50 p-3 text-sm leading-relaxed text-warning-600">
            <Icon name="info" size={15} className="mt-0.5 shrink-0" />
            You did not answer this one, so the answer is still hidden. Attempt it and the full explanation opens up.
          </p>
        )}

        {known && (
          <Section title="What you answered" icon="pen">
            <YourAnswer question={question} answer={outcome.answer} />
          </Section>
        )}

        {revealed && (
          <Section title="The correct answer" icon="check">
            <CorrectAnswer question={question} />
          </Section>
        )}

        {revealed && outcome?.theoryEvaluation && (
          <TheoryBreakdown evaluation={outcome.theoryEvaluation} review={question} />
        )}

        {revealed && question.explanation && (
          <Section title="Why" icon="info">
            <p className="text-sm leading-relaxed text-ink-700">{question.explanation}</p>
          </Section>
        )}

        {revealed && question.manualReference?.excerpt && (
          <blockquote className="rounded-lg border-l-[3px] border-brand-500 bg-brand-50 px-4 py-3">
            <p className="font-serif text-sm italic leading-relaxed text-ink-700">“{question.manualReference.excerpt}”</p>
            <cite className="mt-2 block text-xs not-italic text-brand-700">
              {question.manualReference.citation || 'Official syllabus'}
            </cite>
          </blockquote>
        )}

        {revealed && (
          <ManualReferenceRow reference={question.manualReference} scriptures={question.scriptureReferences} />
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-paper-200 pt-3">
          <SourceBadge
            sourceKind={question.sourceKind}
            source={question.source}
            answerConfidence={question.answerConfidence}
          />
          <span className="ml-auto flex flex-wrap gap-2">
            {topicId && (
              <Link
                to={`/study/topic/${topicId}`}
                className="flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline"
              >
                <Icon name="book" size={14} />
                Study this topic
              </Link>
            )}
            <Link
              to={`/questions/${question.id || ''}`}
              className="flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline"
            >
              <Icon name="eye" size={14} />
              Open the question
            </Link>
          </span>
        </div>
      </div>
    </Card>
  );
}

function Section({ title, icon, children }) {
  return (
    <div>
      <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
        <Icon name={icon} size={13} />
        {title}
      </h4>
      {children}
    </div>
  );
}

function YourAnswer({ question, answer }) {
  if (!answer) return <p className="text-sm italic text-ink-500">Not recorded.</p>;

  if (['multiple_choice', 'true_false', 'multiple_response'].includes(question.type)) {
    const keys = answer.selectedOptionKeys || [];
    if (!keys.length) return <p className="text-sm italic text-ink-500">You left this blank.</p>;
    return (
      <ul className="space-y-1">
        {keys.map((key) => {
          const option = (question.options || []).find((entry) => entry.key === key);
          return (
            <li key={key} className="text-sm leading-relaxed text-ink-700">
              <span className="font-semibold">{key}.</span> {option?.text || '—'}
            </li>
          );
        })}
      </ul>
    );
  }

  if (question.type === 'matching') {
    const pairs = question.matchPairs || [];
    return (
      <ul className="space-y-1">
        {pairs.map((pair) => (
          <li key={pair.left} className="text-sm leading-relaxed text-ink-700">
            {pair.left} → {(answer.matchAnswer || {})[pair.left] || <span className="italic text-ink-500">blank</span>}
          </li>
        ))}
      </ul>
    );
  }

  if (!(answer.textAnswer || '').trim()) return <p className="text-sm italic text-ink-500">You left this blank.</p>;

  return (
    <p className="whitespace-pre-line rounded-lg bg-paper-50 p-3 font-serif text-sm leading-relaxed text-ink-700">
      {answer.textAnswer}
    </p>
  );
}

function CorrectAnswer({ question }) {
  if (['multiple_choice', 'true_false', 'multiple_response'].includes(question.type)) {
    const keys = question.correctOptionKeys || [];
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

function ResultsSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-5">
          <Skeleton className="h-[104px] w-[104px]" rounded="rounded-full" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-6 w-48" />
            <SkeletonText lines={2} />
          </div>
        </div>
      </Card>
      <Card className="p-5">
        <Skeleton className="mb-4 h-5 w-40" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-2/3" rounded="rounded" />
              <Skeleton className="h-1.5 w-full" rounded="rounded-full" />
            </div>
          ))}
        </div>
      </Card>
      <p className="sr-only" role="status">
        Working out your results
      </p>
    </div>
  );
}
