import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { contentApi, quizApi } from '@/services/api';
import { useAsync, useDocumentTitle } from '@/hooks';
import { useAuth } from '@/context/AuthContext';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  EmptyState,
  ErrorState,
  Icon,
  Select,
  Skeleton,
  Spinner,
  cx,
} from '@/components/ui';

/**
 * Choosing what to practise.
 *
 * Most sessions should begin with one click, so the modes that already know
 * what the candidate needs come first and the manual controls sit beneath them
 * for the times a candidate wants something specific.
 */

const MODES = [
  {
    mode: 'daily_revision',
    icon: 'sprout',
    title: 'Daily revision',
    description:
      'A short set drawn from what you are due to review, weighted towards the questions you keep forgetting.',
    meta: 'Best if you only have ten minutes',
    tone: 'brand',
  },
  {
    mode: 'weak_areas',
    icon: 'target',
    title: 'Weak areas',
    description: 'Questions taken from the topics where your accuracy is lowest, so your effort goes where it counts.',
    meta: 'Built from your own results',
    tone: 'flame',
  },
  {
    mode: 'mistakes',
    icon: 'refresh',
    title: 'My mistakes',
    description: 'The questions you have answered wrongly before. Putting them right is the fastest progress there is.',
    meta: 'Repeats until you get them right',
    tone: 'warning',
  },
  {
    mode: 'bookmarks',
    icon: 'bookmark',
    title: 'Bookmarked questions',
    description: 'Everything you have saved to come back to, gathered into one set.',
    meta: 'Only what you have saved',
    tone: 'gold',
  },
  {
    mode: 'unseen',
    icon: 'eye',
    title: "Questions I've never seen",
    description: 'Fresh questions you have not attempted before, for an honest test of what you actually know.',
    meta: 'Nothing you have met already',
    tone: 'neutral',
  },
  {
    mode: 'practice',
    icon: 'quiz',
    title: 'General practice',
    description: 'A mixed set drawn from across the whole syllabus for your examination stage.',
    meta: 'A little of everything',
    tone: 'brand',
  },
];

const SIZES = [5, 10, 15, 20, 30];

const TONE_CLASSES = {
  brand: 'bg-brand-50 text-brand-700',
  flame: 'bg-flame-50 text-flame-700',
  warning: 'bg-warning-50 text-warning-600',
  gold: 'bg-gold-50 text-gold-700',
  neutral: 'bg-paper-200 text-ink-600',
};

