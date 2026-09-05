import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
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
  StatTile,
  Tabs,
} from '@/components/ui';
import ReadinessPanel from '@/components/dashboard/ReadinessPanel';
import ActivityChart from '@/components/dashboard/ActivityChart';
import { subjectPercentComplete } from '@/components/dashboard/SubjectProgressList';
import { progressApi } from '@/services/api';
import { useAsync, useDocumentTitle } from '@/hooks';
import { formatDate, masteryTone, minutesLabel, percent, plural } from '@/utils/format';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'papers', label: 'By paper' },
  { key: 'achievements', label: 'Achievements' },
];

export default function ProgressPage() {
  useDocumentTitle('Progress');

  const [tab, setTab] = useState('overview');
  const { data, error, loading, reload } = useAsync(() => progressApi.progress(), []);

  const subjectsByMastery = useMemo(() => {
    const rows = Array.isArray(data?.subjects) ? [...data.subjects] : [];
    return rows.sort((a, b) => (a.mastery || 0) - (b.mastery || 0));
  }, [data]);

  if (loading && !data) return <ProgressSkeleton />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  const {
    overview = {},
    readiness,
    accuracyTrend = [],
    activity = [],
    weakTopics = [],
    strongTopics = [],
    achievements = {},
    streak = {},
  } = data;

  const hasWork = Boolean(overview.questionsAnswered);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-2xl font-semibold text-ink-900 sm:text-3xl">Your progress</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
          Everything measured about your preparation, set out in full. Each figure is drawn from your own attempts, so
          it moves only as you work.
        </p>
      </header>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div role="tabpanel" aria-label="Overview" tabIndex={0} className="space-y-6 focus:outline-none">
          <Card className="p-5">
            <ReadinessPanel readiness={readiness} />
          </Card>

          <section aria-label="Headline figures" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Questions answered"
              value={overview.questionsAnswered ?? 0}
              sublabel={`${overview.distinctQuestions ?? 0} different questions`}
              icon={<Icon name="quiz" size={14} />}
            />
            <StatTile
              label="Accuracy"
              value={hasWork ? percent(overview.accuracy) : '—'}
              sublabel={`${overview.correct ?? 0} correct, ${overview.incorrect ?? 0} incorrect`}
              tone={hasWork ? masteryTone((overview.accuracy || 0) * 100) : 'neutral'}
              icon={<Icon name="target" size={14} />}
            />
            <StatTile
              label="Mock examinations"
              value={overview.mockExamsCompleted ?? 0}
              sublabel={
                overview.averageMockScore != null
                  ? `Average ${overview.averageMockScore}%, best ${overview.bestMockScore}%`
                  : 'None sat yet'
              }
              icon={<Icon name="exam" size={14} />}
            />
            <StatTile
              label="Study time"
              value={minutesLabel(overview.studyMinutes || 0)}
              sublabel={`Current streak ${plural(streak.current || 0, 'day')}`}
              icon={<Icon name="clock" size={14} />}
            />
          </section>

          <Card>
            <CardHeader
              title="Accuracy over time"
              subtitle="Are your answers getting better?"
              icon={<Icon name="chart" size={18} />}
            />
            <div className="p-5">
              <AccuracyTrend points={accuracyTrend} />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="The last thirty days"
              subtitle="Questions answered each day"
              icon={<Icon name="chart" size={18} />}
            />
            <div className="p-5">
              <ActivityChart data={activity} days={30} height={220} />
            </div>
          </Card>
        </div>
      )}

      {tab === 'papers' && (
        <div role="tabpanel" aria-label="By paper" tabIndex={0} className="space-y-6 focus:outline-none">
          <Card>
            <CardHeader
              title="Every paper"
              subtitle="Weakest first, so the papers needing attention come to the top"
              icon={<Icon name="book" size={18} />}
              action={
                <Button as={Link} to="/study" variant="ghost" size="sm">
                  Study library
                </Button>
              }
            />
            {subjectsByMastery.length ? (
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[44rem] border-collapse text-sm">
                  <caption className="sr-only">
                    Progress in each paper, sorted by mastery from lowest to highest.
                  </caption>
                  <thead>
                    <tr className="border-b border-paper-200 text-left text-xs uppercase tracking-wide text-ink-400">
                      <th scope="col" className="px-5 py-3 font-medium">
                        Paper
                      </th>
                      <th scope="col" className="px-3 py-3 text-right font-medium">
                        Topics touched
                      </th>
                      <th scope="col" className="px-3 py-3 text-right font-medium">
                        Completed
                      </th>
                      <th scope="col" className="px-3 py-3 text-right font-medium">
                        Attempts
                      </th>
                      <th scope="col" className="px-3 py-3 text-right font-medium">
                        Accuracy
                      </th>
                      <th scope="col" className="px-5 py-3 font-medium">
                        Mastery
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjectsByMastery.map((subject) => {
                      const mastery = Math.round(subject.mastery || 0);
                      return (
                        <tr key={subject.subjectId} className="border-b border-paper-200 last:border-b-0">
                          <th scope="row" className="px-5 py-3.5 text-left font-normal">
                            <Link
                              to={`/study/subject/${subject.subjectId}`}
                              className="font-serif font-semibold text-brand-800 hover:underline"
                            >
                              {subject.name}
                            </Link>
                            <span className="mt-0.5 block text-xs text-ink-500">
                              {subject.code ? `${subject.code} · ` : ''}
                              {subjectPercentComplete(subject)}% of the paper completed
                            </span>
                          </th>
                          <td className="tabular px-3 py-3.5 text-right text-ink-700">
                            {subject.topicsTouched || 0} of {subject.totalTopics || 0}
                          </td>
                          <td className="tabular px-3 py-3.5 text-right text-ink-700">
                            {subject.topicsCompleted || 0}
                            {subject.topicsNeedingRevision > 0 && (
                              <span className="mt-0.5 block text-xs text-warning-600">
                                {subject.topicsNeedingRevision} to revise
                              </span>
                            )}
                          </td>
                          <td className="tabular px-3 py-3.5 text-right text-ink-700">{subject.attempts || 0}</td>
                          <td className="tabular px-3 py-3.5 text-right text-ink-700">
                            {subject.attempts ? percent(subject.accuracy) : '—'}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <ProgressBar
                                value={mastery}
                                tone={masteryTone(mastery)}
                                size="sm"
                                label={`${subject.name} mastery`}
                                className="w-28 min-w-[5rem]"
                              />
                              <span className="tabular w-10 text-right text-sm font-semibold text-ink-900">
                                {mastery}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon="book"
                title="No paper progress yet"
                message="Read a topic or answer a question and each paper will be measured here."
                action={
                  <Button as={Link} to="/study" size="sm">
                    Open the study library
                  </Button>
                }
              />
            )}
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <TopicTable
              title="Topics to strengthen"
              subtitle="Lowest measured mastery first"
              icon="target"
              topics={weakTopics}
              tone="warning"
              emptyMessage="Answer at least four questions on a topic and it will be measured here."
            />
            <TopicTable
              title="Your strongest topics"
              subtitle="Highest measured mastery first"
              icon="award"
              topics={strongTopics}
              tone="success"
              emptyMessage="Strong topics appear once you have answered enough questions on them."
            />
          </div>
        </div>
      )}

      {tab === 'achievements' && (
        <div role="tabpanel" aria-label="Achievements" tabIndex={0} className="space-y-6 focus:outline-none">
          <Card className="p-5">
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-400">Earned</p>
                <p className="tabular mt-1 font-serif text-2xl font-semibold text-ink-900">
                  {achievements.earned?.length || 0} of {achievements.total || 0}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-400">Points</p>
                <p className="tabular mt-1 font-serif text-2xl font-semibold text-gold-700">
                  {achievements.points || 0}
                </p>
              </div>
              <p className="max-w-md text-sm leading-relaxed text-ink-600">
                Milestones marking real study, not points for their own sake. Locked ones are listed below so you can
                see what is still ahead of you.
              </p>
            </div>
          </Card>

          <section aria-labelledby="earned-heading">
            <h2 id="earned-heading" className="font-serif text-lg font-semibold text-ink-900">
              Earned
            </h2>
            {achievements.earned?.length ? (
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {achievements.earned.map((achievement) => (
                  <li
                    key={`${achievement.code}-${achievement.context || ''}`}
                    className="rounded-xl border border-gold-200 bg-white p-4 shadow-card"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold-100 text-gold-700">
                        <Icon name={achievement.icon || 'award'} size={20} />
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-serif text-sm font-semibold text-ink-900">{achievement.title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-ink-600">{achievement.description}</p>
                        {achievement.context && (
                          <p className="mt-1 text-xs italic text-ink-500">{achievement.context}</p>
                        )}
                        <p className="tabular mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                          <Badge tone="gold" size="sm">
                            {achievement.points} points
                          </Badge>
                          <span>Earned {formatDate(achievement.earnedAt)}</span>
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Card className="mt-3">
                <EmptyState
                  icon="award"
                  title="No achievements yet"
                  message="The first is awarded the moment you complete a practice quiz."
                  action={
                    <Button as={Link} to="/quiz" size="sm">
                      Set up a quiz
                    </Button>
                  }
                />
              </Card>
            )}
          </section>

          {achievements.locked?.length > 0 && (
            <section aria-labelledby="locked-heading">
              <h2 id="locked-heading" className="font-serif text-lg font-semibold text-ink-900">
                Still to come
              </h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {achievements.locked.map((achievement) => (
                  <li key={achievement.code} className="rounded-xl border border-paper-300 bg-paper-100 p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-paper-200 text-ink-400">
                        <Icon name={achievement.icon || 'award'} size={20} />
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-serif text-sm font-semibold text-ink-600">{achievement.title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-ink-500">{achievement.description}</p>
                        <p className="mt-2">
                          <Badge tone="neutral" size="sm" icon={<Icon name="target" size={11} />}>
                            Not yet earned · {achievement.points} points
                          </Badge>
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------- accuracy trend --- */

function TrendTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-paper-300 bg-white px-3 py-2 text-xs shadow-lift">
      <p className="font-medium text-ink-900">Window {row.index}</p>
      <p className="tabular mt-0.5 text-ink-600">{Math.round(row.value)}% accuracy</p>
      <p className="tabular text-ink-500">
        {plural(row.sampleSize || 0, 'question')}
        {row.upTo ? `, up to ${formatDate(row.upTo)}` : ''}
      </p>
    </div>
  );
}

function AccuracyTrend({ points }) {
  const series = useMemo(
    () =>
      (Array.isArray(points) ? points : []).map((point) => ({
        index: point.index,
        value: Math.round((point.accuracy || 0) * 100),
        sampleSize: point.sampleSize,
        upTo: point.upTo,
      })),
    [points],
  );

  if (series.length < 2) {
    return (
      <p className="text-sm leading-relaxed text-ink-500">
        The trend needs at least two windows of twenty answered questions before it can be drawn. Keep answering and it
        will appear here.
        {series.length === 1 && ` Your first window sits at ${series[0].value}% accuracy.`}
      </p>
    );
  }

  const first = series[0];
  const last = series[series.length - 1];
  const change = last.value - first.value;
  const direction = change > 2 ? 'risen' : change < -2 ? 'fallen' : 'held steady';

  const summary = `Accuracy has ${direction} from ${first.value}% in the earliest window to ${last.value}% in the most recent, across ${plural(series.length, 'window')}.`;

  return (
    <figure className="m-0">
      <p className="text-sm leading-relaxed text-ink-600">{summary}</p>

      <div className="mt-3" role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="#f0ece4" vertical={false} />
            <XAxis
              dataKey="index"
              tick={{ fill: '#6b7280', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#e3ddd1' }}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(value) => `${value}%`}
              tick={{ fill: '#6b7280', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={42}
            />
            <RechartsTooltip content={<TrendTooltip />} />
            <Line
              type="monotone"
              dataKey="value"
              name="Accuracy"
              stroke="#2f4877"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#2f4877' }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <figcaption className="mt-2 text-xs leading-relaxed text-ink-500">
        Each point is a rolling window of twenty answered questions, oldest on the left. The horizontal axis counts
        windows, not days, so a point moves only when you have answered another twenty questions.
      </figcaption>

      <ul className="sr-only">
        {series.map((point) => (
          <li key={point.index}>
            Window {point.index}: {point.value}% accuracy over {plural(point.sampleSize || 0, 'question')}.
          </li>
        ))}
      </ul>
    </figure>
  );
}

/* ------------------------------------------------------------ topic lists --- */

function TopicTable({ title, subtitle, icon, topics, tone, emptyMessage }) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} icon={<Icon name={icon} size={18} />} />
      {topics?.length ? (
        <ul className="divide-y divide-paper-200">
          {topics.map((topic) => (
            <li key={topic.topicId || topic.slug}>
              <Link
                to={`/study/topic/${topic.topicId}`}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-paper-100"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-800">{topic.title}</p>
                  <p className="tabular text-xs text-ink-500">
                    {topic.subject ? `${topic.subject} · ` : ''}
                    {plural(topic.attempts || 0, 'attempt')} · accuracy {percent(topic.accuracy)}
                  </p>
                </div>
                <Badge tone={tone} size="sm" className="tabular shrink-0">
                  {Math.round(topic.mastery || 0)}% mastery
                </Badge>
                <Icon name="chevronRight" size={15} className="shrink-0 text-ink-400" strokeStyle />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-6 text-sm leading-relaxed text-ink-500">{emptyMessage}</p>
      )}
    </Card>
  );
}

/* --------------------------------------------------------------- loading --- */

function ProgressSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your progress…</span>

      <div>
        <Skeleton className="h-8 w-56" />
        <div className="mt-3 max-w-2xl">
          <SkeletonText lines={2} />
        </div>
      </div>

      <div className="flex gap-4 border-b border-paper-300 pb-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-5 w-24" rounded="rounded" />
        ))}
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-4">
          <Skeleton className="h-24 w-24" rounded="rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-5 w-48" />
            <div className="mt-3">
              <SkeletonText lines={2} />
            </div>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <Skeleton className="h-3.5 w-32" rounded="rounded" />
              <Skeleton className="mt-2 h-1.5 w-full" rounded="rounded-full" />
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" rounded="rounded-xl" />
        ))}
      </div>

      <Skeleton className="h-72 w-full" rounded="rounded-xl" />
      <Skeleton className="h-72 w-full" rounded="rounded-xl" />
    </div>
  );
}
