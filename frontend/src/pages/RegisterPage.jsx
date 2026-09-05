import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useAction, useDocumentTitle } from '@/hooks';
import { Button, Icon, Input, cx } from '@/components/ui';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Mirrors the rules the API enforces, so a candidate is told what is wrong
 * before a round trip rather than after one.
 */
function validate(values) {
  const errors = {};

  if (values.name.trim().length < 2) errors.name = 'Please enter your full name';
  else if (values.name.trim().length > 120) errors.name = 'That name is too long';

  if (!values.email.trim()) errors.email = 'Please enter your email address';
  else if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = 'Please enter a valid email address';

  if (!values.password) errors.password = 'Please choose a password';
  else if (values.password.length < 8) errors.password = 'Use at least 8 characters';
  else if (!/[a-zA-Z]/.test(values.password) || !/[0-9]/.test(values.password)) {
    errors.password = 'Include at least one letter and one number';
  }

  if (!values.confirmPassword) errors.confirmPassword = 'Please type your password again';
  else if (values.confirmPassword !== values.password) errors.confirmPassword = 'The two passwords do not match';

  ['diocese', 'circuit', 'society'].forEach((field) => {
    if (values[field].trim().length > 120) errors[field] = 'Please keep this under 120 characters';
  });

  return errors;
}

const INITIAL = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  diocese: '',
  circuit: '',
  society: '',
};

export default function RegisterPage() {
  useDocumentTitle('Create your account');

  const { register } = useAuth();
  const navigate = useNavigate();
  const churchPanelId = useId();

  const [values, setValues] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [churchOpen, setChurchOpen] = useState(false);
  // True when the server's complaint has been shown beside a field, so the
  // banner does not repeat it.
  const [handledInline, setHandledInline] = useState(false);
  const { run, pending, error, clearError } = useAction(register);

  const setField = (name) => (event) => {
    const { value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => (current[name] ? { ...current, [name]: undefined } : current));
    if (error) {
      clearError();
      setHandledInline(false);
    }
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setHandledInline(false);

    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      // If the problem is hidden inside the collapsed section, open it.
      if (nextErrors.diocese || nextErrors.circuit || nextErrors.society) setChurchOpen(true);
      return;
    }

    let timezone;
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      timezone = undefined;
    }

    try {
      await run({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
        diocese: values.diocese.trim(),
        circuit: values.circuit.trim(),
        society: values.society.trim(),
        ...(timezone ? { timezone } : {}),
      });
      navigate('/onboarding', { replace: true });
    } catch (err) {
      // The API returns field-level detail on a 422; show it beside the field
      // it belongs to, and fall back to the banner for anything we cannot place.
      const mapped = {};
      if (Array.isArray(err?.details)) {
        err.details.forEach((detail) => {
          const field = detail?.field;
          if (field && field in INITIAL && !mapped[field]) mapped[field] = detail.message;
        });
      }
      const placed = Object.keys(mapped);
      setErrors(mapped);
      setHandledInline(placed.length > 0);
      if (mapped.diocese || mapped.circuit || mapped.society) setChurchOpen(true);
    }
  };

  const formError =
    error && !handledInline
      ? error.status === 409
        ? 'An account already exists for that email address. Try signing in instead.'
        : error.message || 'We could not create your account just now. Please try again.'
      : null;

  return (
    <div>
      <header>
        <h1 className="font-serif text-2xl font-semibold text-ink-900">Create your account</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          A few details, and you can begin. You will choose the examination you are preparing for on the next screen.
        </p>
      </header>

      <form onSubmit={onSubmit} noValidate className="mt-7 space-y-5">
        {formError && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-danger-500 bg-danger-50 px-3.5 py-2.5 text-sm text-danger-600"
          >
            <Icon name="alert" size={16} className="mt-0.5" />
            <span>
              {formError}
              {error?.status === 409 && (
                <>
                  {' '}
                  <Link to="/login" className="rounded font-medium underline underline-offset-2">
                    Sign in
                  </Link>
                  .
                </>
              )}
            </span>
          </p>
        )}

        <Input
          label="Full name"
          name="name"
          autoComplete="name"
          placeholder="e.g. Kwame Mensah"
          value={values.name}
          onChange={setField('name')}
          error={errors.name}
          required
          autoFocus
        />

        <Input
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={values.email}
          onChange={setField('email')}
          error={errors.email}
          hint="We use this to sign you in and to reset your password."
          required
        />

        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          value={values.password}
          onChange={setField('password')}
          error={errors.password}
          hint="At least 8 characters, including one letter and one number."
          required
        />

        <Input
          label="Confirm password"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={setField('confirmPassword')}
          error={errors.confirmPassword}
          required
        />

        {/* ------------------------------------------- optional church details */}
        <div className="rounded-xl border border-paper-300 bg-paper-50">
          <button
            type="button"
            onClick={() => setChurchOpen((open) => !open)}
            aria-expanded={churchOpen}
            aria-controls={churchPanelId}
            className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left"
          >
            <span>
              <span className="block text-sm font-medium text-ink-800">Your church details (optional)</span>
              <span className="mt-0.5 block text-xs text-ink-500">Diocese, circuit and society. You can add these later.</span>
            </span>
            <Icon
              name="chevronDown"
              size={16}
              strokeStyle
              className={cx('shrink-0 text-ink-400 transition-transform duration-200', churchOpen && 'rotate-180')}
            />
          </button>

          <div id={churchPanelId} hidden={!churchOpen} className="space-y-4 border-t border-paper-300 px-4 py-4">
            <Input
              label="Diocese"
              name="diocese"
              autoComplete="off"
              placeholder="e.g. Accra Diocese"
              value={values.diocese}
              onChange={setField('diocese')}
              error={errors.diocese}
            />
            <Input
              label="Circuit"
              name="circuit"
              autoComplete="off"
              placeholder="e.g. Dansoman Circuit"
              value={values.circuit}
              onChange={setField('circuit')}
              error={errors.circuit}
            />
            <Input
              label="Society"
              name="society"
              autoComplete="off"
              placeholder="e.g. Wesley Society"
              value={values.society}
              onChange={setField('society')}
              error={errors.society}
            />
          </div>
        </div>

        <Button type="submit" size="lg" fullWidth loading={pending} disabled={pending}>
          {pending ? 'Creating your account…' : 'Create account'}
        </Button>

        <p className="text-xs leading-relaxed text-ink-500">
          Study material on this platform is reproduced from the official Methodist Church Ghana Lay Preachers&rsquo;
          syllabus for your personal use as a candidate.
        </p>
      </form>

      <p className="mt-7 border-t border-paper-300 pt-5 text-sm text-ink-500">
        Already have an account?{' '}
        <Link to="/login" className="rounded font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800">
          Sign in
        </Link>
        .
      </p>
    </div>
  );
}
