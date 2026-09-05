import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { contentApi } from '@/services/api';
import { useAsync, useDocumentTitle } from '@/hooks';
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
import { masteryTone, plural } from '@/utils/format';

/**
 * The doorway to Study mode.
 *
 * Each paper is presented as it appears on the examination timetable — the
 * subject name, the printed paper title, and the shape of the reading ahead —
 * together with how far the candidate has actually got.
 */
export default function StudyPage() {
  useDocumentTitle('Study');

  const { data, error, loading, reload } = useAsync(() => contentApi.subjects(), []);

  const subjects = useMemo(
    () => [...(data?.subjects || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [data],
  );

  return (
    <div className="space-y-6">
      <Header />

      {loading && <SubjectGridSkeleton />}

      {!loading && error && <ErrorState error={error} onRetry={reload} className="card" />}

      {!loading && !error && subjects.length === 0 && (
        <Card>
          <EmptyState
            icon="book"
            title="No papers are available yet"
            message="The syllabus for your examination stage has not been published. Check your examination stage in your profile, or try again shortly."
            action={
              <Button to="/profile" variant="secondary" icon={<Icon name="user" size={15} />}>
                Check your examination stage
              </Button>
            }
          />
        </Card>
      )}

      {!loading && !error && subjects.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {subjects.map((subject) => (
            <li key={subject._id} className="flex">
              <SubjectCard subject={subject} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Header() {
  return (
    <header className="max-w-reading">
      <h1 className="font-serif text-2xl font-semibold text-ink-900 sm:text-3xl">Study</h1>
      <p className="mt-2 text-reading-base leading-relaxed text-ink-600">
        Study mode carries the official syllabus text itself, organised into chapters and topics exactly as the
        examiners set it out. Read a topic, mark where you have got to, and practise what you have read — everything you
        answer is traced back to the passage it came from.
      </p>
    </header>
  );
}

function SubjectCard({ subject }) {
  const stats = subject.stats || {};
  const progress = subject.progress || {};
  const percent = Math.round(progress.percentComplete || 0);
  const mastery = Math.round(progress.mastery || 0);
  const masteryText = {
    success: 'text-success-600',
    warning: 'text-warning-600',
    danger: 'text-danger-600',
    neutral: 'text-ink-700',
  }[masteryTone(mastery)];
  const needsRevision = progress.topicsNeedingRevision || 0;
  const total = progress.totalTopics || stats.topicCount || 0;
  const completed = progress.topicsCompleted || 0;

  return (
    <Card
      as={Link}
      to={`/study/subject/${subject._id}`}
      hover
      className="group flex w-full flex-col focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <div className="flex-1 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand" size="sm">
                {subject.code}
              </Badge>
              {needsRevision > 0 && (
                <Badge tone="warning" size="sm" icon={<Icon name="alert" size={11} />}>
                  {needsRevision} needs revision
                </Badge>
              )}
            </div>
            <h2 className="mt-2 font-serif text-lg font-semibold leading-snug text-ink-900 group-hover:text-brand-800">
              {subject.name}
            </h2>
            {subject.paper && <p className="mt-0.5 text-sm text-ink-500">{subject.paper}</p>}
          </div>
          <span className="mt-1 shrink-0 text-ink-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600">
            <Icon name="chevronRight" size={18} strokeStyle />
          </span>
        </div>

        {subject.description && (
          <p className="mt-3 text-sm leading-relaxed text-ink-600">{subject.description}</p>
        )}

        <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-500">
          <Fact icon="stack" label={plural(stats.chapterCount || 0, 'chapter')} />
          <Fact icon="book" label={plural(stats.topicCount || 0, 'topic')} />
          <Fact icon="quiz" label={plural(stats.questionCount || 0, 'question')} />
        </dl>
      </div>

      <div className="border-t border-paper-200 bg-paper-50 px-5 py-4">
        <ProgressBar
          value={percent}
          tone={percent >= 80 ? 'success' : 'brand'}
          size="sm"
          label={
            total > 0 ? `${completed} of ${total} topics completed` : 'No topics yet'
          }
          showValue={total > 0}
        />
        <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="target" size={13} className="text-ink-400" />
            Mastery{' '}
            <strong className={cx('tabular font-semibold', mastery > 0 ? masteryText : 'text-ink-700')}>
              {mastery}%
            </strong>
          </span>
          {progress.topicsTouched > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Icon name="eye" size={13} className="text-ink-400" />
              {plural(progress.topicsTouched, 'topic')} opened
            </span>
          )}
        </p>
      </div>
    </Card>
  );
}

function Fact({ icon, label }) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <Icon name={icon} size={13} className="text-ink-400" />
      <dd>{label}</dd>
    </div>
  );
}

/** Mirrors the real card layout so the page does not jump when data lands. */
function SubjectGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="card flex flex-col">
          <div className="flex-1 p-5">
            <Skeleton className="h-5 w-16" rounded="rounded-full" />
            <Skeleton className="mt-3 h-6 w-3/4" />
            <Skeleton className="mt-2 h-4 w-1/2" />
            <SkeletonText lines={2} className="mt-3" />
            <Skeleton className="mt-4 h-3.5 w-2/3" />
          </div>
          <div className="border-t border-paper-200 bg-paper-50 px-5 py-4">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="mt-2 h-2 w-full" rounded="rounded-full" />
            <Skeleton className="mt-3 h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
