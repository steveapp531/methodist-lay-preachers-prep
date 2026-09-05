import { useCallback, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { contentApi, quizApi } from '@/services/api';
import { useAction, useAsync, useDocumentTitle, useLocalStorage } from '@/hooks';
import { useToast } from '@/context/ToastContext';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  ProgressBar,
  Skeleton,
  SkeletonText,
  cx,
} from '@/components/ui';
import {
  PROGRESS_STATUS_LABELS,
  PROGRESS_STATUS_TONES,
  masteryTone,
  minutesLabel,
  plural,
} from '@/utils/format';

const STATUS_ICONS = {
  not_started: null,
  in_progress: 'pen',
  completed: 'check',
  needs_revision: 'alert',
};

/** "References" and "Appendix" chapters are bibliography, not syllabus reading. */
const APPARATUS = /^(references?|appendix|appendices|bibliography)\b/i;

export default function SubjectPage() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const { data, error, loading, reload } = useAsync(() => contentApi.subject(subjectId), [subjectId]);

  const subject = data?.subject;
  const chapters = useMemo(() => data?.chapters || [], [data]);

  useDocumentTitle(subject ? subject.name : 'Study');

  const totals = useMemo(() => summarise(chapters), [chapters]);

  const startQuiz = useAction(async () => {
    const result = await quizApi.create({ mode: 'practice', subject: subjectId, size: 15 });
    if (result?.quiz?.id) navigate(`/quiz/${result.quiz.id}`);
    else throw new Error('The quiz could not be started.');
  });

  const onStartQuiz = async () => {
    try {
      await startQuiz.run();
    } catch (err) {
      toast.error(err?.message || 'We could not start a quiz on this paper just now.');
    }
  };

  if (loading) return <SubjectSkeleton />;
  if (error) return <ErrorState error={error} onRetry={reload} className="card" />;
  if (!subject) return <ErrorState error={{ message: 'That paper was not found.', isRetryable: false }} />;

  return (
    <div className="space-y-6">
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
          <li className="font-medium text-ink-700" aria-current="page">
            {subject.shortName || subject.name}
          </li>
        </ol>
      </nav>

      <SubjectHeader subject={subject} totals={totals} onStartQuiz={onStartQuiz} starting={startQuiz.pending} />

      {chapters.length === 0 ? (
        <Card>
          <EmptyState
            icon="book"
            title="This paper has no chapters yet"
            message="The syllabus text for this paper has not been published. Try another paper in the meantime."
            action={
              <Button to="/study" variant="secondary" icon={<Icon name="chevronLeft" size={15} strokeStyle />}>
                Back to all papers
              </Button>
            }
          />
        </Card>
      ) : (
        <ChapterList subjectId={subjectId} chapters={chapters} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ parts --- */

function SubjectHeader({ subject, totals, onStartQuiz, starting }) {
  const percent = totals.totalTopics ? Math.round((totals.completed / totals.totalTopics) * 100) : 0;
  const stats = subject.stats || {};

  return (
    <Card className="overflow-hidden">
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-reading">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand" size="sm">
                {subject.code}
              </Badge>
              {subject.paper && <span className="text-sm text-ink-500">{subject.paper}</span>}
            </div>
            <h1 className="mt-2 font-serif text-2xl font-semibold text-ink-900 sm:text-3xl">{subject.name}</h1>
            {subject.description && (
              <p className="mt-2.5 text-reading-base leading-relaxed text-ink-600">{subject.description}</p>
            )}
          </div>

          <Button
            onClick={onStartQuiz}
            loading={starting}
            icon={<Icon name="quiz" size={16} />}
            className="shrink-0"
          >
            Take a quiz on this paper
          </Button>
        </div>

        <dl className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-500">
          <Fact icon="stack" label={plural(stats.chapterCount || 0, 'chapter')} />
          <Fact icon="book" label={plural(totals.totalTopics || stats.topicCount || 0, 'topic')} />
          <Fact icon="quiz" label={plural(stats.questionCount || 0, 'question')} />
          {totals.needsRevision > 0 && (
            <Fact icon="alert" label={`${totals.needsRevision} needing revision`} tone="warning" />
          )}
        </dl>
      </div>

      <div className="grid gap-4 border-t border-paper-200 bg-paper-50 px-5 py-4 sm:grid-cols-2 sm:px-6">
        <ProgressBar
          value={percent}
          tone={percent >= 80 ? 'success' : 'brand'}
          label={`${totals.completed} of ${totals.totalTopics} topics completed`}
          showValue
        />
        <ProgressBar
          value={totals.mastery}
          tone={masteryTone(totals.mastery) === 'neutral' ? 'brand' : masteryTone(totals.mastery)}
          label="Average mastery across the topics you have opened"
          showValue
        />
      </div>
    </Card>
  );
}

function Fact({ icon, label, tone }) {
  return (
    <div className={cx('inline-flex items-center gap-1.5', tone === 'warning' && 'text-warning-600')}>
      <Icon name={icon} size={14} className={tone === 'warning' ? 'text-warning-500' : 'text-ink-400'} />
      <dd>{label}</dd>
    </div>
  );
}

function ChapterList({ subjectId, chapters }) {
  const firstId = chapters[0]?._id;
  // Remembers which chapters this candidate left open, per paper.
  const [stored, setStored] = useLocalStorage(`mlpp:study:chapters:${subjectId}`, null);

  const expanded = stored ?? (firstId ? [firstId] : []);

  const toggle = useCallback(
    (chapterId) => {
      setStored((current) => {
        const list = current ?? (firstId ? [firstId] : []);
        return list.includes(chapterId) ? list.filter((id) => id !== chapterId) : [...list, chapterId];
      });
    },
    [setStored, firstId],
  );

  const allOpen = chapters.every((chapter) => expanded.includes(chapter._id));

  return (
    <section aria-labelledby="chapters-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="chapters-heading" className="font-serif text-lg font-semibold text-ink-900">
          Chapters
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStored(allOpen ? [] : chapters.map((chapter) => chapter._id))}
        >
          {allOpen ? 'Collapse all' : 'Expand all'}
        </Button>
      </div>

      <ul className="space-y-3">
        {chapters.map((chapter) => (
          <li key={chapter._id}>
            <ChapterPanel
              chapter={chapter}
              open={expanded.includes(chapter._id)}
              onToggle={() => toggle(chapter._id)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ChapterPanel({ chapter, open, onToggle }) {
  const panelId = `chapter-panel-${chapter._id}`;
  const buttonId = `chapter-button-${chapter._id}`;
  const topics = chapter.topics || [];
  const isApparatus = APPARATUS.test(chapter.title || '');
  const completed = topics.filter((t) => t.progress?.status === 'completed').length;

  return (
    <Card className={cx('overflow-hidden', isApparatus && 'border-dashed bg-paper-50')}>
      <h3>
        <button
          id={buttonId}
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className={cx(
            'flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors sm:px-5',
            open ? 'bg-white' : 'hover:bg-paper-50',
          )}
        >
          <Icon
            name="chevronDown"
            size={18}
            strokeStyle
            className={cx('shrink-0 text-ink-400 transition-transform', open && 'rotate-180')}
          />
          <span className="min-w-0 flex-1">
            <span
              className={cx(
                'flex flex-wrap items-baseline gap-x-2 font-serif text-base font-semibold',
                isApparatus ? 'text-ink-500' : 'text-ink-900',
              )}
            >
              {chapter.number != null && chapter.number !== '' && (
                <span className="tabular text-sm font-medium text-ink-400">
                  {typeof chapter.number === 'number' ? `Chapter ${chapter.number}` : chapter.number}
                </span>
              )}
              <span>{chapter.title}</span>
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
              <span>{plural(topics.length, 'topic')}</span>
              {topics.length > 0 && !isApparatus && (
                <span className="tabular">
                  {completed} completed
                </span>
              )}
              {isApparatus && (
                <span className="inline-flex items-center gap-1 text-ink-400">
                  <Icon name="info" size={12} />
                  Bibliography — not examinable reading
                </span>
              )}
            </span>
          </span>
        </button>
      </h3>

      <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!open}>
        {topics.length === 0 ? (
          <p className="border-t border-paper-200 px-5 py-4 text-sm text-ink-500">
            This chapter has no published topics yet.
          </p>
        ) : (
          <ul className="divide-y divide-paper-200 border-t border-paper-200">
            {topics.map((topic) => (
              <li key={topic._id}>
                <TopicRow topic={topic} muted={isApparatus} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function TopicRow({ topic, muted }) {
  const progress = topic.progress || {};
  const status = progress.status || 'not_started';
  const attempts = progress.attempts || 0;
  const mastery = Math.round(progress.mastery || 0);
  const statusIcon = STATUS_ICONS[status];

  return (
    <Link
      to={`/study/topic/${topic._id}`}
      className="group flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-brand-50/60 sm:px-5"
    >
      <div className="min-w-0 flex-1">
        <p
          className={cx(
            'flex flex-wrap items-baseline gap-x-2 font-serif text-[0.975rem] font-medium leading-snug',
            muted ? 'text-ink-500' : 'text-ink-900 group-hover:text-brand-800',
          )}
        >
          {topic.number && <span className="tabular text-sm text-ink-400">{topic.number}</span>}
          <span>{topic.title}</span>
        </p>

        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
          <span className="inline-flex items-center gap-1">
            <Icon name="clock" size={12} className="text-ink-400" />
            {minutesLabel(topic.estimatedMinutes || 0)} to read
          </span>
          <span className="inline-flex items-center gap-1">
            <Icon name="quiz" size={12} className="text-ink-400" />
            {plural(topic.stats?.questionCount || 0, 'question')}
          </span>
          {topic.stats?.flashcardCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <Icon name="cards" size={12} className="text-ink-400" />
              {plural(topic.stats.flashcardCount, 'flashcard')}
            </span>
          )}
        </p>

        {attempts > 0 && (
          <div className="mt-2 max-w-[16rem]">
            {/* The caption states the figure, so the bar itself is decorative. */}
            <div aria-hidden="true">
              <ProgressBar
                value={mastery}
                size="sm"
                tone={masteryTone(mastery) === 'neutral' ? 'brand' : masteryTone(mastery)}
              />
            </div>
            <p className="mt-1 text-[11px] text-ink-400">
              Mastery {mastery}% from {plural(attempts, 'attempt')}
            </p>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Badge
          tone={PROGRESS_STATUS_TONES[status]}
          size="sm"
          icon={statusIcon ? <Icon name={statusIcon} size={11} /> : null}
        >
          {PROGRESS_STATUS_LABELS[status]}
        </Badge>
        <Icon
          name="chevronRight"
          size={16}
          strokeStyle
          className="mt-0.5 text-ink-400 transition-transform group-hover:translate-x-0.5"
        />
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------- utilities --- */

function summarise(chapters) {
  let totalTopics = 0;
  let completed = 0;
  let needsRevision = 0;
  let touched = 0;
  let masterySum = 0;

  chapters.forEach((chapter) => {
    (chapter.topics || []).forEach((topic) => {
      totalTopics += 1;
      const status = topic.progress?.status || 'not_started';
      if (status === 'completed') completed += 1;
      if (status === 'needs_revision') needsRevision += 1;
      if (status !== 'not_started') {
        touched += 1;
        masterySum += topic.progress?.mastery || 0;
      }
    });
  });

  return {
    totalTopics,
    completed,
    needsRevision,
    touched,
    mastery: touched ? Math.round(masterySum / touched) : 0,
  };
}

function SubjectSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <Skeleton className="h-4 w-40" />
      <div className="card p-5 sm:p-6">
        <Skeleton className="h-5 w-24" rounded="rounded-full" />
        <Skeleton className="mt-3 h-8 w-2/3" />
        <SkeletonText lines={2} className="mt-3" />
        <div className="mt-5 flex gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="card px-5 py-4">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="mt-2 h-3 w-1/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
