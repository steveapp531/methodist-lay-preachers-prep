import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { mockApi } from '@/services/api';
import { useAsync, useCountdown, useDocumentTitle, useUnsavedChangesWarning } from '@/hooks';
import { Badge, Button, Card, ErrorState, Icon, Modal, Skeleton, SkeletonText, Spinner, cx } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import QuestionRenderer from '@/components/quiz/QuestionRenderer';
import { QUESTION_TYPE_LABELS, plural } from '@/utils/format';

/**
 * A sitting.
 *
 * Three things govern this screen. The clock belongs to the server, so it is
 * only ever displayed here and never trusted here. Nothing about correctness is
 * shown while the paper is open. And no answer may be lost: everything typed or
 * chosen is batched and saved as the candidate works, and again the moment they
 * move between questions.
 */
export default function MockExamPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const { data, error, loading, reload } = useAsync(() => mockApi.attempt(attemptId), [attemptId]);
  const attempt = data?.attempt || null;
  const isOpen = attempt?.status === 'in_progress';

  useDocumentTitle(attempt?.title ? `${attempt.title} — in progress` : 'Examination');

  /* ------------------------------------------------------------- the paper --- */

  const sections = useMemo(() => attempt?.sections || [], [attempt]);
  const sectionOrder = useMemo(() => new Map(sections.map((s, i) => [s.key, i])), [sections]);
  const sectionByKey = useMemo(() => new Map(sections.map((s) => [s.key, s])), [sections]);

  const questions = useMemo(() => {
    if (!attempt?.questions) return [];
    return [...attempt.questions]
      .filter((row) => row.question)
      .sort((a, b) => {
        const bySection = (sectionOrder.get(a.sectionKey) ?? 99) - (sectionOrder.get(b.sectionKey) ?? 99);
        return bySection !== 0 ? bySection : (a.order || 0) - (b.order || 0);
      })
      .map((row) => ({ ...row, questionId: row.question.id }));
  }, [attempt, sectionOrder]);

  /* ----------------------------------------------------------- the answers --- */

  const [answers, setAnswers] = useState({});
  const answersRef = useRef(answers);
  answersRef.current = answers;

  // Time spent lives in a ref so it can be read synchronously when saving.
  const timeSpentRef = useRef({});
  const dirtyRef = useRef(new Set());
  const savingRef = useRef(false);
  const submittedRef = useRef(false);
  const activeSinceRef = useRef(Date.now());

  const [index, setIndex] = useState(0);
  const [saveState, setSaveState] = useState('idle'); // idle | pending | saving | saved | error
  const [navOpen, setNavOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  // Falling back to the first question keeps a stale index from ever crashing
  // the sitting in the render between one attempt loading and the next.
  const current = questions[index] || questions[0] || null;
  const currentIdRef = useRef(null);
  currentIdRef.current = current?.questionId || null;

  // Seed local state from the sitting as the server has it.
  useEffect(() => {
    if (!attempt?.questions) return;
    const seeded = {};
    const times = {};
    attempt.questions.forEach((row) => {
      if (!row.question) return;
      seeded[row.question.id] = {
        selectedOptionKeys: row.selectedOptionKeys || [],
        textAnswer: row.textAnswer || '',
        matchAnswer: row.matchAnswer ? { ...row.matchAnswer } : {},
        viaVoice: Boolean(row.viaVoice),
        flagged: Boolean(row.flagged),
      };
      times[row.question.id] = row.timeSpentSeconds || 0;
    });
    setAnswers(seeded);
    timeSpentRef.current = times;
    dirtyRef.current = new Set();
    activeSinceRef.current = Date.now();
    // Resuming a sitting drops you back at the first question still to answer.
    const firstUnanswered = questions.findIndex((row) => !hasContent(seeded[row.questionId]));
    setIndex(firstUnanswered === -1 ? 0 : firstUnanswered);
  }, [attempt, questions]);

  // A sitting that has already run out is marked on read; send them to it.
  const redirectedRef = useRef(false);
  useEffect(() => {
    if (!attempt || attempt.status === 'in_progress' || redirectedRef.current) return;
    redirectedRef.current = true;
    toast.warning(
      data?.autoSubmitted
        ? 'Time had run out, so this paper was submitted and marked as it stood.'
        : 'This examination has already been submitted. Here is the marked paper.',
      { duration: 9000 },
    );
    navigate(`/mock-exam/results/${attemptId}`, { replace: true });
  }, [attempt, data, attemptId, navigate, toast]);

  /* -------------------------------------------------------------- autosave --- */

  const buildUpdate = useCallback((questionId) => {
    const answer = answersRef.current[questionId] || {};
    return {
      questionId,
      selectedOptionKeys: answer.selectedOptionKeys || [],
      textAnswer: answer.textAnswer || '',
      matchAnswer: answer.matchAnswer || {},
      flagged: Boolean(answer.flagged),
      viaVoice: Boolean(answer.viaVoice),
      timeSpentSeconds: Math.max(0, Math.min(7200, Math.round(timeSpentRef.current[questionId] || 0))),
    };
  }, []);

  /** Banks the seconds spent on the question now on screen. */
  const commitTime = useCallback(() => {
    const questionId = currentIdRef.current;
    const elapsed = Math.round((Date.now() - activeSinceRef.current) / 1000);
    activeSinceRef.current = Date.now();
    if (!questionId || elapsed <= 0) return;
    timeSpentRef.current[questionId] = Math.min(7200, (timeSpentRef.current[questionId] || 0) + elapsed);
    dirtyRef.current.add(questionId);
  }, []);

  const flush = useCallback(async () => {
    if (submittedRef.current || savingRef.current || dirtyRef.current.size === 0) return;
    const ids = [...dirtyRef.current];
    dirtyRef.current.clear();
    savingRef.current = true;
    setSaveState('saving');
    try {
      await mockApi.save(attemptId, ids.map(buildUpdate));
      setSaveState(dirtyRef.current.size ? 'pending' : 'saved');
    } catch (err) {
      // Nothing is thrown away: the changes go back on the queue for next time.
      ids.forEach((id) => dirtyRef.current.add(id));
      setSaveState('error');
    } finally {
      savingRef.current = false;
    }
  }, [attemptId, buildUpdate]);

  const markDirty = useCallback((questionId) => {
    dirtyRef.current.add(questionId);
    setSaveState('pending');
  }, []);

  const setAnswer = useCallback(
    (questionId, patch) => {
      setAnswers((prev) => ({ ...prev, [questionId]: { ...(prev[questionId] || {}), ...patch } }));
      markDirty(questionId);
    },
    [markDirty],
  );

  // Every fifteen seconds, and on the way out.
  useEffect(() => {
    if (!isOpen) return undefined;
    const id = setInterval(() => {
      commitTime();
      flush();
    }, 15000);
    return () => clearInterval(id);
  }, [isOpen, commitTime, flush]);

  useEffect(
    () => () => {
      commitTime();
      flush();
    },
    [commitTime, flush],
  );

  // Stable handlers: the countdown re-renders this screen every second, and a
  // dialog whose onClose changed each time would steal focus back on each tick.
  const closeNav = useCallback(() => setNavOpen(false), []);
  const closeSubmit = useCallback(() => {
    if (!submittedRef.current) setSubmitOpen(false);
  }, []);

  const goTo = useCallback(
    (nextIndex) => {
      if (nextIndex < 0 || nextIndex >= questions.length || nextIndex === index) return;
      commitTime();
      flush();
      setIndex(nextIndex);
      setNavOpen(false);
      window.scrollTo({ top: 0, behavior: 'auto' });
    },
    [questions.length, index, commitTime, flush],
  );

  /* ----------------------------------------------------------- submission --- */

  const submit = useCallback(
    async (auto = false) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      commitTime();
      const pending = [...dirtyRef.current].map(buildUpdate);
      dirtyRef.current.clear();
      try {
        await mockApi.submit(attemptId, pending.length ? pending : undefined);
        if (auto) toast.warning('Time is up. Your paper has been submitted and marked as it stood.', { duration: 9000 });
        else toast.success('Your paper has been submitted.');
        navigate(`/mock-exam/results/${attemptId}`, { replace: true });
      } catch (err) {
        if (err?.status === 409) {
          // Already submitted server-side — the result is what matters.
          navigate(`/mock-exam/results/${attemptId}`, { replace: true });
          return;
        }
        submittedRef.current = false;
        setSubmitting(false);
        setSubmitOpen(false);
        toast.error(err?.message || 'The paper could not be submitted. Check your connection and try again.');
      }
    },
    [attemptId, buildUpdate, commitTime, navigate, toast],
  );

  /* ---------------------------------------------------------------- clock --- */

  const countdown = useCountdown(isOpen ? attempt?.expiresAt : null, {
    onExpire: () => submit(true),
  });

  const warnedFive = useRef(false);
  const warnedOne = useRef(false);
  useEffect(() => {
    if (!isOpen || countdown.remaining <= 0) return;
    if (countdown.remaining <= 60 && !warnedOne.current) {
      warnedOne.current = true;
      warnedFive.current = true;
      setAnnouncement('One minute remaining. Finish your current answer now.');
      toast.error('One minute remaining.', { title: 'Time', duration: 12000 });
    } else if (countdown.remaining <= 300 && !warnedFive.current) {
      warnedFive.current = true;
      setAnnouncement('Five minutes remaining.');
      toast.warning('Five minutes remaining.', { title: 'Time', duration: 12000 });
    }
  }, [countdown.remaining, isOpen, toast]);

  useUnsavedChangesWarning(isOpen && !submittedRef.current);

  /* ---------------------------------------------------------------- states --- */

  if (loading) return <SittingSkeleton />;

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Card>
          <ErrorState error={error} onRetry={reload} />
          <div className="border-t border-paper-200 px-5 py-3.5 text-center">
            <Button variant="ghost" to="/mock-exam">
              Back to mock examinations
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!attempt || !isOpen) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 text-ink-500">
        <Spinner size={22} className="text-brand-600" />
        <p className="text-sm">Taking you to your result…</p>
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Card>
          <div className="px-6 py-12 text-center">
            <h1 className="font-serif text-lg font-semibold text-ink-800">This paper has no questions</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-500">
              The sitting opened but no questions came with it. Please tell an administrator, and choose another paper
              in the meantime.
            </p>
            <Button className="mt-5" to="/mock-exam" variant="secondary">
              Back to mock examinations
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  /* --------------------------------------------------------------- render --- */

  const summary = summarise(questions, answers, sections);
  const section = sectionByKey.get(current.sectionKey);
  const previous = questions[index - 1];
  const firstOfSection = !previous || previous.sectionKey !== current.sectionKey;
  const positionInSection = questions.filter((q) => q.sectionKey === current.sectionKey).indexOf(current) + 1;
  const sectionTotal = questions.filter((q) => q.sectionKey === current.sectionKey).length;
  const answer = answers[current.questionId] || {};

  return (
    <div className="min-h-screen bg-paper-200 pb-10">
      <ExamHeader
        title={attempt.title}
        sectionLabel={section?.label}
        countdown={countdown}
        saveState={saveState}
        onOpenNav={() => setNavOpen(true)}
        onSubmit={() => {
          commitTime();
          flush();
          setSubmitOpen(true);
        }}
        answered={summary.answered}
        total={questions.length}
      />

      {/* Milestones are announced once each, not read out every second. */}
      <p className="sr-only" role="status" aria-live="assertive">
        {announcement}
      </p>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        {/* ExamLayout already supplies the page's <main>. */}
        <div>
          {firstOfSection && section && (
            <section
              className="mb-5 rounded-xl border border-brand-200 bg-brand-50 px-5 py-4"
              aria-label={`Instructions for ${section.label}`}
            >
              <h2 className="font-serif text-base font-semibold text-brand-800">{section.label}</h2>
              <p className="mt-1 text-sm text-brand-800/80">
                {section.answerCount != null && section.answerCount < section.count
                  ? `Answer ${section.answerCount} of the ${section.count} questions in this section. ${section.marksEach} marks each.`
                  : `${plural(section.count, 'question')} · ${section.marksEach} mark${section.marksEach === 1 ? '' : 's'} each.`}
              </p>
              {section.instructions && (
                <p className="mt-2 whitespace-pre-line font-serif text-sm leading-relaxed text-ink-700">
                  {section.instructions}
                </p>
              )}
            </section>
          )}

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-paper-200 px-5 py-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="tabular text-sm font-semibold text-ink-800">
                  Question {questions.indexOf(current) + 1} of {questions.length}
                </span>
                {section && (
                  <span className="tabular text-xs text-ink-500">
                    {section.label} · {positionInSection} of {sectionTotal}
                  </span>
                )}
                <Badge tone="outline" size="sm">
                  {QUESTION_TYPE_LABELS[current.question.type] || current.question.type}
                </Badge>
                <Badge tone="neutral" size="sm">
                  {plural(current.question.marks ?? section?.marksEach ?? 1, 'mark')}
                </Badge>
              </div>

              <button
                type="button"
                onClick={() => setAnswer(current.questionId, { flagged: !answer.flagged })}
                aria-pressed={Boolean(answer.flagged)}
                className={cx(
                  'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                  answer.flagged
                    ? 'border-gold-500 bg-gold-50 text-gold-700'
                    : 'border-paper-300 bg-white text-ink-600 hover:bg-paper-100',
                )}
              >
                <Icon name={answer.flagged ? 'bookmark-check' : 'bookmark'} size={15} />
                {answer.flagged ? 'Flagged for review' : 'Flag for review'}
              </button>
            </div>

            <div className="px-5 py-5">
              {current.question.context && (
                <p className="mb-4 whitespace-pre-line rounded-lg border-l-[3px] border-paper-400 bg-paper-50 px-4 py-3 font-serif text-sm leading-relaxed text-ink-600">
                  {current.question.context}
                </p>
              )}

              <h2 className="mb-5 max-w-reading whitespace-pre-line font-serif text-lg leading-relaxed text-ink-900">
                {current.question.prompt}
              </h2>

              <QuestionRenderer
                key={current.questionId}
                question={current.question}
                value={{
                  selectedOptionKeys: answer.selectedOptionKeys || [],
                  textAnswer: answer.textAnswer || '',
                  matchAnswer: answer.matchAnswer || {},
                  viaVoice: Boolean(answer.viaVoice),
                }}
                onChange={(next) => setAnswer(current.questionId, next)}
                revealed={false}
              />
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-paper-200 bg-paper-50 px-5 py-3.5">
              <Button
                variant="secondary"
                onClick={() => goTo(index - 1)}
                disabled={index === 0}
                icon={<Icon name="chevronLeft" size={15} strokeStyle />}
              >
                Previous
              </Button>

              {index === questions.length - 1 ? (
                <Button
                  variant="gold"
                  onClick={() => {
                    commitTime();
                    flush();
                    setSubmitOpen(true);
                  }}
                  icon={<Icon name="check" size={15} />}
                >
                  Review and submit
                </Button>
              ) : (
                <Button onClick={() => goTo(index + 1)} iconRight={<Icon name="chevronRight" size={15} strokeStyle />}>
                  Next
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* The navigator is always present on a wide screen. */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <Card className="p-4">
              <QuestionNavigator
                questions={questions}
                answers={answers}
                sections={sections}
                currentIndex={index}
                onSelect={goTo}
              />
            </Card>
          </div>
        </aside>
      </div>

      {/* On a phone it slides over, opened from the header. */}
      {navOpen && (
        <NavigatorPanel onClose={closeNav}>
          <QuestionNavigator
            questions={questions}
            answers={answers}
            sections={sections}
            currentIndex={index}
            onSelect={goTo}
          />
        </NavigatorPanel>
      )}

      <SubmitConfirmation
        open={submitOpen}
        summary={summary}
        total={questions.length}
        submitting={submitting}
        onCancel={closeSubmit}
        onConfirm={() => submit(false)}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- header --- */

function ExamHeader({ title, sectionLabel, countdown, saveState, onOpenNav, onSubmit, answered, total }) {
  const tone = countdown.isFinal
    ? 'border-danger-500 bg-danger-50 text-danger-600'
    : countdown.isCritical
      ? 'border-warning-500 bg-warning-50 text-warning-600'
      : 'border-paper-300 bg-paper-50 text-ink-800';

  return (
    <header className="sticky top-0 z-30 border-b border-paper-300 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-serif text-base font-semibold text-ink-900 sm:text-lg">{title}</h1>
          <p className="truncate text-xs text-ink-500">
            {sectionLabel ? `${sectionLabel} · ` : ''}
            <span className="tabular">
              {answered} of {total} answered
            </span>
          </p>
        </div>

        <div
          className={cx(
            'flex items-center gap-2 rounded-lg border px-3 py-1.5',
            tone,
            countdown.isFinal && 'animate-gentle-pulse',
          )}
        >
          <Icon name="clock" size={16} />
          <span className="sr-only">Time remaining</span>
          <span className="tabular font-mono text-lg font-semibold leading-none sm:text-xl">{countdown.formatted}</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <SaveIndicator state={saveState} />
          <Button size="sm" variant="secondary" className="lg:hidden" onClick={onOpenNav} icon={<Icon name="menu" size={15} />}>
            Questions
          </Button>
          <Button size="sm" variant="gold" onClick={onSubmit}>
            Submit examination
          </Button>
        </div>
      </div>
    </header>
  );
}

function SaveIndicator({ state }) {
  const map = {
    idle: null,
    pending: { icon: 'clock', text: 'Unsaved', className: 'text-ink-400' },
    saving: { icon: null, text: 'Saving…', className: 'text-ink-400' },
    saved: { icon: 'check', text: 'Saved', className: 'text-success-600' },
    error: { icon: 'alert', text: 'Not saved — retrying', className: 'text-warning-600' },
  };
  const entry = map[state];
  if (!entry) return null;

  return (
    <span className={cx('inline-flex items-center gap-1 text-xs', entry.className)} role="status" aria-live="polite">
      {entry.icon ? <Icon name={entry.icon} size={13} /> : <Spinner size={12} />}
      {entry.text}
    </span>
  );
}

/* ------------------------------------------------------------- navigator --- */

function QuestionNavigator({ questions, answers, sections, currentIndex, onSelect }) {
  const grouped = sections.length
    ? sections.map((section) => ({
        section,
        items: questions.map((q, i) => ({ q, i })).filter(({ q }) => q.sectionKey === section.key),
      }))
    : [{ section: null, items: questions.map((q, i) => ({ q, i })) }];

  return (
    <nav aria-label="Question navigator">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">Questions</h2>

      <div className="space-y-4">
        {grouped.map(({ section, items }) =>
          items.length === 0 ? null : (
            <div key={section?.key || 'all'}>
              {section && <p className="mb-1.5 text-xs font-medium text-ink-600">{section.label}</p>}
              <ul className="flex flex-wrap gap-1.5">
                {items.map(({ q, i }) => {
                  const answer = answers[q.questionId] || {};
                  const answered = hasContent(answer);
                  const flagged = Boolean(answer.flagged);
                  const isCurrent = i === currentIndex;

                  return (
                    <li key={q.questionId}>
                      <button
                        type="button"
                        onClick={() => onSelect(i)}
                        aria-current={isCurrent ? 'true' : undefined}
                        aria-label={`Question ${i + 1}: ${answered ? 'answered' : 'not answered'}${flagged ? ', flagged for review' : ''}`}
                        className={cx(
                          'relative flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-semibold tabular transition-colors',
                          isCurrent && 'ring-2 ring-brand-600 ring-offset-1',
                          answered
                            ? 'border-success-500 bg-success-100 text-success-700'
                            : 'border-paper-300 bg-white text-ink-500 hover:bg-paper-100',
                        )}
                      >
                        {i + 1}
                        {/* State is carried by an icon as well as by colour. */}
                        {answered && (
                          <Icon
                            name="check"
                            size={10}
                            className="absolute -bottom-0.5 -right-0.5 rounded-full bg-success-500 p-px text-white"
                          />
                        )}
                        {flagged && (
                          <Icon
                            name="bookmark"
                            size={10}
                            className="absolute -right-0.5 -top-0.5 rounded-full bg-gold-500 p-px text-white"
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ),
        )}
      </div>

      <ul className="mt-4 space-y-1.5 border-t border-paper-200 pt-3 text-xs text-ink-500">
        <li className="flex items-center gap-2">
          <span className="flex h-4 w-4 items-center justify-center rounded bg-success-500 text-white">
            <Icon name="check" size={10} />
          </span>
          Answered
        </li>
        <li className="flex items-center gap-2">
          <span className="h-4 w-4 rounded border border-paper-300 bg-white" />
          Not yet answered
        </li>
        <li className="flex items-center gap-2">
          <span className="flex h-4 w-4 items-center justify-center rounded bg-gold-500 text-white">
            <Icon name="bookmark" size={10} />
          </span>
          Flagged for review
        </li>
      </ul>
    </nav>
  );
}

function NavigatorPanel({ children, onClose }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    panelRef.current?.querySelector('button')?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Question navigator"
        className="absolute inset-y-0 right-0 flex w-[86%] max-w-xs flex-col bg-white shadow-lift"
      >
        <div className="flex items-center justify-between border-b border-paper-200 px-4 py-3">
          <h2 className="font-serif text-base font-semibold text-ink-900">Questions</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the question navigator"
            className="rounded-lg p-1.5 text-ink-400 hover:bg-paper-100 hover:text-ink-700"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- submission --- */

function SubmitConfirmation({ open, summary, total, submitting, onCancel, onConfirm }) {
  const shortSections = summary.sections.filter((s) => s.required != null && s.written < s.required);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Submit your examination?"
      description="Once submitted the paper is marked and cannot be reopened."
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            Keep working
          </Button>
          <Button variant="gold" onClick={onConfirm} loading={submitting}>
            Submit examination
          </Button>
        </>
      }
    >
      <dl className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-paper-300 bg-white p-3 text-center">
          <dt className="text-xs uppercase tracking-wide text-ink-400">Answered</dt>
          <dd className="tabular mt-1 font-serif text-xl font-semibold text-success-600">{summary.answered}</dd>
        </div>
        <div className="rounded-lg border border-paper-300 bg-white p-3 text-center">
          <dt className="text-xs uppercase tracking-wide text-ink-400">Unanswered</dt>
          <dd
            className={cx(
              'tabular mt-1 font-serif text-xl font-semibold',
              summary.unanswered > 0 ? 'text-warning-600' : 'text-ink-800',
            )}
          >
            {summary.unanswered}
          </dd>
        </div>
        <div className="rounded-lg border border-paper-300 bg-white p-3 text-center">
          <dt className="text-xs uppercase tracking-wide text-ink-400">Flagged</dt>
          <dd className="tabular mt-1 font-serif text-xl font-semibold text-gold-700">{summary.flagged}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm text-ink-600">
        {summary.answered} of {total} questions have an answer.
      </p>

      {summary.sections.some((s) => s.required != null) && (
        <div className="mt-4 space-y-2">
          {summary.sections
            .filter((s) => s.required != null)
            .map((s) => (
              <div
                key={s.key}
                className={cx(
                  'rounded-lg border px-3.5 py-3 text-sm',
                  s.written < s.required ? 'border-danger-500 bg-danger-50' : 'border-success-500 bg-success-50',
                )}
              >
                <p className="flex items-start gap-2 font-medium text-ink-800">
                  <Icon
                    name={s.written < s.required ? 'alert' : 'check'}
                    size={15}
                    className={cx('mt-0.5 shrink-0', s.written < s.required ? 'text-danger-600' : 'text-success-600')}
                  />
                  {s.label}
                </p>
                <p className="mt-1 pl-[23px] leading-relaxed text-ink-700">
                  {s.written < s.required
                    ? `You have written ${s.written} of the ${s.required} answers this section requires. Any answer you do not write scores nothing.`
                    : `You have written ${s.written} answers; the best ${s.required} will be marked.`}
                </p>
              </div>
            ))}
        </div>
      )}

      {summary.unanswered > 0 && !shortSections.length && (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-warning-50 p-3 text-sm leading-relaxed text-warning-600">
          <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
          {plural(summary.unanswered, 'question')} still {summary.unanswered === 1 ? 'has' : 'have'} no answer. An
          unanswered question scores nothing, and there is no penalty for a guess.
        </p>
      )}
    </Modal>
  );
}

/* ----------------------------------------------------------------- utils --- */

function hasContent(answer = {}) {
  return Boolean(
    answer.selectedOptionKeys?.length ||
      String(answer.textAnswer || '').trim() ||
      Object.keys(answer.matchAnswer || {}).filter((k) => answer.matchAnswer[k]).length,
  );
}

function summarise(questions, answers, sections) {
  let answered = 0;
  let flagged = 0;
  questions.forEach((q) => {
    const answer = answers[q.questionId] || {};
    if (hasContent(answer)) answered += 1;
    if (answer.flagged) flagged += 1;
  });

  const sectionRows = sections.map((section) => {
    const inSection = questions.filter((q) => q.sectionKey === section.key);
    const written = inSection.filter((q) => hasContent(answers[q.questionId] || {})).length;
    return {
      key: section.key,
      label: section.label,
      count: section.count,
      written,
      required: section.answerCount != null && section.answerCount < section.count ? section.answerCount : null,
    };
  });

  return { answered, unanswered: questions.length - answered, flagged, sections: sectionRows };
}

/* ------------------------------------------------------------- skeletons --- */

function SittingSkeleton() {
  return (
    <div className="min-h-screen bg-paper-200" aria-hidden="true">
      <div className="border-b border-paper-300 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <div className="flex-1">
            <Skeleton className="h-5 w-1/3" rounded="rounded" />
            <Skeleton className="mt-2 h-3 w-1/5" rounded="rounded" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="card overflow-hidden">
          <div className="border-b border-paper-200 px-5 py-3.5">
            <Skeleton className="h-4 w-40" rounded="rounded" />
          </div>
          <div className="px-5 py-5">
            <SkeletonText lines={3} />
            <div className="mt-5 space-y-2.5">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14" rounded="rounded-xl" />
              ))}
            </div>
          </div>
        </div>
        <div className="hidden lg:block">
          <Skeleton className="h-64" rounded="rounded-xl" />
        </div>
      </div>
    </div>
  );
}
