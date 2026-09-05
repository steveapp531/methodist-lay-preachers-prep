import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { libraryApi, mockApi, quizApi } from '@/services/api';
import { useAsync, useDocumentTitle, formatDuration } from '@/hooks';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  ProgressBar,
  ProgressRing,
  Skeleton,
  SkeletonText,
  SourceBadge,
  StatTile,
  Tabs,
  cx,
} from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import QuestionRenderer from '@/components/quiz/QuestionRenderer';
import { ManualReferenceRow, TheoryBreakdown } from '@/components/quiz/AnswerFeedback';
import { QUESTION_TYPE_LABELS, formatDateTime, minutesLabel, percent } from '@/utils/format';
import { READINESS_BANDS } from '@shared/constants';

const BAND_TONES = { danger: 'danger', warning: 'warning', info: 'brand', success: 'success' };

const FILTERS = [
  { key: 'all', label: 'All questions' },
  { key: 'incorrect', label: 'Incorrect only' },
  { key: 'flagged', label: 'Flagged only' },
  { key: 'theory', label: 'Theory only' },
];

/**
 * The marked paper.
 *
 * A percentage on its own teaches nothing, so the score is only the first
 * screenful. Below it sits the whole paper again: what was answered, what was
 * right, why it was right, where in the syllabus it is written, and a way
 * straight back into the weakest topics.
 */
