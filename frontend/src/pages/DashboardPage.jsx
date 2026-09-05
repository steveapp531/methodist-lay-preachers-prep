import { useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorState,
  Icon,
  ProgressBar,
  Skeleton,
  SkeletonText,
  StatTile,
} from '@/components/ui';
import ReadinessPanel from '@/components/dashboard/ReadinessPanel';
import RecommendationCard from '@/components/dashboard/RecommendationCard';
import ActivityChart from '@/components/dashboard/ActivityChart';
import SubjectProgressList from '@/components/dashboard/SubjectProgressList';
import { progressApi, quizApi } from '@/services/api';
import { useAsync, useAction, useDocumentTitle } from '@/hooks';
import { useToast } from '@/context/ToastContext';
import { formatDate, masteryTone, minutesLabel, percent, plural, relativeTime } from '@/utils/format';

const URGENCY_ORDER = { high: 0, medium: 1, low: 2 };

export default function DashboardPage() {
  useDocumentTitle('Dashboard');

  const navigate = useNavigate();
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(() => progressApi.dashboard(), []);

  /**
   * Every recommendation carries the action that starts it. Study actions
   * navigate; quiz actions create the session first and then open it.
   */
  const runAction = useCallback(
    async (action) => {
      if (!action?.type) return;

      if (action.type === 'study_topic') {
        navigate(`/study/topic/${action.topicId}`);
        return;
      }
      if (action.type === 'mock_exam') {
        navigate('/mock-exam');
        return;
      }

      const payloads = {
        topic_quiz: { mode: 'topic_quiz', topic: action.topicId, size: action.size || 10 },
        mistakes_quiz: { mode: 'mistakes', topic: action.topicId, size: action.size || 10 },
        daily_revision: { mode: 'daily_revision', size: action.size || 10 },
      };
      const payload = payloads[action.type];
      if (!payload) return;

      try {
        const result = await quizApi.create(payload);
        if (result?.notice) toast.info(result.notice);
        if (result?.quiz?.id) navigate(`/quiz/${result.quiz.id}`);
        else toast.error('We could not start that quiz just now. Please try again.');
      } catch (err) {
        toast.error(err?.message || 'We could not start that quiz just now.');
      }
    },
    [navigate, toast],
  );

  const startDailyRevision = useAction(() => runAction({ type: 'daily_revision', size: 10 }));

  const recommendations = useMemo(() => {
    const rows = Array.isArray(data?.recommendations) ? [...data.recommendations] : [];
    return rows.sort((a, b) => (URGENCY_ORDER[a.urgency] ?? 9) - (URGENCY_ORDER[b.urgency] ?? 9));
  }, [data]);

  if (loading && !data) return <DashboardSkeleton />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  const {
    greeting = {},
    daysUntilExam,
    examDate,
    overallProgress = 0,
    readiness,
    streak = {},
    dailyGoal = {},
    overview = {},
    narrative,
    subjects = [],
    weakTopics = [],
    strongTopics = [],
    activity = [],
    achievements = {},
    recentActivity = [],
  } = data;

  // A candidate on their very first visit should be welcomed, not shown empty charts.
  const isNewCandidate =
    !overview.questionsAnswered && !overview.mockExamsCompleted && !(readiness?.evidence?.topicsTouched || 0);

  const goalTarget = dailyGoal.target || 0;
  const goalCompleted = dailyGoal.completed || 0;

  return (
    <div className="space-y-6">
      <Greeting
        greeting={greeting}
        overallProgress={overallProgress}
        daysUntilExam={daysUntilExam}
        examDate={examDate}
        streak={streak}
        isNewCandidate={isNewCandidate}
      />

      {isNewCandidate ? (
        <>
          <GettingStarted />
          {recommendations.length > 0 && (
            <section aria-labelledby="recommendations-heading">
              <h2 id="recommendations-heading" className="font-serif text-lg font-semibold text-ink-900">
                A good place to begin
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {recommendations.map((recommendation, index) => (
                  <RecommendationCard
                    key={`${recommendation.kind}-${index}`}
                    recommendation={recommendation}
                    onAction={runAction}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <ReadinessPanel readiness={readiness} />
            </Card>

            <Card className="flex flex-col p-5">
              <h2 className="font-serif text-base font-semibold text-ink-900">Today&rsquo;s goal</h2>
              <p className="tabular mt-1.5 text-sm text-ink-600">
                {goalCompleted} of {goalTarget} questions answered today
              </p>
              <ProgressBar
                className="mt-3"
                value={goalCompleted}
                max={goalTarget || 1}
                tone={dailyGoal.met ? 'success' : 'brand'}
                label="Daily question goal"
              />
              <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-500">
                {dailyGoal.met ? (
                  <>
                    <Icon name="check" size={15} className="text-success-600" />
                    You have met today&rsquo;s goal. Anything further is a bonus.
                  </>
                ) : (
                  <>
                    <Icon name="target" size={15} className="text-brand-600" />
                    {plural(Math.max(0, goalTarget - goalCompleted), 'question')} to go.
                  </>
                )}
              </p>
              <div className="mt-auto pt-4">
                <Button
                  fullWidth
                  onClick={() => startDailyRevision.run()}
                  loading={startDailyRevision.pending}
                  icon={startDailyRevision.pending ? undefined : <Icon name="play" size={15} />}
                >
                  Start today&rsquo;s revision
                </Button>
                <p className="mt-2 text-center text-xs text-ink-400">
                  Ten questions: things you have missed, weak areas, and a few new ones.
                </p>
              </div>
            </Card>
          </div>

          <section aria-label="Your figures so far" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Questions answered"
              value={overview.questionsAnswered ?? 0}
              sublabel={`${overview.distinctQuestions ?? 0} different questions`}
              icon={<Icon name="quiz" size={14} />}
            />
            <StatTile
              label="Accuracy"
              value={overview.questionsAnswered ? percent(overview.accuracy) : '—'}
              sublabel={`${overview.correct ?? 0} correct, ${overview.incorrect ?? 0} incorrect`}
              tone={overview.questionsAnswered ? masteryTone((overview.accuracy || 0) * 100) : 'neutral'}
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
              sublabel={`${overview.theoryAnswers ?? 0} theory answers written`}
              icon={<Icon name="clock" size={14} />}
            />
          </section>

          {recommendations.length > 0 && (
            <section aria-labelledby="recommendations-heading">
              <h2 id="recommendations-heading" className="font-serif text-lg font-semibold text-ink-900">
                What to do next
              </h2>
              <p className="mt-1 text-sm text-ink-500">Drawn from your own results, most pressing first.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {recommendations.map((recommendation, index) => (
                  <RecommendationCard
                    key={`${recommendation.kind}-${index}`}
                    recommendation={recommendation}
                    onAction={runAction}
                  />
                ))}
              </div>
            </section>
          )}

          {narrative?.sentence && (
            <Card className="border-l-4 border-l-brand-600 p-5">
              <p className="font-serif text-lg leading-relaxed text-ink-900">{narrative.sentence}</p>
              {narrative.strongest && narrative.weakest && (
                <p className="tabular mt-2 text-sm text-ink-500">
                  {narrative.strongest.subject} sits at {narrative.strongest.mastery}% mastery;{' '}
                  {narrative.weakest.subject} at {narrative.weakest.mastery}%.
                </p>
              )}
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Progress by paper"
                subtitle="How far through each paper you are"
                icon={<Icon name="book" size={18} />}
                action={
                  <Button as={Link} to="/progress" variant="ghost" size="sm">
                    Full analysis
                  </Button>
                }
              />
              <SubjectProgressList
                subjects={subjects}
                emptyAction={
                  <Button as={Link} to="/study" size="sm">
                    Open the study library
                  </Button>
                }
              />
            </Card>

            <div className="space-y-6">
              <TopicList
                title="Topics to strengthen"
                subtitle="Lowest measured mastery"
                icon="target"
                topics={weakTopics}
                tone="warning"
                emptyMessage="Answer a few more questions and the topics needing work will be listed here."
              />
              <TopicList
                title="Your strongest topics"
                subtitle="Highest measured mastery"
                icon="award"
                topics={strongTopics}
                tone="success"
                emptyMessage="Strong topics appear once you have answered enough questions on them."
              />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="The last fourteen days"
                subtitle="Questions answered each day"
                icon={<Icon name="chart" size={18} />}
              />
              <div className="p-5">
                <ActivityChart data={activity} days={14} />
              </div>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader title="Recent activity" icon={<Icon name="clock" size={18} />} />
                {recentActivity.length ? (
                  <ul className="divide-y divide-paper-200">
                    {recentActivity.map((event, index) => (
                      <li key={`${event.kind}-${event.at}-${index}`} className="flex items-start gap-3 px-5 py-3">
                        <span className="mt-0.5 text-ink-400">
                          <Icon name={event.kind === 'mock' ? 'exam' : 'quiz'} size={16} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink-800">{event.title}</p>
                          <p className="tabular text-xs text-ink-500">
                            {event.detail} · {relativeTime(event.at)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-5 py-6 text-sm text-ink-500">
                    Nothing recorded yet. Your completed quizzes and mock examinations will be listed here.
                  </p>
                )}
              </Card>

              <Card>
                <CardHeader
                  title="Achievements"
                  subtitle={`${achievements.points ?? 0} points earned`}
                  icon={<Icon name="award" size={18} />}
                  action={
                    <Button as={Link} to="/progress" variant="ghost" size="sm">
                      See all
                    </Button>
                  }
                />
                {achievements.earned?.length ? (
                  <ul className="divide-y divide-paper-200">
                    {achievements.earned.map((achievement) => (
                      <li
                        key={`${achievement.code}-${achievement.context || ''}`}
                        className="flex items-start gap-3 px-5 py-3"
                      >
                        <span className="mt-0.5 text-gold-600">
                          <Icon name={achievement.icon || 'award'} size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink-800">{achievement.title}</p>
                          <p className="tabular text-xs text-ink-500">
                            {achievement.context ? `${achievement.context} · ` : ''}
                            {relativeTime(achievement.earnedAt)} · {achievement.points} points
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-5 py-6 text-sm text-ink-500">
                    None yet. The first arrives when you complete your first quiz.
                  </p>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- greeting --- */

function Greeting({ greeting, overallProgress, daysUntilExam, examDate, streak, isNewCandidate }) {
  const name = greeting.name || 'friend';
  const partOfDay = greeting.partOfDay || 'day';
  const stage = greeting.examShortName || greeting.examName;

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-serif text-2xl font-semibold text-ink-900 sm:text-3xl">
          Good {partOfDay}, {name}.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
          {isNewCandidate ? (
            <>
              You have not begun your {stage ? `${stage} ` : ''}preparation yet. Everything below is here when you are
              ready.
            </>
          ) : (
            <>
              You have completed {overallProgress}% of the {stage ? `${stage} ` : ''}syllabus so far.
            </>
          )}{' '}
          {daysUntilExam != null ? (
            <span className="font-medium text-ink-800">
              {daysUntilExam > 0
                ? `Your examination is ${plural(daysUntilExam, 'day')} away${examDate ? ` — ${formatDate(examDate)}.` : '.'}`
                : daysUntilExam === 0
                  ? 'Your examination is today. Go steadily.'
                  : `Your examination date has passed${examDate ? ` (${formatDate(examDate)})` : ''}. Update it in your profile.`}
            </span>
          ) : (
            <Link to="/profile" className="font-medium text-brand-700 underline underline-offset-2">
              Set your examination date in your profile to see a countdown.
            </Link>
          )}
        </p>
      </div>

      <div className="shrink-0">
        {streak.current > 0 ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-flame-200 bg-flame-50 px-4 py-3">
            <Icon name="flame" size={22} className="text-flame-600" />
            <div className="leading-tight">
              <p className="tabular font-serif text-lg font-semibold text-ink-900">
                {plural(streak.current, 'day')}
              </p>
              <p className="text-xs text-ink-500">
                Current streak{streak.longest > streak.current ? ` · best ${streak.longest}` : ''}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-xl border border-paper-300 bg-white px-4 py-3">
            <Icon name="flame" size={22} className="text-ink-400" />
            <div className="leading-tight">
              <p className="font-serif text-sm font-semibold text-ink-800">No streak yet</p>
              <p className="text-xs text-ink-500">Study today to begin one.</p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

/* -------------------------------------------------------- getting started --- */

function GettingStarted() {
  const steps = [
    {
      icon: 'book',
      title: 'Read a topic',
      body: 'The syllabus is set out chapter by chapter, with the scripture references beside each topic.',
      to: '/study',
      label: 'Open the study library',
    },
    {
      icon: 'quiz',
      title: 'Try a short quiz',
      body: 'Ten questions is enough to begin. Every answer comes with its explanation and its syllabus reference.',
      to: '/quiz',
      label: 'Set up a quiz',
    },
    {
      icon: 'settings',
      title: 'Set your examination date',
      body: 'Your countdown, your daily goal and your revision plan all follow from it.',
      to: '/profile',
      label: 'Go to your profile',
    },
  ];

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-serif text-lg font-semibold text-ink-900">Getting started</h2>
      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-600">
        Your progress, readiness and recommendations are built from your own work, so there is nothing to show yet.
        Three small steps will fill this page.
      </p>
      <ul className="mt-5 grid gap-4 sm:grid-cols-3">
        {steps.map((step) => (
          <li key={step.to} className="rounded-xl border border-paper-300 bg-paper-50 p-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
              <Icon name={step.icon} size={18} />
            </span>
            <h3 className="mt-3 font-serif text-sm font-semibold text-ink-900">{step.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">{step.body}</p>
            <Button as={Link} to={step.to} variant="secondary" size="sm" className="mt-3">
              {step.label}
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ------------------------------------------------------------ topic lists --- */

function TopicList({ title, subtitle, icon, topics, tone, emptyMessage }) {
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
                  {Math.round(topic.mastery || 0)}%
                </Badge>
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

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your dashboard…</span>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="w-full max-w-xl">
          <Skeleton className="h-8 w-64" />
          <div className="mt-3">
            <SkeletonText lines={2} />
          </div>
        </div>
        <Skeleton className="h-16 w-40" rounded="rounded-xl" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
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
                <Skeleton className="mt-2 h-3 w-24" rounded="rounded" />
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-3 h-3.5 w-40" rounded="rounded" />
          <Skeleton className="mt-3 h-2 w-full" rounded="rounded-full" />
          <Skeleton className="mt-8 h-10 w-full" />
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" rounded="rounded-xl" />
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-36 w-full" rounded="rounded-xl" />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 w-full lg:col-span-2" rounded="rounded-xl" />
        <Skeleton className="h-72 w-full" rounded="rounded-xl" />
      </div>
    </div>
  );
}