export default function QuizSetupPage() {
  useDocumentTitle('Practice');

  const navigate = useNavigate();
  const { user } = useAuth();

  const [pending, setPending] = useState(null);
  const [createError, setCreateError] = useState(null);

  const [subjectId, setSubjectId] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [size, setSize] = useState(10);
  const [includeTheory, setIncludeTheory] = useState(false);

  const subjects = useAsync(() => contentApi.subjects(), []);
  const detail = useAsync(() => (subjectId ? contentApi.subject(subjectId) : Promise.resolve(null)), [subjectId]);

  const chapters = detail.data?.chapters || [];
  const topics = useMemo(() => {
    if (!chapters.length) return [];
    if (chapterId) return chapters.find((chapter) => chapter._id === chapterId)?.topics || [];
    return chapters.flatMap((chapter) => chapter.topics || []);
  }, [chapters, chapterId]);

  const start = async (key, payload) => {
    setCreateError(null);
    setPending(key);
    try {
      const response = await quizApi.create(payload);
      navigate(`/quiz/${response.quiz.id}`, {
        state: { quiz: response.quiz, questions: response.questions, notice: response.notice || null },
      });
    } catch (error) {
      setCreateError(error);
      // Bring the message into view rather than leaving it above the fold.
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setPending(null);
    }
  };

  const onSubmitCustom = (event) => {
    event.preventDefault();
    start('custom', {
      mode: topicId ? 'topic_quiz' : 'practice',
      subject: subjectId || undefined,
      chapter: chapterId || undefined,
      topic: topicId || undefined,
      difficulty: difficulty || undefined,
      size,
      includeTheory,
    });
  };

  const subjectList = subjects.data?.subjects || [];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-2xl font-semibold text-ink-900 sm:text-3xl">Practise</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-600">
          Every answer comes back with the reason behind it and the place in the syllabus it is drawn from. Choose a
          ready-made set, or build one of your own.
        </p>
      </header>

      {createError && (
        <div className="flex items-start gap-3 rounded-xl border border-warning-500 bg-warning-50 p-4" role="alert">
          <Icon name="alert" size={20} className="mt-0.5 shrink-0 text-warning-600" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-warning-600">We could not build that set</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-700">{createError.message}</p>
            <button
              type="button"
              onClick={() => setCreateError(null)}
              className="mt-2 text-sm font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* One-click sets */}
      <section aria-labelledby="ready-made">
        <h2 id="ready-made" className="mb-3 font-serif text-lg font-semibold text-ink-900">
          Start straight away
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODES.map((entry) => (
            <li key={entry.mode}>
              <button
                type="button"
                onClick={() => start(entry.mode, { mode: entry.mode, size: 10 })}
                disabled={Boolean(pending)}
                aria-busy={pending === entry.mode || undefined}
                className={cx(
                  'card card-hover flex h-full w-full flex-col items-start gap-2 p-5 text-left transition-colors',
                  'hover:border-brand-300 disabled:cursor-wait disabled:opacity-70',
                )}
              >
                <span className={cx('flex h-10 w-10 items-center justify-center rounded-xl', TONE_CLASSES[entry.tone])}>
                  {pending === entry.mode ? <Spinner size={18} /> : <Icon name={entry.icon} size={20} />}
                </span>
                <span className="font-serif text-base font-semibold text-ink-900">{entry.title}</span>
                <span className="text-sm leading-relaxed text-ink-600">{entry.description}</span>
                <span className="mt-auto flex items-center gap-2 pt-2 text-xs font-medium text-ink-400">
                  <Badge tone="outline" size="sm">
                    10 questions
                  </Badge>
                  {entry.meta}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Build your own */}
      <section aria-labelledby="build-your-own">
        <Card as="form" onSubmit={onSubmitCustom} noValidate>
          <CardHeader
            title="Build your own"
            subtitle="Narrow the set down to exactly what you want to work on."
            icon={<Icon name="filter" size={18} />}
          />

          <div className="space-y-5 p-5">
            {subjects.loading && !subjects.data && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="space-y-2">
                    <Skeleton className="h-3.5 w-24" rounded="rounded" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            )}

            {subjects.error && <ErrorState error={subjects.error} onRetry={subjects.reload} />}

            {!subjects.loading && !subjects.error && subjectList.length === 0 && (
              <EmptyState
                icon="book"
                title="No subjects are published yet"
                message="Once the syllabus for your examination stage has been published you will be able to filter by subject here. The ready-made sets above still work."
                action={
                  <Button variant="secondary" onClick={() => start('practice', { mode: 'practice', size: 10 })}>
                    Start a general practice set
                  </Button>
                }
              />
            )}

            {!subjects.error && subjectList.length > 0 && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Select
                    label="Subject"
                    value={subjectId}
                    onChange={(event) => {
                      setSubjectId(event.target.value);
                      setChapterId('');
                      setTopicId('');
                    }}
                  >
                    <option value="">Any subject</option>
                    {subjectList.map((subject) => (
                      <option key={subject._id} value={subject._id}>
                        {subject.name}
                      </option>
                    ))}
                  </Select>

                  <Select
                    label="Chapter"
                    value={chapterId}
                    disabled={!subjectId || detail.loading}
                    hint={!subjectId ? 'Choose a subject first' : undefined}
                    onChange={(event) => {
                      setChapterId(event.target.value);
                      setTopicId('');
                    }}
                  >
                    <option value="">{detail.loading ? 'Loading chapters…' : 'Any chapter'}</option>
                    {chapters.map((chapter) => (
                      <option key={chapter._id} value={chapter._id}>
                        {chapter.number ? `${chapter.number}. ` : ''}
                        {chapter.title}
                      </option>
                    ))}
                  </Select>

                  <Select
                    label="Topic"
                    value={topicId}
                    disabled={!subjectId || detail.loading}
                    hint={!subjectId ? 'Choose a subject first' : undefined}
                    onChange={(event) => setTopicId(event.target.value)}
                  >
                    <option value="">{detail.loading ? 'Loading topics…' : 'Any topic'}</option>
                    {topics.map((topic) => (
                      <option key={topic._id} value={topic._id}>
                        {topic.title}
                      </option>
                    ))}
                  </Select>
                </div>

                {detail.error && (
                  <p className="flex items-center gap-1.5 text-sm text-danger-600" role="alert">
                    <Icon name="alert" size={14} />
                    {detail.error.message}{' '}
                    <button type="button" onClick={detail.reload} className="underline underline-offset-2">
                      Try again
                    </button>
                  </p>
                )}

                <div className="grid gap-5 sm:grid-cols-2">
                  <Select label="Difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
                    <option value="">Any difficulty</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </Select>

                  <fieldset>
                    <legend className="mb-1.5 block text-sm font-medium text-ink-700">Number of questions</legend>
                    <div className="flex flex-wrap gap-2">
                      {SIZES.map((option) => (
                        <label
                          key={option}
                          className={cx(
                            'cursor-pointer rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors',
                            'focus-within:ring-2 focus-within:ring-brand-500/30',
                            size === option
                              ? 'border-brand-600 bg-brand-50 text-brand-800'
                              : 'border-paper-300 bg-white text-ink-600 hover:border-brand-300',
                          )}
                        >
                          <input
                            type="radio"
                            name="quiz-size"
                            value={option}
                            checked={size === option}
                            onChange={() => setSize(option)}
                            className="sr-only"
                          />
                          {option}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>

                <div className="rounded-xl border border-paper-300 bg-paper-50 p-4">
                  <Checkbox
                    label="Include theory questions"
                    description="Theory answers are marked against the examiner's rubric, criterion by criterion, and you will see exactly which points you covered and which you missed. They take longer than objective questions."
                    checked={includeTheory}
                    onChange={(event) => setIncludeTheory(event.target.checked)}
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-paper-200 bg-paper-50 px-5 py-4">
            <p className="text-xs leading-relaxed text-ink-500">
              {user?.examStage?.shortName
                ? `Questions are drawn from ${user.examStage.shortName}.`
                : 'Questions are drawn from the examination stage on your profile.'}
            </p>
            <Button
              type="submit"
              loading={pending === 'custom'}
              disabled={Boolean(pending) || subjectList.length === 0}
              iconRight={<Icon name="chevronRight" size={15} strokeStyle />}
            >
              Start this set
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
}
