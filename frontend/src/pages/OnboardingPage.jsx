import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { contentApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useAction, useAsync, useDocumentTitle } from '@/hooks';
import { Badge, Button, EmptyState, ErrorState, Icon, Input, ProgressBar, Skeleton, cx } from '@/components/ui';
import { CrossFlame } from '@/layouts/AppLayout';
import { minutesLabel } from '@/utils/format';

const DEFAULT_DAILY_GOAL = 20;
const MIN_DAILY_GOAL = 5;
const MAX_DAILY_GOAL = 200;

/** Today, as the value a `<input type="date">` expects. */
function todayIsoDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

/**
 * Seeded stages exist before their question banks do. Where the description
 * says so, the stage stays choosable but the candidate is told plainly.
 */
function contentNotLoaded(exam) {
  return /not been loaded|not yet been loaded|no content (has )?been loaded/i.test(exam?.description || '');
}

function StageCard({ exam, checked, onChange }) {
  const blueprint = exam.paperBlueprint || {};
  const pending = contentNotLoaded(exam);

  return (
    <label className="relative block cursor-pointer">
      <input
        type="radio"
        name="examStage"
        value={exam._id}
        checked={checked}
        onChange={() => onChange(exam._id)}
        className="peer sr-only"
      />
      <span
        className={cx(
          'block h-full rounded-xl border-2 bg-white p-5 transition-colors sm:p-6',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2',
          checked ? 'border-brand-600 bg-brand-50/50' : 'border-paper-300 hover:border-brand-300',
        )}
      >
        <span className="flex items-start justify-between gap-3">
          <span className="block min-w-0">
            <span className="block font-serif text-lg font-semibold text-ink-900">{exam.name}</span>
            {exam.programme && <span className="mt-0.5 block text-xs text-ink-400">{exam.programme}</span>}
          </span>
          <span
            className={cx(
              'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
              checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-paper-400 bg-white text-transparent',
            )}
            aria-hidden="true"
          >
            <Icon name="check" size={14} />
          </span>
        </span>

        {exam.description && (
          <span className="mt-3 block text-sm leading-relaxed text-ink-600">{exam.description}</span>
        )}

        <span className="mt-4 flex flex-wrap items-center gap-1.5">
          {exam.shortName && (
            <Badge tone="outline" size="sm">
              {exam.shortName}
            </Badge>
          )}
          <Badge tone={exam.hasTheoryPaper ? 'brand' : 'neutral'} size="sm" icon={<Icon name={exam.hasTheoryPaper ? 'pen' : 'quiz'} size={12} />}>
            {exam.hasTheoryPaper ? 'Objective and theory papers' : 'Objective questions only'}
          </Badge>
        </span>

        <span className="mt-4 block border-t border-paper-200 pt-4">
          <span className="block text-xs font-medium uppercase tracking-wide text-ink-400">Paper blueprint</span>
          <span className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-ink-700 sm:grid-cols-3">
            <span className="block">
              <span className="block text-xs text-ink-400">Duration</span>
              <span className="tabular block font-medium">{minutesLabel(blueprint.durationMinutes)}</span>
            </span>
            <span className="block">
              <span className="block text-xs text-ink-400">Section A</span>
              <span className="tabular block font-medium">{blueprint.objectiveCount ?? 0} objective</span>
            </span>
            <span className="block">
              <span className="block text-xs text-ink-400">Section B</span>
              <span className="tabular block font-medium">
                {blueprint.theoryQuestionsOffered
                  ? `${blueprint.theoryQuestionsToAnswer ?? 0} of ${blueprint.theoryQuestionsOffered} theory`
                  : 'None'}
              </span>
            </span>
          </span>
        </span>

        {pending && (
          <span className="mt-4 flex items-start gap-2 rounded-lg bg-warning-50 px-3 py-2 text-xs leading-relaxed text-warning-600">
            <Icon name="info" size={14} className="mt-0.5" />
            <span>
              The question bank for this stage has not been loaded yet. You can still choose it, but there will be
              little to practise until the content is added.
            </span>
          </span>
        )}
      </span>
    </label>
  );
}

