import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  ErrorState,
  Icon,
  Input,
  Select,
  Skeleton,
  SkeletonText,
} from '@/components/ui';
import { authApi, contentApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useAction, useAsync, useDocumentTitle } from '@/hooks';
import { formatDate, plural } from '@/utils/format';

/** A short list of the zones candidates actually sit in, plus whatever theirs is. */
const TIMEZONES = [
  'Africa/Accra',
  'Africa/Abidjan',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Africa/Johannesburg',
  'Europe/London',
  'Europe/Amsterdam',
  'America/New_York',
  'America/Toronto',
];

export default function ProfilePage() {
  useDocumentTitle('Profile and settings');

  const { user } = useAuth();

  if (!user) return <ProfileSkeleton />;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <h1 className="font-serif text-2xl font-semibold text-ink-900 sm:text-3xl">Profile and settings</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          Your details, the examination you are preparing for, and how the platform behaves while you study. Each
          section saves on its own.
        </p>
      </header>

      <ProfileDetailsSection user={user} />
      <ExaminationSection user={user} />
      <PreferencesSection user={user} />
      <PasswordSection />
      <AccountSummary user={user} />
    </div>
  );
}

/* ------------------------------------------------------- profile details --- */

function ProfileDetailsSection({ user }) {
  const { updateProfile } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState({
    name: user.name || '',
    diocese: user.diocese || '',
    circuit: user.circuit || '',
    society: user.society || '',
    timezone: user.timezone || 'Africa/Accra',
  });
  const [nameError, setNameError] = useState(null);

  const timezones = useMemo(
    () => (TIMEZONES.includes(form.timezone) || !form.timezone ? TIMEZONES : [form.timezone, ...TIMEZONES]),
    [form.timezone],
  );

  const save = useAction(async () => {
    if (form.name.trim().length < 2) {
      setNameError('Please enter your full name.');
      return;
    }
    setNameError(null);
    await updateProfile({
      name: form.name.trim(),
      diocese: form.diocese.trim(),
      circuit: form.circuit.trim(),
      society: form.society.trim(),
      timezone: form.timezone,
    });
    toast.success('Your details have been saved.');
  });

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <Card as="section" aria-label="Your details">
      <CardHeader
        title="Your details"
        subtitle="How you are named and where you preach"
        icon={<Icon name="user" size={18} />}
      />
      <form
        className="space-y-4 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          save.run().catch((err) => toast.error(err?.message || 'We could not save your details.'));
        }}
      >
        <Input label="Full name" value={form.name} onChange={set('name')} required error={nameError} autoComplete="name" />

        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Diocese" value={form.diocese} onChange={set('diocese')} autoComplete="off" />
          <Input label="Circuit" value={form.circuit} onChange={set('circuit')} autoComplete="off" />
          <Input label="Society" value={form.society} onChange={set('society')} autoComplete="off" />
        </div>

        <Select
          label="Timezone"
          value={form.timezone}
          onChange={set('timezone')}
          hint="Your streak, your daily goal and your activity chart all use this."
        >
          {timezones.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replace('_', ' ')}
            </option>
          ))}
        </Select>

        {save.error && (
          <p className="text-sm text-danger-600" role="alert">
            {save.error.message}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="submit" loading={save.pending}>
            Save details
          </Button>
        </div>
      </form>
    </Card>
  );
}

/* ----------------------------------------------------------- examination --- */

