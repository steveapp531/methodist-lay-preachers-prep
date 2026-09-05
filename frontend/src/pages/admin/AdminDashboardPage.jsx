import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { adminApi } from '@/services/api';
import { useAsync, useDocumentTitle } from '@/hooks';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Icon,
  ProgressBar,
  Skeleton,
  SkeletonText,
  SourceBadge,
  StatTile,
  cx,
} from '@/components/ui';
import {
  QUESTION_TYPE_LABELS,
  accuracyTone,
  formatDate,
  percent,
  plural,
  relativeTime,
} from '@/utils/format';

const DAY_RANGES = [7, 30, 90];

const STATUS_META = {
  draft: { label: 'Draft', tone: 'neutral', icon: 'pen', note: 'Not yet offered to candidates.' },
  needs_review: { label: 'Needs review', tone: 'warning', icon: 'alert', note: 'Held back until someone checks it.' },
  published: { label: 'Published', tone: 'success', icon: 'check', note: 'Live for candidates.' },
  archived: { label: 'Archived', tone: 'outline', icon: 'inbox', note: 'Withdrawn, but history is kept.' },
};

const CONFIDENCE_META = {
  verified: { label: 'Verified', tone: 'success', icon: 'check', note: 'The answer is traced to a syllabus passage.' },
  provisional: { label: 'Provisional', tone: 'warning', icon: 'info', note: 'Supported, but not conclusively located.' },
  unverified: { label: 'Unverified', tone: 'danger', icon: 'alert', note: 'No supporting passage has been found.' },
};

