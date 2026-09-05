import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useAction, useDocumentTitle } from '@/hooks';
import { Button, Icon, Input } from '@/components/ui';

/** Turns an API failure into something a candidate can act on. */
function signInMessage(error) {
  if (!error) return null;
  if (error.status === 401 || error.status === 400) {
    return 'We could not sign you in. Check your email address and password, then try again.';
  }
  if (error.status === 403) {
    return error.message || 'This account is not currently active. Please contact your tutor or the administrator.';
  }
  if (error.status === 429) {
    return 'That is a few too many attempts. Please wait a moment and try again.';
  }
  return error.message || 'Something went wrong signing you in. Please try again.';
}

export default function LoginPage() {
  useDocumentTitle('Sign in');

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [values, setValues] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const { run, pending, error, clearError } = useAction(login);

  const destination = location.state?.from?.pathname || '/dashboard';

  const setField = (name) => (event) => {
    const { value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => (current[name] ? { ...current, [name]: undefined } : current));
    if (error) clearError();
  };

  const onSubmit = async (event) => {
    event.preventDefault();

    const nextErrors = {};
    if (!values.email.trim()) nextErrors.email = 'Please enter your email address';
    if (!values.password) nextErrors.password = 'Please enter your password';
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      await run({ email: values.email.trim(), password: values.password });
      navigate(destination, { replace: true });
    } catch {
      // The message is rendered from `error`; nothing further to do here.
    }
  };

  const formError = signInMessage(error);

  return (
    <div>
      <header>
        <h1 className="font-serif text-2xl font-semibold text-ink-900">Welcome back</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          Sign in to carry on with your preparation. Your progress, notes and mistakes are waiting where you left them.
        </p>
      </header>

      {location.state?.from && (
        <p className="mt-5 flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-sm text-brand-800">
          <Icon name="info" size={16} className="mt-0.5" />
          <span>Please sign in to open that page.</span>
        </p>
      )}

      <form onSubmit={onSubmit} noValidate className="mt-7 space-y-5">
        {formError && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-danger-500 bg-danger-50 px-3.5 py-2.5 text-sm text-danger-600"
          >
            <Icon name="alert" size={16} className="mt-0.5" />
            <span>{formError}</span>
          </p>
        )}

        <Input
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={values.email}
          onChange={setField('email')}
          error={fieldErrors.email}
          required
          autoFocus
        />

        <div>
          <Input
            label="Password"
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="Your password"
            value={values.password}
            onChange={setField('password')}
            error={fieldErrors.password}
            required
          />
          <p className="mt-2 text-right">
            <Link
              to="/forgot-password"
              className="rounded text-sm font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
            >
              Forgot your password?
            </Link>
          </p>
        </div>

        <Button type="submit" size="lg" fullWidth loading={pending} disabled={pending}>
          {pending ? 'Signing you in…' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-7 border-t border-paper-300 pt-5 text-sm text-ink-500">
        New here?{' '}
        <Link to="/register" className="rounded font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800">
          Create an account
        </Link>
        .
      </p>
    </div>
  );
}