export default function MockExamResultsPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const state = useAsync(async () => {
    const review = await mockApi.review(attemptId);
    // The review payload carries the marking; the sitting payload carries the
    // paper's own rules (its pass mark and section structure).
    let paper = null;
    try {
      paper = (await mockApi.attempt(attemptId))?.attempt || null;
    } catch {
      /* The result is still worth showing without the paper's own metadata. */
    }
    return { ...review, paper };
  }, [attemptId]);

  useDocumentTitle(state.data?.attempt?.title ? `${state.data.attempt.title} — result` : 'Examination result');

  const [filter, setFilter] = useState('all');
  const [bookmarked, setBookmarked] = useState({});
  const [practising, setPractising] = useState(null);

  const attempt = state.data?.attempt || null;
  const questions = useMemo(() => state.data?.questions || [], [state.data]);
  const paper = state.data?.paper || null;
  const passMark = paper?.passMark ?? 50;

  const sections = useMemo(() => {
    if (paper?.sections?.length) return paper.sections;
    const keys = [...new Set(questions.map((q) => q.sectionKey))];
    return keys.map((key) => ({ key, label: `Section ${key}`, instructions: '', count: null, answerCount: null }));
  }, [paper, questions]);

  const topics = useMemo(() => {
    const rows = attempt?.topicBreakdown || [];
    return [...rows].sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0));
  }, [attempt]);

  const weakTopics = topics.filter((t) => (t.accuracy ?? 0) < 0.6);
  const strongTopics = [...topics].reverse().filter((t) => (t.accuracy ?? 0) >= 0.8);

  const counts = useMemo(
    () => ({
      all: questions.length,
      incorrect: questions.filter((q) => !q.result?.isCorrect).length,
      flagged: questions.filter((q) => q.yourAnswer?.flagged).length,
      theory: questions.filter((q) => q.question?.type === 'theory').length,
    }),
    [questions],
  );

  const visible = useMemo(() => {
    if (filter === 'incorrect') return questions.filter((q) => !q.result?.isCorrect);
    if (filter === 'flagged') return questions.filter((q) => q.yourAnswer?.flagged);
    if (filter === 'theory') return questions.filter((q) => q.question?.type === 'theory');
    return questions;
  }, [questions, filter]);

  const practise = async (topic) => {
    if (!topic?.topic) return;
    setPractising(String(topic.topic));
    try {
      const quiz = await quizApi.create({ mode: 'topic_quiz', topic: String(topic.topic), size: 10 });
      if (!quiz?.quiz?.id) throw new Error('No quiz could be built for that topic.');
      navigate(`/quiz/${quiz.quiz.id}`);
    } catch (error) {
      toast.error(error?.message || 'We could not build a quiz for that topic just now.');
      setPractising(null);
    }
  };

  const toggleBookmark = async (questionId) => {
    try {
      const result = await libraryApi.toggleQuestionBookmark(questionId);
      setBookmarked((prev) => ({ ...prev, [questionId]: Boolean(result?.bookmarked) }));
      toast.success(result?.bookmarked ? 'Bookmarked.' : 'Bookmark removed.');
    } catch (error) {
      toast.error(error?.message || 'The bookmark could not be saved.');
    }
  };

  /* --------------------------------------------------------------- states --- */

  if (state.loading) return <ResultsSkeleton />;

  if (state.error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Card>
          <ErrorState error={state.error} onRetry={state.reload} />
          <div className="border-t border-paper-200 px-5 py-3.5 text-center">
            <Button variant="ghost" to="/mock-exam">
              Back to mock examinations
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Card>
          <EmptyState
            icon="exam"
            title="That result is not available"
            message="We could not find a marked paper with this reference."
            action={<Button to="/mock-exam">Back to mock examinations</Button>}
          />
        </Card>
      </div>
    );
  }

  const passed = (attempt.percentage ?? 0) >= passMark;
  const band = READINESS_BANDS.find((b) => b.key === attempt.readinessBand);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <nav className="mb-4">
        <Link to="/mock-exam" className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:underline">
          <Icon name="chevronLeft" size={15} strokeStyle />
          All mock examinations
        </Link>
      </nav>

      {/* ------------------------------------------------------------ result --- */}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-6 px-5 py-6 sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-5">
            <ProgressRing
              value={attempt.percentage ?? 0}
              size={112}
              stroke={9}
              tone={passed ? 'success' : 'danger'}
              sublabel="Overall"
            />
            <div>
              <h1 className="font-serif text-xl font-semibold text-ink-900 sm:text-2xl">{attempt.title}</h1>
              <p className="tabular mt-1 text-sm text-ink-600">
                {attempt.totalMarks} of {attempt.totalAvailable} marks
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone={passed ? 'success' : 'danger'} icon={<Icon name={passed ? 'check' : 'close'} size={12} />}>
                  {passed ? 'Pass' : 'Below the pass mark'}
                </Badge>
                {band && <Badge tone={BAND_TONES[band.tone] || 'neutral'}>{band.label}</Badge>}
                {attempt.autoSubmitted && (
                  <Badge tone="warning" icon={<Icon name="clock" size={12} />}>
                    Submitted automatically when time ran out
                  </Badge>
                )}
              </p>
            </div>
          </div>

          <p className="max-w-sm text-sm leading-relaxed text-ink-600 sm:ml-auto sm:text-right">
            The pass mark for this paper is <strong className="font-semibold text-ink-800">{passMark}%</strong>. You
            scored <strong className="font-semibold text-ink-800">{attempt.percentage}%</strong>, {marginSentence(attempt.percentage, passMark)}
            {attempt.submittedAt && <span className="block text-ink-500">Submitted {formatDateTime(attempt.submittedAt)}</span>}
          </p>
        </div>

        <div className="grid gap-3 border-t border-paper-200 bg-paper-50 px-5 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          <StatTile
            label="Objective marks"
            value={`${attempt.objectiveMarks ?? 0} / ${attempt.objectiveAvailable ?? 0}`}
            sublabel={
              attempt.objectiveAvailable
                ? percent((attempt.objectiveMarks || 0) / attempt.objectiveAvailable)
                : 'No objective section'
            }
            icon={<Icon name="quiz" size={13} />}
          />
          <StatTile
            label="Theory marks"
            value={`${attempt.theoryMarks ?? 0} / ${attempt.theoryAvailable ?? 0}`}
            sublabel={
              attempt.theoryAvailable
                ? percent((attempt.theoryMarks || 0) / attempt.theoryAvailable)
                : 'No theory section'
            }
            icon={<Icon name="pen" size={13} />}
          />
          <StatTile
            label="Questions"
            value={`${attempt.questionsCorrect ?? 0} correct`}
            sublabel={`${attempt.questionsAttempted ?? 0} attempted · ${attempt.questionsIncorrect ?? 0} incorrect`}
            icon={<Icon name="check" size={13} />}
            tone="brand"
          />
          <StatTile
            label="Time taken"
            value={formatDuration(attempt.timeTakenSeconds || 0)}
            sublabel={`of ${minutesLabel(attempt.durationMinutes)} allowed`}
            icon={<Icon name="clock" size={13} />}
          />
        </div>
      </Card>

      {/* ------------------------------------------------ topic performance --- */}

      <section className="mt-8">
        <h2 className="mb-3 font-serif text-lg font-semibold text-ink-900">How each topic went</h2>

        {!topics.length ? (
          <Card>
            <EmptyState
              icon="chart"
              title="No topic breakdown for this paper"
              message="The questions on this paper were not linked to syllabus topics, so we cannot break the result down by topic."
            />
          </Card>
        ) : (
          <>
            <Card className="p-5">
              <p className="mb-4 text-sm text-ink-500">Weakest first — this is the order to revise in.</p>
              <ul className="space-y-3.5">
                {topics.map((topic) => (
                  <li key={String(topic.topic) || topic.topicTitle}>
                    <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-ink-800">
                        {topic.topic ? (
                          <Link to={`/study/topic/${topic.topic}`} className="hover:text-brand-700 hover:underline">
                            {topic.topicTitle}
                          </Link>
                        ) : (
                          topic.topicTitle
                        )}
                        {topic.subjectName && <span className="ml-2 text-xs text-ink-400">{topic.subjectName}</span>}
                      </span>
                      <span className="tabular text-sm text-ink-600">
                        {topic.correct}/{topic.attempted} · {percent(topic.accuracy)}
                      </span>
                    </div>
                    <ProgressBar
                      value={(topic.accuracy || 0) * 100}
                      tone={topic.accuracy >= 0.8 ? 'success' : topic.accuracy >= 0.6 ? 'warning' : 'danger'}
                      size="sm"
                      label={`${topic.topicTitle} accuracy`}
                      className="[&>div:first-child]:sr-only"
                    />
                  </li>
                ))}
              </ul>
            </Card>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card className="p-5">
                <h3 className="mb-3 flex items-center gap-2 font-serif text-base font-semibold text-success-700">
                  <Icon name="check" size={16} />
                  Strong areas
                </h3>
                {strongTopics.length ? (
                  <ul className="space-y-2">
                    {strongTopics.map((topic) => (
                      <li key={String(topic.topic) || topic.topicTitle} className="flex items-baseline justify-between gap-3">
                        <span className="text-sm text-ink-700">{topic.topicTitle}</span>
                        <span className="tabular shrink-0 text-sm text-success-600">{percent(topic.accuracy)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm leading-relaxed text-ink-500">
                    No topic reached 80% on this paper yet. Work through the list above from the top and sit the paper
                    again.
                  </p>
                )}
              </Card>

              <Card className="p-5">
                <h3 className="mb-3 flex items-center gap-2 font-serif text-base font-semibold text-danger-600">
                  <Icon name="alert" size={16} />
                  Areas to revise
                </h3>
                {weakTopics.length ? (
                  <ul className="space-y-3">
                    {weakTopics.map((topic) => (
                      <li
                        key={String(topic.topic) || topic.topicTitle}
                        className="rounded-lg border border-paper-200 p-3"
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-sm font-medium text-ink-800">{topic.topicTitle}</span>
                          <span className="tabular shrink-0 text-sm text-danger-600">{percent(topic.accuracy)}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {topic.topic && (
                            <Button size="sm" variant="secondary" to={`/study/topic/${topic.topic}`} icon={<Icon name="book" size={14} />}>
                              Read the topic
                            </Button>
                          )}
                          {topic.topic && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => practise(topic)}
                              loading={practising === String(topic.topic)}
                              icon={<Icon name="quiz" size={14} />}
                            >
                              Practise this topic
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm leading-relaxed text-ink-500">
                    Nothing fell below 60% on this paper. Keep the weakest topics above under review all the same.
                  </p>
                )}
              </Card>
            </div>
          </>
        )}
      </section>

      {/* ----------------------------------------------------------- review --- */}

      <section className="mt-10">
        <h2 className="font-serif text-lg font-semibold text-ink-900">The whole paper, question by question</h2>
        <p className="mb-3 mt-1 max-w-reading text-sm leading-relaxed text-ink-600">
          Every question is here with the correct answer, the reason it is correct and where the syllabus says so. This
          is the part that earns you marks next time.
        </p>

        <Tabs
          tabs={FILTERS.map((f) => ({ ...f, count: counts[f.key] }))}
          active={filter}
          onChange={setFilter}
          className="mb-4"
        />

        {!visible.length ? (
          <Card>
            <EmptyState
              icon="check"
              title={
                filter === 'incorrect'
                  ? 'Nothing was marked wrong'
                  : filter === 'flagged'
                    ? 'You flagged nothing'
                    : filter === 'theory'
                      ? 'This paper had no theory questions'
                      : 'No questions to review'
              }
              message="Choose another filter to see the rest of the paper."
              action={
                <Button variant="secondary" onClick={() => setFilter('all')}>
                  Show every question
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="space-y-6">
            {sections.map((section) => {
              const rows = visible.filter((q) => q.sectionKey === section.key);
              if (!rows.length) return null;
              return (
                <div key={section.key}>
                  <h3 className="mb-3 border-b border-paper-300 pb-2 font-serif text-base font-semibold text-ink-800">
                    {section.label}
                    {section.answerCount != null && section.count != null && section.answerCount < section.count && (
                      <span className="ml-2 text-sm font-normal text-ink-500">
                        answer {section.answerCount} of {section.count}
                      </span>
                    )}
                  </h3>
                  <ol className="space-y-4">
                    {rows.map((row) => (
                      <li key={`${row.sectionKey}-${row.order}-${row.question.id}`}>
                        <ReviewedQuestion
                          row={row}
                          bookmarked={bookmarked[row.question.id]}
                          onBookmark={() => toggleBookmark(row.question.id)}
                        />
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="mt-10 flex flex-wrap justify-center gap-3 border-t border-paper-300 pt-6">
        <Button to="/mock-exam" variant="secondary" icon={<Icon name="exam" size={15} />}>
          Sit another paper
        </Button>
        <Button to="/mistakes" variant="ghost" icon={<Icon name="refresh" size={15} />}>
          Practise everything you got wrong
        </Button>
      </div>
    </div>
  );
}

/** States the margin plainly, in either direction. */
function marginSentence(score, passMark) {
  const gap = Math.abs((score ?? 0) - passMark);
  const points = `${gap} percentage ${gap === 1 ? 'point' : 'points'}`;
  if ((score ?? 0) === passMark) return 'which is exactly the pass mark.';
  return (score ?? 0) > passMark ? `which is ${points} above it.` : `which is ${points} below it.`;
}

/* --------------------------------------------------------- one question --- */

function ReviewedQuestion({ row, bookmarked, onBookmark }) {
  const { question, result, yourAnswer, theoryEvaluation, counted } = row;
  const isTheory = question.type === 'theory';
  const answered = Boolean(yourAnswer?.answered);
  const correct = Boolean(result?.isCorrect);
  const partial = !correct && (result?.score || 0) > 0;
  const surplus = counted === false;

  const verdictTone = !answered ? 'neutral' : correct ? 'success' : partial ? 'warning' : 'danger';
  const verdictLabel = !answered ? 'Not answered' : correct ? 'Correct' : partial ? 'Partly right' : 'Incorrect';
  const verdictIcon = !answered ? 'info' : correct ? 'check' : partial ? 'info' : 'close';

  return (
    <Card className={cx('overflow-hidden', surplus && 'opacity-95')}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-paper-200 bg-paper-50 px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="tabular text-sm font-semibold text-ink-800">Question {row.order}</span>
          <Badge tone={verdictTone} size="sm" icon={<Icon name={verdictIcon} size={11} />}>
            {verdictLabel}
          </Badge>
          <Badge tone="outline" size="sm">
            {QUESTION_TYPE_LABELS[question.type] || question.type}
          </Badge>
          <span className="tabular text-xs text-ink-500">
            {result?.marksAwarded ?? 0} of {result?.marksAvailable ?? question.marks ?? 0} marks
          </span>
          {yourAnswer?.flagged && (
            <Badge tone="gold" size="sm" icon={<Icon name="bookmark" size={11} />}>
              You flagged this
            </Badge>
          )}
        </div>

        <button
          type="button"
          onClick={onBookmark}
          aria-pressed={Boolean(bookmarked)}
          aria-label={bookmarked ? 'Remove this bookmark' : 'Bookmark this question'}
          className={cx(
            'rounded-lg p-1.5 transition-colors',
            bookmarked ? 'text-gold-600' : 'text-ink-400 hover:bg-paper-200 hover:text-ink-700',
          )}
        >
          <Icon name={bookmarked ? 'bookmark-check' : 'bookmark'} size={17} />
        </button>
      </div>

      {surplus && (
        <p className="flex items-start gap-2 border-b border-paper-200 bg-warning-50 px-5 py-3 text-sm leading-relaxed text-warning-600">
          <Icon name="info" size={15} className="mt-0.5 shrink-0" />
          This answer did not count towards your mark. The section asked for fewer answers than it offered questions, so
          only your best answers were marked — exactly as an examiner would treat a "choose three of five" section.
        </p>
      )}

      <div className="px-5 py-5">
        {question.context && (
          <p className="mb-4 whitespace-pre-line rounded-lg border-l-[3px] border-paper-400 bg-paper-50 px-4 py-3 font-serif text-sm leading-relaxed text-ink-600">
            {question.context}
          </p>
        )}

        <h4 className="mb-4 max-w-reading whitespace-pre-line font-serif text-base leading-relaxed text-ink-900">
          {question.prompt}
        </h4>

        {isTheory ? (
          <div className="space-y-4">
            <div>
              <h5 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">Your answer</h5>
              {answered ? (
                <p className="whitespace-pre-line rounded-lg border border-paper-300 bg-paper-50 px-4 py-3 font-serif text-sm leading-relaxed text-ink-700">
                  {yourAnswer.textAnswer}
                </p>
              ) : (
                <p className="rounded-lg border border-dashed border-paper-400 px-4 py-3 text-sm text-ink-500">
                  You left this question unanswered.
                </p>
              )}
              {yourAnswer?.viaVoice && (
                <Badge tone="brand" size="sm" className="mt-2" icon={<Icon name="mic" size={11} />}>
                  Includes dictated text
                </Badge>
              )}
            </div>

            {theoryEvaluation ? (
              <TheoryBreakdown evaluation={theoryEvaluation} review={question} />
            ) : (
              question.idealAnswer && (
                <div>
                  <h5 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
                    What a full-mark answer contains
                  </h5>
                  <p className="whitespace-pre-line font-serif text-sm leading-relaxed text-ink-700">
                    {question.idealAnswer}
                  </p>
                </div>
              )
            )}
          </div>
        ) : (
          <>
            <QuestionRenderer
              question={question}
              value={{
                selectedOptionKeys: yourAnswer?.selectedOptionKeys || [],
                textAnswer: yourAnswer?.textAnswer || '',
                matchAnswer: yourAnswer?.matchAnswer || {},
                viaVoice: Boolean(yourAnswer?.viaVoice),
              }}
              onChange={() => {}}
              revealed
              disabled
              correctKeys={question.correctOptionKeys || []}
            />

            {!answered && (
              <p className="mt-3 rounded-lg border border-dashed border-paper-400 px-4 py-2.5 text-sm text-ink-500">
                You left this question unanswered.
              </p>
            )}

            {question.type === 'fill_blank' && question.acceptedAnswers?.length > 0 && (
              <p className="mt-3 text-sm text-ink-700">
                Accepted answers: <strong className="font-semibold">{question.acceptedAnswers.join(', ')}</strong>
              </p>
            )}
          </>
        )}
      </div>

      <div className="space-y-4 border-t border-paper-200 bg-paper-50 px-5 py-4">
        {question.explanation && (
          <div>
            <h5 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
              <Icon name="info" size={13} />
              Why
            </h5>
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
          <SourceBadge
            sourceKind={question.sourceKind}
            source={question.source}
            answerConfidence={question.answerConfidence}
          />
          {question.topic?._id && (
            <Link
              to={`/study/topic/${question.topic._id}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:underline"
            >
              <Icon name="book" size={13} />
              Study {question.topic.title || 'this topic'}
            </Link>
          )}
          {yourAnswer?.timeSpentSeconds > 0 && (
            <span className="tabular text-xs text-ink-400">
              You spent {formatDuration(yourAnswer.timeSpentSeconds)} on this
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------- skeletons --- */

function ResultsSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6" aria-hidden="true">
      <Card className="overflow-hidden">
        <div className="flex items-center gap-5 px-6 py-6">
          <Skeleton className="h-28 w-28" rounded="rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-6 w-1/2" rounded="rounded" />
            <Skeleton className="mt-2 h-4 w-1/3" rounded="rounded" />
            <Skeleton className="mt-3 h-6 w-24" />
          </div>
        </div>
        <div className="grid gap-3 border-t border-paper-200 bg-paper-50 px-6 py-5 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" rounded="rounded-xl" />
          ))}
        </div>
      </Card>

      <div className="mt-8">
        <Skeleton className="h-5 w-40" rounded="rounded" />
        <Card className="mt-3 p-5">
          <SkeletonText lines={5} />
        </Card>
      </div>

      <div className="mt-8 space-y-4">
        {[0, 1].map((i) => (
          <Card key={i} className="p-5">
            <SkeletonText lines={4} />
          </Card>
        ))}
      </div>
    </div>
  );
}