function ExaminationSection({ user }) {
  const { updateProfile } = useAuth();
  const toast = useToast();

  const currentStageId = user.examStage?._id ? String(user.examStage._id) : user.examStage ? String(user.examStage) : '';

  const { data, error, loading, reload } = useAsync(() => contentApi.exams(), []);
  const exams = data?.exams || [];

  const [stage, setStage] = useState(currentStageId);
  const [examDate, setExamDate] = useState(user.examDate ? String(user.examDate).slice(0, 10) : '');
  const [confirming, setConfirming] = useState(false);

  // Keep the form in step with the account if it is changed elsewhere.
  useEffect(() => {
    setStage(currentStageId);
  }, [currentStageId]);

  useEffect(() => {
    setExamDate(user.examDate ? String(user.examDate).slice(0, 10) : '');
  }, [user.examDate]);

  const stageChanged = Boolean(stage) && stage !== currentStageId;

  const save = useAction(async () => {
    await updateProfile({
      examStage: stage || null,
      examDate: examDate ? new Date(`${examDate}T00:00:00`).toISOString() : null,
    });
    toast.success('Your examination details have been saved.');
  });

  const submit = () => {
    setConfirming(false);
    save.run().catch((err) => toast.error(err?.message || 'We could not save your examination details.'));
  };

  return (
    <Card as="section" aria-label="Your examination">
      <CardHeader
        title="Your examination"
        subtitle="The stage you are preparing for, and when you sit it"
        icon={<Icon name="exam" size={18} />}
      />

      <form
        className="space-y-4 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (stageChanged) setConfirming(true);
          else submit();
        }}
      >
        {loading && !data ? (
          <div>
            <Skeleton className="h-3.5 w-32" rounded="rounded" />
            <Skeleton className="mt-2 h-11 w-full" />
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={reload} className="py-6" />
        ) : (
          <Select
            label="Examination stage"
            value={stage}
            onChange={(event) => setStage(event.target.value)}
            hint="Your syllabus, questions and mock papers all come from this stage."
          >
            <option value="">Not chosen yet</option>
            {exams.map((exam) => (
              <option key={exam._id} value={exam._id}>
                {exam.name}
                {exam.shortName && exam.shortName !== exam.name ? ` (${exam.shortName})` : ''}
              </option>
            ))}
          </Select>
        )}

        {stageChanged && (
          <p className="flex items-start gap-2 rounded-lg border border-warning-500 bg-warning-50 p-3 text-sm leading-relaxed text-warning-600">
            <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
            <span>
              Progress is tracked separately for each stage. Changing stage does not delete anything, but your
              readiness, streak targets and topic progress for this stage will no longer be shown until you change
              back.
            </span>
          </p>
        )}

        <Input
          type="date"
          label="Examination date"
          value={examDate}
          onChange={(event) => setExamDate(event.target.value)}
          hint="Leave this empty if the date has not been announced. Your countdown and revision plan follow from it."
        />

        {save.error && (
          <p className="text-sm text-danger-600" role="alert">
            {save.error.message}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="submit" loading={save.pending} disabled={loading && !data}>
            Save examination details
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirming}
        onCancel={() => setConfirming(false)}
        onConfirm={submit}
        title="Change your examination stage?"
        confirmLabel="Change stage"
        loading={save.pending}
        message="Progress is tracked per stage. Your work on the current stage is kept, but the dashboard, readiness and study library will all switch to the new stage."
      />
    </Card>
  );
}

/* ----------------------------------------------------------- preferences --- */

function PreferencesSection({ user }) {
  const { updateProfile } = useAuth();
  const toast = useToast();
  const preferences = user.preferences || {};

  const [form, setForm] = useState({
    dailyQuestionGoal: preferences.dailyQuestionGoal ?? 20,
    dailyStudyMinutesGoal: preferences.dailyStudyMinutesGoal ?? 30,
    voiceAnswersEnabled: preferences.voiceAnswersEnabled ?? true,
    soundEffectsEnabled: preferences.soundEffectsEnabled ?? true,
    reducedMotion: preferences.reducedMotion ?? false,
  });
  const [errors, setErrors] = useState({});

  const save = useAction(async () => {
    const questions = Number(form.dailyQuestionGoal);
    const minutes = Number(form.dailyStudyMinutesGoal);
    const nextErrors = {};
    if (!Number.isFinite(questions) || questions < 5 || questions > 200) {
      nextErrors.dailyQuestionGoal = 'Choose between 5 and 200 questions.';
    }
    if (!Number.isFinite(minutes) || minutes < 5 || minutes > 480) {
      nextErrors.dailyStudyMinutesGoal = 'Choose between 5 and 480 minutes.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    await updateProfile({
      preferences: {
        dailyQuestionGoal: Math.round(questions),
        dailyStudyMinutesGoal: Math.round(minutes),
        voiceAnswersEnabled: form.voiceAnswersEnabled,
        soundEffectsEnabled: form.soundEffectsEnabled,
        reducedMotion: form.reducedMotion,
      },
    });
    toast.success('Your preferences have been saved.');
  });

  const setNumber = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const setFlag = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.checked }));

  return (
    <Card as="section" aria-label="Preferences">
      <CardHeader
        title="Preferences"
        subtitle="Your daily targets and how the platform behaves"
        icon={<Icon name="settings" size={18} />}
      />
      <form
        className="space-y-5 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          save.run().catch((err) => toast.error(err?.message || 'We could not save your preferences.'));
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="number"
            inputMode="numeric"
            min={5}
            max={200}
            step={1}
            label="Daily question goal"
            value={form.dailyQuestionGoal}
            onChange={setNumber('dailyQuestionGoal')}
            error={errors.dailyQuestionGoal}
            hint="Shown on your dashboard as today's goal."
          />
          <Input
            type="number"
            inputMode="numeric"
            min={5}
            max={480}
            step={5}
            label="Daily study minutes goal"
            value={form.dailyStudyMinutesGoal}
            onChange={setNumber('dailyStudyMinutesGoal')}
            error={errors.dailyStudyMinutesGoal}
            hint="How long you intend to read the syllabus each day."
          />
        </div>

        <fieldset className="space-y-3">
          <legend className="mb-1 text-sm font-medium text-ink-700">While you study</legend>
          <Checkbox
            label="Voice answers"
            description="Dictate theory answers instead of typing them, where your browser supports it."
            checked={form.voiceAnswersEnabled}
            onChange={setFlag('voiceAnswersEnabled')}
          />
          <Checkbox
            label="Sound effects"
            description="A quiet tone when an answer is marked."
            checked={form.soundEffectsEnabled}
            onChange={setFlag('soundEffectsEnabled')}
          />
          <Checkbox
            label="Reduced motion"
            description="Remove animation and transitions throughout the platform."
            checked={form.reducedMotion}
            onChange={setFlag('reducedMotion')}
          />
        </fieldset>

        {save.error && (
          <p className="text-sm text-danger-600" role="alert">
            {save.error.message}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="submit" loading={save.pending}>
            Save preferences
          </Button>
        </div>
      </form>
    </Card>
  );
}

/* ------------------------------------------------------- change password --- */

function PasswordSection() {
  const { logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});

  const save = useAction(async () => {
    const nextErrors = {};
    if (!form.currentPassword) nextErrors.currentPassword = 'Please enter your current password.';
    if (form.newPassword.length < 8) nextErrors.newPassword = 'Use at least 8 characters.';
    else if (!/[a-zA-Z]/.test(form.newPassword) || !/[0-9]/.test(form.newPassword)) {
      nextErrors.newPassword = 'Include at least one letter and one number.';
    }
    if (form.confirmPassword !== form.newPassword) nextErrors.confirmPassword = 'The two passwords do not match.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    await authApi.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });

    setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    toast.success('Your password has been changed. Please sign in again with your new password.', {
      title: 'Password changed',
      duration: 8000,
    });
    await logout();
    navigate('/login');
  });

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <Card as="section" aria-label="Change your password">
      <CardHeader
        title="Change your password"
        subtitle="You will be signed out of every device afterwards"
        icon={<Icon name="settings" size={18} />}
      />
      <form
        className="space-y-4 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          save.run().catch(() => {
            /* The error is shown beneath the form. */
          });
        }}
      >
        <p className="text-sm leading-relaxed text-ink-600">
          Changing your password ends every signed-in session, including this one. You will be asked to sign in again
          straight away.
        </p>

        <Input
          type="password"
          label="Current password"
          value={form.currentPassword}
          onChange={set('currentPassword')}
          error={errors.currentPassword}
          autoComplete="current-password"
          required
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="password"
            label="New password"
            value={form.newPassword}
            onChange={set('newPassword')}
            error={errors.newPassword}
            hint="At least 8 characters, with a letter and a number."
            autoComplete="new-password"
            required
          />
          <Input
            type="password"
            label="Confirm new password"
            value={form.confirmPassword}
            onChange={set('confirmPassword')}
            error={errors.confirmPassword}
            autoComplete="new-password"
            required
          />
        </div>

        {save.error && (
          <p className="flex items-center gap-1.5 text-sm text-danger-600" role="alert">
            <Icon name="alert" size={15} />
            {save.error.message}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="submit" variant="secondary" loading={save.pending}>
            Change password
          </Button>
        </div>
      </form>
    </Card>
  );
}