/** Parses a YYYY-MM-DD key as a local date, so no timezone shifts the label. */
function parseKey(key) {
  const [year, month, day] = String(key || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function shortDay(key) {
  const date = parseKey(key);
  return date ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date) : String(key || '');
}

function longDay(key) {
  const date = parseKey(key);
  return date
    ? new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(date)
    : String(key || '');
}

export default function AdminDashboardPage() {
  useDocumentTitle('Administration overview');

  const [days, setDays] = useState(30);
  const { data, error, loading, reload } = useAsync(() => adminApi.overview({ days }), [days]);

  const content = data?.content;
  const users = data?.users;
  const engagement = data?.engagement;

  const isEmpty = Boolean(data) && !users?.total && !content?.questions && !content?.subjects;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink-900">Administration overview</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-500">
            How the platform is being used, and whether the question bank is in a state fit to put in front of
            candidates.
          </p>
        </div>

        <fieldset className="shrink-0">
          <legend className="sr-only">Reporting period</legend>
          <div className="inline-flex rounded-lg border border-paper-300 bg-white p-1" role="group" aria-label="Reporting period">
            {DAY_RANGES.map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setDays(range)}
                aria-pressed={days === range}
                className={cx(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  days === range ? 'bg-brand-700 text-white' : 'text-ink-600 hover:bg-paper-100',
                )}
              >
                {range} days
              </button>
            ))}
          </div>
        </fieldset>
      </header>

      {loading && <OverviewSkeleton />}

      {!loading && error && <ErrorState error={error} onRetry={reload} className="card" />}

      {!loading && !error && isEmpty && (
        <Card>
          <EmptyState
            icon="stack"
            title="There is nothing here yet"
            message="No candidates have registered and no content has been loaded. Import a question bank to get started."
            action={
              <Button to="/admin/import" icon={<Icon name="upload" size={16} />}>
                Import questions
              </Button>
            }
          />
        </Card>
      )}

      {!loading && !error && data && !isEmpty && (
        <>
          <section aria-labelledby="headline-heading">
            <h2 id="headline-heading" className="sr-only">
              Headline figures
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Registered candidates" value={users?.total ?? 0} icon={<Icon name="users" size={14} />} />
              <StatTile
                label={`Active in ${days} days`}
                value={users?.activeLastNDays ?? 0}
                sublabel={users?.total ? `${percent((users.activeLastNDays || 0) / users.total)} of everyone registered` : undefined}
                tone="brand"
                icon={<Icon name="sprout" size={14} />}
              />
              <StatTile
                label={`New in ${days} days`}
                value={users?.newLastNDays ?? 0}
                sublabel="New registrations"
                icon={<Icon name="user" size={14} />}
              />
              <StatTile
                label="Questions attempted"
                value={(engagement?.questionsAttempted ?? 0).toLocaleString('en-GB')}
                sublabel="All time"
                icon={<Icon name="quiz" size={14} />}
              />
              <StatTile
                label="Average accuracy"
                value={engagement?.questionsAttempted ? percent(engagement.averageAccuracy) : '—'}
                tone={engagement?.questionsAttempted ? accuracyTone(engagement.averageAccuracy) : 'neutral'}
                sublabel="Across every recorded attempt"
                icon={<Icon name="target" size={14} />}
              />
              <StatTile
                label="Theory answers"
                value={(engagement?.theoryAnswers ?? 0).toLocaleString('en-GB')}
                sublabel="Written answers marked"
                icon={<Icon name="note" size={14} />}
              />
              <StatTile
                label="Mock exams completed"
                value={engagement?.mockExamsCompleted ?? 0}
                icon={<Icon name="exam" size={14} />}
              />
              <StatTile
                label="Average mock score"
                value={engagement?.averageMockScore == null ? '—' : `${engagement.averageMockScore}%`}
                tone={engagement?.averageMockScore == null ? 'neutral' : accuracyTone(engagement.averageMockScore / 100)}
                sublabel={engagement?.averageMockScore == null ? 'No papers sat yet' : 'Across marked papers'}
                icon={<Icon name="award" size={14} />}
              />
            </div>
          </section>

          <ContentHealth content={content} />

          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Daily active candidates"
                subtitle={`People who answered at least one question, over the last ${plural(days, 'day')}.`}
                icon={<Icon name="chart" size={18} />}
              />
              <div className="p-5">
                <DailyActiveChart series={engagement?.dailyActiveUsers} days={days} />
              </div>
            </Card>

            <Card>
              <CardHeader title="Candidates by examination stage" icon={<Icon name="users" size={18} />} />
              <div className="p-5">
                <StageBars rows={users?.byStage} total={users?.total} />
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Questions candidates get wrong most often"
              subtitle="Worth checking the answer key and the explanation — a question everyone fails is as likely to be wrong as it is to be hard."
              icon={<Icon name="target" size={18} />}
              action={
                <Button variant="secondary" size="sm" to="/admin/questions?sort=hardest">
                  Browse the bank
                </Button>
              }
            />
            <HardestQuestions rows={data.hardestQuestions} />
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Hardest topics"
                subtitle="Lowest accuracy across recorded attempts."
                icon={<Icon name="alert" size={18} />}
              />
              <TopicList rows={data.hardestTopics} kind="hardest" />
            </Card>

            <Card>
              <CardHeader
                title="Most practised topics"
                subtitle="Where candidates are spending their time."
                icon={<Icon name="book" size={18} />}
              />
              <TopicList rows={data.popularTopics} kind="popular" />
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="Recent registrations" icon={<Icon name="user" size={18} />} action={
                <Button variant="ghost" size="sm" to="/admin/users">
                  All users
                </Button>
              } />
              <RecentRegistrations rows={data.recentRegistrations} />
            </Card>

            <Card>
              <CardHeader
                title="Recent administrator activity"
                subtitle="Every content change is recorded."
                icon={<Icon name="pen" size={18} />}
              />
              <ActivityList rows={data.recentAdminActivity} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ sub-panels --- */

/**
 * The panel that matters most. An unverified answer is not a cosmetic problem:
 * it is a question that will teach a candidate something that may be untrue.
 */
function ContentHealth({ content }) {
  if (!content) return null;

  const statusEntries = ['draft', 'needs_review', 'published', 'archived'].map((key) => ({
    key,
    count: content.questionsByStatus?.[key] || 0,
    ...STATUS_META[key],
  }));
  const confidenceEntries = ['verified', 'provisional', 'unverified'].map((key) => ({
    key,
    count: content.questionsByConfidence?.[key] || 0,
    ...CONFIDENCE_META[key],
  }));

  const needsReview = content.needsReview || 0;
  const totalQuestions = content.questions || 0;

  return (
    <Card>
      <CardHeader
        title="Content health"
        subtitle="What is in the bank, and how much of it is safe to show a candidate."
        icon={<Icon name="stack" size={18} />}
        action={
          <Button variant="secondary" size="sm" to="/admin/questions">
            Manage questions
          </Button>
        }
      />

      <div className="space-y-5 p-5">
        {needsReview > 0 && (
          <div className="rounded-xl border border-warning-500 bg-warning-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning-500 text-white">
                  <Icon name="alert" size={18} />
                </span>
                <div>
                  <p className="font-serif text-base font-semibold text-warning-600">
                    {plural(needsReview, 'question has', 'questions have')} answers that have not been traced to the
                    syllabus
                  </p>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-600">
                    Until someone checks each one against the printed syllabus, the platform cannot honestly tell a
                    candidate they are wrong. Review them before they are published.
                  </p>
                </div>
              </div>
              <Button
                to="/admin/questions?answerConfidence=unverified"
                variant="secondary"
                className="shrink-0"
                icon={<Icon name="eye" size={15} />}
              >
                Review them
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="Subjects" value={content.subjects || 0} />
          <StatTile label="Chapters" value={content.chapters || 0} />
          <StatTile label="Topics" value={content.topics || 0} />
          <StatTile label="Questions" value={(content.questions || 0).toLocaleString('en-GB')} tone="brand" />
          <StatTile label="Mock papers" value={content.mockExams || 0} />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink-400">Questions by status</h3>
            <ul className="space-y-2">
              {statusEntries.map((entry) => (
                <li key={entry.key}>
                  <Link
                    to={`/admin/questions?status=${entry.key}`}
                    className="flex items-center gap-3 rounded-lg border border-paper-200 px-3 py-2.5 transition-colors hover:border-brand-300 hover:bg-paper-50"
                  >
                    <Badge tone={entry.tone} size="sm" icon={<Icon name={entry.icon} size={12} />}>
                      {entry.label}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate text-xs text-ink-500">{entry.note}</span>
                    <span className="tabular shrink-0 font-serif text-base font-semibold text-ink-900">
                      {entry.count.toLocaleString('en-GB')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
              Questions by answer confidence
            </h3>
            <ul className="space-y-2">
              {confidenceEntries.map((entry) => (
                <li key={entry.key}>
                  <Link
                    to={`/admin/questions?answerConfidence=${entry.key}`}
                    className="flex items-center gap-3 rounded-lg border border-paper-200 px-3 py-2.5 transition-colors hover:border-brand-300 hover:bg-paper-50"
                  >
                    <Badge tone={entry.tone} size="sm" icon={<Icon name={entry.icon} size={12} />}>
                      {entry.label}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate text-xs text-ink-500">{entry.note}</span>
                    <span className="tabular shrink-0 font-serif text-base font-semibold text-ink-900">
                      {entry.count.toLocaleString('en-GB')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {totalQuestions > 0 && (
              <ProgressBar
                className="mt-3"
                value={content.questionsByConfidence?.verified || 0}
                max={totalQuestions}
                tone="success"
                label="Traced to the syllabus"
                showValue
              />
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function DailyActiveChart({ series, days }) {
  const rows = useMemo(() => (Array.isArray(series) ? series : []), [series]);

  if (!rows.length) {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-500">
        <Icon name="chart" size={16} className="text-ink-400" />
        Nobody has answered a question in this period, so there is nothing to chart.
      </p>
    );
  }

  const total = rows.reduce((sum, row) => sum + (row.users || 0), 0);
  const peak = rows.reduce((best, row) => ((row.users || 0) > (best.users || 0) ? row : best), rows[0]);
  const summary = `${plural(rows.length, 'day')} with activity in the last ${plural(days, 'day')}. Busiest day: ${longDay(
    peak.date,
  )} with ${plural(peak.users || 0, 'candidate')}. ${total} candidate-days in total.`;

  return (
    <figure className="m-0">
      <p className="text-sm leading-relaxed text-ink-600">{summary}</p>

      <div className="mt-3" role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id="dau-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2f4877" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#2f4877" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#f0ece4" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={shortDay}
              tick={{ fill: '#6b7280', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#e3ddd1' }}
              minTickGap={20}
              interval="preserveStartEnd"
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: '#6b7280', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={34}
            />
            <RechartsTooltip
              cursor={{ stroke: '#b3c4e0' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload;
                return (
                  <div className="rounded-lg border border-paper-300 bg-white px-3 py-2 text-xs shadow-lift">
                    <p className="font-medium text-ink-900">{longDay(row.date)}</p>
                    <p className="tabular mt-0.5 text-ink-600">{plural(row.users || 0, 'active candidate')}</p>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="users"
              name="Active candidates"
              stroke="#2f4877"
              strokeWidth={2}
              fill="url(#dau-fill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <ul className="sr-only">
        {rows.map((row) => (
          <li key={row.date}>
            {longDay(row.date)}: {plural(row.users || 0, 'active candidate')}.
          </li>
        ))}
      </ul>
    </figure>
  );
}

function StageBars({ rows, total }) {
  if (!rows?.length) {
    return <p className="text-sm text-ink-500">No candidate has chosen an examination stage yet.</p>;
  }

  const max = Math.max(...rows.map((r) => r.count || 0), 1);

  return (
    <ul className="space-y-3.5">
      {rows.map((row) => (
        <li key={row.examId || row.code}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm font-medium text-ink-800">{row.name || row.code}</span>
            <span className="tabular shrink-0 text-sm text-ink-600">
              {row.count}
              {total ? <span className="ml-1 text-xs text-ink-400">({percent((row.count || 0) / total)})</span> : null}
            </span>
          </div>
          <ProgressBar value={row.count || 0} max={max} tone="brand" size="sm" label={`${row.name || row.code} candidates`} />
        </li>
      ))}
    </ul>
  );
}

function HardestQuestions({ rows }) {
  if (!rows?.length) {
    return (
      <EmptyState
        icon="target"
        title="Not enough attempts yet"
        message="Once candidates have answered a question a handful of times, the ones they struggle with most will be listed here."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[46rem] border-collapse text-sm">
        <caption className="sr-only">
          Questions with the lowest accuracy, with their subject, topic, number of attempts and accuracy.
        </caption>
        <thead>
          <tr className="border-b border-paper-200 text-left text-xs uppercase tracking-wide text-ink-400">
            <th scope="col" className="px-5 py-2.5 font-medium">Question</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Subject</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Topic</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Attempts</th>
            <th scope="col" className="px-5 py-2.5 text-right font-medium">Accuracy</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row._id} className="border-b border-paper-100 last:border-0 hover:bg-paper-50">
              <td className="max-w-md px-5 py-3">
                <Link to={`/admin/questions/${row._id}`} className="group block">
                  <span className="line-clamp-2 text-sm leading-snug text-ink-800 group-hover:text-brand-700">
                    {row.prompt}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="tabular text-[11px] text-ink-400">{row.questionId}</span>
                    <Badge tone="outline" size="sm">
                      {QUESTION_TYPE_LABELS[row.type] || row.type}
                    </Badge>
                    <SourceBadge sourceKind={row.sourceKind} answerConfidence={row.answerConfidence} />
                  </span>
                </Link>
              </td>
              <td className="px-3 py-3 text-ink-600">{row.subject?.shortName || row.subject?.name || '—'}</td>
              <td className="max-w-[12rem] truncate px-3 py-3 text-ink-600">{row.topic?.title || '—'}</td>
              <td className="tabular px-3 py-3 text-right text-ink-600">{row.stats?.attempts ?? 0}</td>
              <td className="px-5 py-3 text-right">
                <Badge tone={accuracyTone(row.stats?.accuracy)} size="sm">
                  {percent(row.stats?.accuracy)}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopicList({ rows, kind }) {
  if (!rows?.length) {
    return (
      <EmptyState
        icon="book"
        title="Nothing to show yet"
        message={
          kind === 'hardest'
            ? 'Topics appear here once candidates have attempted enough questions in them.'
            : 'Topics appear here once candidates start practising.'
        }
      />
    );
  }

  return (
    <ul className="divide-y divide-paper-100">
      {rows.map((row) => (
        <li key={row.topicId} className="flex items-center gap-3 px-5 py-3">
          <div className="min-w-0 flex-1">
            <Link to={`/study/topic/${row.topicId}`} className="block truncate text-sm font-medium text-ink-800 hover:text-brand-700">
              {row.title}
            </Link>
            <p className="mt-0.5 text-xs text-ink-500">
              {row.subject ? `${row.subject} · ` : ''}
              {plural(row.attempts || 0, 'attempt')} · {plural(row.learners || 0, 'candidate')}
            </p>
          </div>
          {kind === 'hardest' ? (
            <Badge tone={accuracyTone(row.accuracy)} size="sm">
              {percent(row.accuracy)}
            </Badge>
          ) : (
            <span className="tabular shrink-0 text-sm font-medium text-ink-700">{row.attempts}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function RecentRegistrations({ rows }) {
  if (!rows?.length) {
    return <EmptyState icon="user" title="No registrations yet" message="New candidates will be listed here as they sign up." />;
  }

  return (
    <ul className="divide-y divide-paper-100">
      {rows.map((row) => (
        <li key={row._id} className="flex items-center gap-3 px-5 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-800">{row.name}</p>
            <p className="truncate text-xs text-ink-500">{row.email}</p>
          </div>
          <div className="shrink-0 text-right">
            {row.examStage?.shortName && (
              <Badge tone="outline" size="sm">
                {row.examStage.shortName}
              </Badge>
            )}
            <p className="mt-1 text-[11px] text-ink-400">{formatDate(row.createdAt)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ActivityList({ rows }) {
  if (!rows?.length) {
    return <EmptyState icon="pen" title="No changes recorded" message="Content changes made by administrators appear here." />;
  }

  const tones = {
    create: 'success',
    update: 'brand',
    publish: 'gold',
    delete: 'danger',
    import: 'flame',
  };

  return (
    <ul className="divide-y divide-paper-100">
      {rows.map((row) => (
        <li key={row._id} className="flex items-start gap-3 px-5 py-3">
          <Badge tone={tones[row.action] || 'neutral'} size="sm" className="mt-0.5 shrink-0 capitalize">
            {row.action}
          </Badge>
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug text-ink-800">{row.summary || `${row.action} ${row.entityType}`}</p>
            <p className="mt-0.5 text-xs text-ink-500">
              {row.actorName || 'An administrator'} · {relativeTime(row.createdAt)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading the administration overview.</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[92px]" rounded="rounded-xl" />
        ))}
      </div>
      <Card className="p-5">
        <Skeleton className="mb-4 h-5 w-40" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[80px]" rounded="rounded-xl" />
          ))}
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <SkeletonText lines={4} />
          <SkeletonText lines={3} />
        </div>
      </Card>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <Skeleton className="mb-4 h-5 w-48" />
          <Skeleton className="h-[220px]" rounded="rounded-xl" />
        </Card>
        <Card className="p-5">
          <Skeleton className="mb-4 h-5 w-40" />
          <SkeletonText lines={5} />
        </Card>
      </div>
    </div>
  );
}