export default function OnboardingPage() {
  useDocumentTitle('Set up your preparation');

  const { user, updateProfile, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const { data, error, loading, reload } = useAsync(() => contentApi.exams(), []);
  const exams = useMemo(() => {
    const list = data?.exams || [];
    return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [data]);

  const [step, setStep] = useState(1);
  const [examStage, setExamStage] = useState(() =>
    typeof user?.examStage === 'object' && user?.examStage ? user.examStage._id || '' : user?.examStage || '',
  );
  const [examDate, setExamDate] = useState(() => (user?.examDate ? String(user.examDate).slice(0, 10) : ''));
  const [dailyGoal, setDailyGoal] = useState(() => String(user?.preferences?.dailyQuestionGoal ?? DEFAULT_DAILY_GOAL));
  const [stepError, setStepError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const { run: save, pending, error: saveError } = useAction(updateProfile);

  const chosen = exams.find((exam) => exam._id === examStage) || null;
  const today = todayIsoDate();

  const goToDetails = () => {
    if (!examStage) {
      setStepError('Please choose the examination you are preparing for.');
      return;
    }
    setStepError(null);
    setStep(2);
  };

  const onSubmit = async (event) => {
    event.preventDefault();

    const nextErrors = {};
    if (examDate && examDate < today) nextErrors.examDate = 'Please choose today or a date in the future';

    const goalNumber = dailyGoal.trim() === '' ? DEFAULT_DAILY_GOAL : Number(dailyGoal);
    if (!Number.isInteger(goalNumber) || goalNumber < MIN_DAILY_GOAL || goalNumber > MAX_DAILY_GOAL) {
      nextErrors.dailyGoal = `Choose a whole number between ${MIN_DAILY_GOAL} and ${MAX_DAILY_GOAL}`;
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      await save({
        examStage,
        examDate: examDate || null,
        preferences: { dailyQuestionGoal: goalNumber },
      });
      toast.success('You are all set. Your dashboard is ready.', { title: 'Preparation set up' });
      navigate('/dashboard', { replace: true });
    } catch {
      // Rendered from `saveError` below.
    }
  };

  const signOut = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-paper-100">
      <header className="border-b border-paper-300 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center gap-3 px-4 sm:px-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-800 text-paper-50">
            <CrossFlame />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block font-serif text-sm font-semibold text-ink-900">Lay Preachers</span>
            <span className="block text-[11px] uppercase tracking-wide text-ink-400">Setting up</span>
          </span>
          <Button variant="ghost" size="sm" onClick={signOut} icon={<Icon name="logout" size={15} />}>
            Sign out
          </Button>
        </div>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        {/* ------------------------------------------------------- progress */}
        <div className="mb-8">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-ink-600">Step {step} of 2</p>
            <p className="text-sm text-ink-400">{step === 1 ? 'Your examination' : 'Your date and pace'}</p>
          </div>
          <ProgressBar value={step} max={2} className="mt-2" />
          <ol className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-400">
            <li className={cx(step >= 1 && 'font-medium text-brand-700')}>1. Choose your examination</li>
            <li className={cx(step >= 2 && 'font-medium text-brand-700')}>2. Date and daily goal</li>
          </ol>
        </div>

        {/* --------------------------------------------------------- step 1 */}
        {step === 1 && (
          <section aria-labelledby="stage-heading">
            <h1 id="stage-heading" className="font-serif text-2xl font-semibold text-ink-900 sm:text-3xl">
              Which examination are you preparing for?
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-600">
              Everything you study, practise and sit is scoped to the stage you choose here. You can change it later
              from your profile without losing your progress.
            </p>

            {loading && (
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div key={index} className="rounded-xl border-2 border-paper-300 bg-white p-5 sm:p-6">
                    <Skeleton className="h-5 w-2/3" rounded="rounded" />
                    <Skeleton className="mt-3 h-3 w-full" rounded="rounded" />
                    <Skeleton className="mt-2 h-3 w-5/6" rounded="rounded" />
                    <Skeleton className="mt-4 h-6 w-40" rounded="rounded-full" />
                    <Skeleton className="mt-5 h-12 w-full" rounded="rounded" />
                  </div>
                ))}
              </div>
            )}

            {!loading && error && <ErrorState error={error} onRetry={reload} className="mt-6 card" />}

            {!loading && !error && exams.length === 0 && (
              <EmptyState
                className="mt-6 card"
                icon="exam"
                title="No examinations are published yet"
                message="There is nothing to choose from at the moment. This usually means the content has not been loaded on the server. Try again shortly, or ask your administrator."
                action={
                  <Button variant="secondary" onClick={reload} icon={<Icon name="refresh" size={15} />}>
                    Try again
                  </Button>
                }
              />
            )}

            {!loading && !error && exams.length > 0 && (
              <>
                <fieldset className="mt-8">
                  <legend className="sr-only">Choose the examination you are preparing for</legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {exams.map((exam) => (
                      <StageCard
                        key={exam._id}
                        exam={exam}
                        checked={examStage === exam._id}
                        onChange={(id) => {
                          setExamStage(id);
                          setStepError(null);
                        }}
                      />
                    ))}
                  </div>
                </fieldset>

                {stepError && (
                  <p role="alert" className="mt-5 flex items-center gap-2 text-sm text-danger-600">
                    <Icon name="alert" size={15} />
                    {stepError}
                  </p>
                )}

                <div className="mt-8 flex justify-end">
                  <Button
                    size="lg"
                    onClick={goToDetails}
                    disabled={!examStage}
                    iconRight={<Icon name="chevronRight" size={16} strokeStyle />}
                  >
                    Continue
                  </Button>
                </div>
              </>
            )}
          </section>
        )}

        {/* --------------------------------------------------------- step 2 */}
        {step === 2 && (
          <section aria-labelledby="details-heading">
            <h1 id="details-heading" className="font-serif text-2xl font-semibold text-ink-900 sm:text-3xl">
              When do you sit, and how much will you do each day?
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-600">
              Both of these are optional, and both can be changed at any time. They only shape the pacing we suggest.
            </p>

            {chosen && (
              <p className="mt-6 flex flex-wrap items-center gap-2 rounded-lg border border-paper-300 bg-white px-4 py-3 text-sm text-ink-600">
                <Icon name="check" size={16} className="text-success-600" />
                <span>
                  Preparing for <span className="font-medium text-ink-900">{chosen.name}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="ml-auto rounded font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
                >
                  Change
                </button>
              </p>
            )}

            <form onSubmit={onSubmit} noValidate className="mt-7 max-w-xl space-y-6">
              {saveError && (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-danger-500 bg-danger-50 px-3.5 py-2.5 text-sm text-danger-600"
                >
                  <Icon name="alert" size={16} className="mt-0.5" />
                  <span>{saveError.message || 'We could not save your choices just now. Please try again.'}</span>
                </p>
              )}

              <Input
                label="Examination date (optional)"
                type="date"
                name="examDate"
                min={today}
                value={examDate}
                onChange={(event) => {
                  setExamDate(event.target.value);
                  setFieldErrors((current) => ({ ...current, examDate: undefined }));
                }}
                error={fieldErrors.examDate}
                hint="Used for the countdown on your dashboard and to pace your revision. Leave it blank if you do not know it yet."
              />

              <Input
                label="Daily question goal"
                type="number"
                name="dailyGoal"
                inputMode="numeric"
                min={MIN_DAILY_GOAL}
                max={MAX_DAILY_GOAL}
                step={1}
                value={dailyGoal}
                onChange={(event) => {
                  setDailyGoal(event.target.value);
                  setFieldErrors((current) => ({ ...current, dailyGoal: undefined }));
                }}
                error={fieldErrors.dailyGoal}
                hint={`How many questions you aim to answer each day. ${DEFAULT_DAILY_GOAL} is a steady pace; anything from ${MIN_DAILY_GOAL} to ${MAX_DAILY_GOAL} is allowed. A goal you can keep is worth more than one you cannot, and you are not penalised for missing it.`}
              />

              <div className="flex flex-col gap-3 pt-2 sm:flex-row-reverse sm:justify-start">
                <Button type="submit" size="lg" loading={pending} disabled={pending}>
                  {pending ? 'Saving…' : 'Start preparing'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  onClick={() => setStep(1)}
                  disabled={pending}
                  icon={<Icon name="chevronLeft" size={16} strokeStyle />}
                >
                  Back
                </Button>
              </div>
            </form>
          </section>
        )}

        <p className="mt-12 border-t border-paper-300 pt-5 text-xs leading-relaxed text-ink-400">
          Study material is reproduced from the official Methodist Church Ghana Lay Preachers&rsquo; syllabus for the
          personal use of candidates. Always check the printed syllabus before an examination.
        </p>
      </main>
    </div>
  );
}
