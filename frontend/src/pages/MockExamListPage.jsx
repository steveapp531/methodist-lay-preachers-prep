import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { mockApi } from '@/services/api';
import { useAsync, useAction, useDocumentTitle } from '@/hooks';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  Modal,
  Skeleton,
  SkeletonText,
  SourceBadge,
  StatTile,
  cx,
} from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { formatDateTime, minutesLabel, plural } from '@/utils/format';

/**
 * Choosing a paper to sit.
 *
 * A mock examination is a commitment — the clock runs on the server and does
 * not stop — so the rules are restated in full before the paper opens, and a
 * sitting already under way is offered back rather than silently replaced.
 */
export default function MockExamListPage() {
  useDocumentTitle('Mock examinations');

  const navigate = useNavigate();
  const toast = useToast();
  const [confirming, setConfirming] = useState(null);

  const papers = useAsync(() => mockApi.list(), []);
  const history = useAsync(() => mockApi.history({ limit: 20 }), []);

  const start = useAction(async (mockExamId) => mockApi.start(mockExamId));

  const beginSitting = async () => {
    if (!confirming) return;
    try {
      const data = await start.run(confirming._id);
      const attemptId = data?.attempt?.id;
      if (!attemptId) throw new Error('The examination could not be opened.');
      if (data.resumed) toast.info('You already had this paper open, so we have returned you to it.');
      setConfirming(null);
      navigate(`/mock-exam/sitting/${attemptId}`);
    } catch (error) {
      toast.error(error?.message || 'The examination could not be started. Please try again.');
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-ink-900 sm:text-3xl">Mock examinations</h1>
        <p className="mt-2 max-w-reading text-sm leading-relaxed text-ink-600">
          A full paper sat under examination conditions. The timer runs on our server from the moment you begin, so
          treat a sitting as you would the real thing: set aside the time, work without notes, and finish in one go.
        </p>
      </header>

      {papers.loading && <PaperListSkeleton />}

      {papers.error && !papers.loading && <ErrorState error={papers.error} onRetry={papers.reload} />}

      {!papers.loading && !papers.error && !papers.data?.mockExams?.length && (
        <Card>
          <EmptyState
            icon="exam"
            title="No mock examinations yet"
            message="No papers have been published for your examination stage. Practise with a quiz in the meantime — it draws on the same syllabus."
            action={
              <Button to="/quiz" icon={<Icon name="quiz" size={16} />}>
                Set up a practice quiz
              </Button>
            }
          />
        </Card>
      )}

      {!papers.loading && !papers.error && papers.data?.mockExams?.length > 0 && (
        <ul className="space-y-5">
          {papers.data.mockExams.map((paper) => (
            <li key={paper._id}>
              <PaperCard paper={paper} onStart={() => setConfirming(paper)} starting={start.pending} />
            </li>
          ))}
        </ul>
      )}

      <PastResults state={history} />

      <StartConfirmation
        paper={confirming}
        open={Boolean(confirming)}
        pending={start.pending}
        onCancel={() => setConfirming(null)}
        onConfirm={beginSitting}
      />
    </div>
  );
}

/* --------------------------------------------------------------- one paper --- */

function PaperCard({ paper, onStart, starting }) {
  const history = paper.history || {};
  const resumeId = history.inProgressAttemptId;

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-paper-200 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-serif text-lg font-semibold text-ink-900">{paper.title}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-500">
              {paper.subject?.name && <span>{paper.subject.name}</span>}
              {paper.subject?.name && <span aria-hidden="true">·</span>}
              <span>{paper.code}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge sourceKind={paper.sourceKind} source={paper.source} />
            {resumeId && (
              <Badge tone="warning" icon={<Icon name="clock" size={12} />}>
                Sitting in progress
              </Badge>
            )}
          </div>
        </div>

        {paper.description && (
          <p className="mt-3 max-w-reading text-sm leading-relaxed text-ink-600">{paper.description}</p>
        )}
      </div>

      <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Duration" value={minutesLabel(paper.durationMinutes)} icon={<Icon name="clock" size={13} />} />
        <StatTile label="Total marks" value={paper.totalMarks || '—'} icon={<Icon name="award" size={13} />} />
        <StatTile
          label="Pass mark"
          value={`${paper.passMark ?? 50}%`}
          icon={<Icon name="target" size={13} />}
          tone="brand"
        />
        <StatTile
          label="Questions"
          value={paper.totalQuestions ?? '—'}
          sublabel={paper.kind === 'dynamic' ? 'Freshly drawn each sitting' : 'A fixed paper'}
          icon={<Icon name="stack" size={13} />}
        />
      </div>

      <div className="border-t border-paper-200 px-5 py-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">How the paper is structured</h3>
        <ul className="space-y-1.5">
          {(paper.sections || []).map((section) => (
            <li key={section.key} className="flex items-start gap-2 text-sm leading-relaxed text-ink-700">
              <Icon name="chevronRight" size={14} className="mt-1 shrink-0 text-ink-300" strokeStyle />
              <span>
                <span className="font-medium text-ink-800">{section.label}</span>
                <span className="text-ink-600"> — {describeSection(section)}</span>
                {section.instructions && <span className="block text-xs text-ink-500">{section.instructions}</span>}
              </span>
            </li>
          ))}
          {!paper.sections?.length && <li className="text-sm text-ink-500">Structure not published for this paper.</li>}
        </ul>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-paper-200 bg-paper-50 px-5 py-4">
        <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-400">Attempts</dt>
            <dd className="tabular font-medium text-ink-800">{history.attempts ?? 0}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-400">Best score</dt>
            <dd className="tabular font-medium text-ink-800">
              {history.bestScore != null ? `${history.bestScore}%` : 'Not sat yet'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-400">Last score</dt>
            <dd className="tabular font-medium text-ink-800">
              {history.lastScore != null ? `${history.lastScore}%` : '—'}
            </dd>
          </div>
        </dl>

        {resumeId ? (
          <Button to={`/mock-exam/sitting/${resumeId}`} icon={<Icon name="play" size={15} />}>
            Resume sitting
          </Button>
        ) : (
          <Button onClick={onStart} disabled={starting} icon={<Icon name="exam" size={15} />}>
            Start examination
          </Button>
        )}
      </div>
    </Card>
  );
}

/** "answer 3 of 5 theory questions, 25 marks each" */
export function describeSection(section) {
  const theory = section.questionTypes?.includes('theory');
  const noun = theory ? 'theory question' : 'objective question';
  const choice = section.answerCount != null && section.answerCount < section.count;
  const head = choice
    ? `answer ${section.answerCount} of ${section.count} ${noun}s`
    : `${section.count} ${noun}${section.count === 1 ? '' : 's'}`;
  const marks = `${section.marksEach ?? 1} mark${(section.marksEach ?? 1) === 1 ? '' : 's'} each`;
  return `${head}, ${marks}`;
}

/* ------------------------------------------------------------ past results --- */

function PastResults({ state }) {
  const attempts = state.data?.attempts || [];

  return (
    <section className="mt-10">
      <h2 className="mb-3 font-serif text-lg font-semibold text-ink-900">Past results</h2>

      {state.loading && (
        <Card className="divide-y divide-paper-200">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-2/5" rounded="rounded" />
                <Skeleton className="mt-2 h-3 w-1/4" rounded="rounded" />
              </div>
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </Card>
      )}

      {state.error && !state.loading && <ErrorState error={state.error} onRetry={state.reload} />}

      {!state.loading && !state.error && !attempts.length && (
        <Card>
          <EmptyState
            icon="chart"
            title="You have not sat a paper yet"
            message="Once you complete a mock examination, every sitting appears here with its full marked review."
          />
        </Card>
      )}

      {!state.loading && !state.error && attempts.length > 0 && (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-paper-200">
            {attempts.map((attempt) => (
              <li key={attempt._id}>
                <AttemptRow attempt={attempt} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}

function AttemptRow({ attempt }) {
  const marked = attempt.status === 'marked';
  const scoreClass = attempt.percentage >= 50 ? 'text-success-600' : 'text-danger-600';

  const body = (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink-800">{attempt.title}</p>
        <p className="mt-0.5 text-xs text-ink-500">
          {marked
            ? `Submitted ${formatDateTime(attempt.submittedAt)}`
            : attempt.status === 'in_progress'
              ? 'Still open — the clock is running'
              : 'Not marked'}
        </p>
      </div>

      {marked ? (
        <div className="flex items-center gap-3">
          <span className="text-right">
            <span className={cx('tabular block font-serif text-lg font-semibold', scoreClass)}>
              {attempt.percentage}%
            </span>
            <span className="tabular block text-xs text-ink-500">
              {attempt.totalMarks} / {attempt.totalAvailable} marks
            </span>
          </span>
          <Icon name="chevronRight" size={16} className="text-ink-300" strokeStyle />
        </div>
      ) : (
        <Badge tone="warning" icon={<Icon name="clock" size={12} />}>
          In progress
        </Badge>
      )}
    </>
  );

  if (marked) {
    return (
      <Link
        to={`/mock-exam/results/${attempt._id}`}
        className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-paper-50"
      >
        {body}
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      {body}
      {attempt.status === 'in_progress' && (
        <Button size="sm" to={`/mock-exam/sitting/${attempt._id}`}>
          Resume
        </Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ confirmation --- */

function StartConfirmation({ paper, open, pending, onCancel, onConfirm }) {
  if (!paper) return null;

  const rules = [
    {
      icon: 'clock',
      text: `The timer starts the moment you confirm, and you have ${minutesLabel(paper.durationMinutes)}.`,
    },
    {
      icon: 'alert',
      text: 'The clock runs on our server. Closing the tab, losing your connection or stepping away does not pause it.',
    },
    { icon: 'exam', text: 'When the time runs out the paper submits itself and is marked as it stands.' },
    { icon: 'check', text: 'Your answers are saved as you go, so you can return to a sitting you had to leave.' },
  ];

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={`Begin ${paper.title}?`}
      description="Please read these conditions before you start."
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            Not yet
          </Button>
          <Button onClick={onConfirm} loading={pending}>
            Start the examination
          </Button>
        </>
      }
    >
      <ul className="space-y-3">
        {rules.map((rule) => (
          <li key={rule.text} className="flex items-start gap-2.5">
            <Icon name={rule.icon} size={16} className="mt-0.5 shrink-0 text-brand-600" />
            <span className="text-sm leading-relaxed text-ink-700">{rule.text}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-lg border border-paper-300 bg-paper-50 p-3.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">The paper</h3>
        <ul className="mt-2 space-y-1">
          {(paper.sections || []).map((section) => (
            <li key={section.key} className="text-sm leading-relaxed text-ink-700">
              <span className="font-medium">{section.label}</span> — {describeSection(section)}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-ink-600">
          {plural(paper.totalQuestions ?? 0, 'question')} · {paper.totalMarks || '—'} marks · pass mark{' '}
          {paper.passMark ?? 50}%
        </p>
      </div>

      {paper.instructions && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Examiner's instructions</h3>
          <p className="mt-1.5 whitespace-pre-line font-serif text-sm leading-relaxed text-ink-700">
            {paper.instructions}
          </p>
        </div>
      )}
    </Modal>
  );
}

/* --------------------------------------------------------------- skeletons --- */

function PaperListSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      {[0, 1].map((i) => (
        <Card key={i} className="overflow-hidden">
          <div className="border-b border-paper-200 px-5 py-4">
            <Skeleton className="h-5 w-2/5" rounded="rounded" />
            <Skeleton className="mt-2 h-3 w-1/4" rounded="rounded" />
            <SkeletonText lines={2} className="mt-3" />
          </div>
          <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((j) => (
              <Skeleton key={j} className="h-20" rounded="rounded-xl" />
            ))}
          </div>
          <div className="border-t border-paper-200 px-5 py-4">
            <SkeletonText lines={2} />
          </div>
        </Card>
      ))}
    </div>
  );
}