/* --------------------------------------------------------------- summary --- */

function AccountSummary({ user }) {
  const streak = user.streak || {};
  const rows = [
    { label: 'Email address', value: user.email },
    { label: 'Role', value: user.role === 'admin' ? 'Administrator' : 'Candidate' },
    { label: 'Member since', value: user.createdAt ? formatDate(user.createdAt) : '—' },
    {
      label: 'Current streak',
      value: (
        <span className="inline-flex items-center gap-1.5">
          <Icon name="flame" size={15} className={streak.current > 0 ? 'text-flame-600' : 'text-ink-400'} />
          {plural(streak.current || 0, 'day')}
          {streak.longest > 0 && (
            <span className="text-ink-500">· best {plural(streak.longest, 'day')}</span>
          )}
        </span>
      ),
    },
  ];

  return (
    <Card as="section" aria-label="Your account">
      <CardHeader title="Your account" subtitle="For reference — these are not editable here" icon={<Icon name="info" size={18} />} />
      <div className="p-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="text-xs uppercase tracking-wide text-ink-400">{row.label}</dt>
              <dd className="tabular mt-1 break-words text-sm font-medium text-ink-800">{row.value}</dd>
            </div>
          ))}
        </dl>
        {user.examStage?.name && (
          <p className="mt-5 border-t border-paper-200 pt-4 text-sm text-ink-500">
            You are preparing for{' '}
            <Badge tone="brand" size="sm">
              {user.examStage.name}
            </Badge>
          </p>
        )}
      </div>
    </Card>
  );
}

/* --------------------------------------------------------------- loading --- */

function ProfileSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your profile…</span>
      <div>
        <Skeleton className="h-8 w-64" />
        <div className="mt-3">
          <SkeletonText lines={2} />
        </div>
      </div>
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} className="p-5">
          <Skeleton className="h-5 w-40" />
          <div className="mt-4 space-y-3">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
          <div className="mt-4 flex justify-end">
            <Skeleton className="h-10 w-32" />
          </div>
        </Card>
      ))}
    </div>
  );
}
