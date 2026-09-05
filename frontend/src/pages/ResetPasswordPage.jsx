import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '@/services/api';
import { useToast } from '@/context/ToastContext';
import { useAction, useDocumentTitle } from '@/hooks';
import { Button, Icon, Input } from '@/components/ui';

/** Mirrors the password rule the API enforces. */
function validate(password, confirmPassword) {
  const errors = {};
  if (!password) errors.password = 'Please choose a new password';
  else if (password.length < 8) errors.password = 'Use at least 8 characters';
  else if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    errors.password = 'Include at least one letter and one number';
  }
  if (!confirmPassword) errors.confirmPassword = 'Please type your new password again';
  else if (confirmPassword !== password) errors.confirmPassword = 'The two passwords do not match';
  return errors;
}

/** Shown when there is no usable token, or the server has rejected the one we have. */
function BadTokenNotice({ title, message }) {
  return (
    <div>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-50 text-warning-600">
        <Icon name="alert" size={24} />
      </span>
      <h1 className="mt-5 font-serif text-2xl font-semibold text-ink-900">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-600">{message}</p>
      <p className="mt-3 text-sm leading-relaxed text-ink-500">
        Reset links expire after a short while, and each one can be used only once. Requesting a new link takes a
        moment.
      </p>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <Button to="/forgot-password" size="lg">
          Request a new link
        </Button>
        <Button to="/login" variant="ghost" size="lg">
          Back to sign in
        </Button>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  useDocumentTitle('Choose a new password');

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const token = (searchParams.get('token') || '').trim();

  const [values, setValues] = useState({ password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const { run, pending, error, clearError } = useAction(authApi.resetPassword);

  const setField = (name) => (event) => {
    const { value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => (current[name] ? { ...current, [name]: undefined } : current));
    if (error) clearError();
  };

  const onSubmit = async (event) => {
    event.preventDefault();

    const nextErrors = validate(values.password, values.confirmPassword);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      await run({ token, password: values.password });
      toast.success('Your password has been reset. You can now sign in.', { title: 'Password changed' });
      navigate('/login', { replace: true });
    } catch {
      // Handled below: either a rejected token, or a field problem.
    }
  };

  if (!token) {
    return (
      <BadTokenNotice
        title="This reset link is incomplete"
        message="The link you followed does not carry a reset token, so we cannot tell which account it belongs to. It may have been broken across two lines by your email program."
      />
    );
  }

  // The server rejects an expired, used or forged token with a 400 or 422.
  const tokenRejected = error && (error.status === 400 || error.status === 422);
  if (tokenRejected) {
    return (
      <BadTokenNotice
        title="This reset link is no longer valid"
        message={error.message || 'That reset link is invalid or has expired. Please request a new one.'}
      />
    );
  }

  return (
    <div>
      <header>
        <h1 className="font-serif text-2xl font-semibold text-ink-900">Choose a new password</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          Set a new password for your account. You will be signed out everywhere else once it is changed.
        </p>
      </header>

      <form onSubmit={onSubmit} noValidate className="mt-7 space-y-5">
        {error && !tokenRejected && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-danger-500 bg-danger-50 px-3.5 py-2.5 text-sm text-danger-600"
          >
            <Icon name="alert" size={16} className="mt-0.5" />
            <span>{error.message || 'We could not reset your password just now. Please try again.'}</span>
          </p>
        )}

        <Input
          label="New password"
          type="password"
          name="password"
          autoComplete="new-password"
          value={values.password}
          onChange={setField('password')}
          error={errors.password}
          hint="At least 8 characters, including one letter and one number."
          required
          autoFocus
        />

        <Input
          label="Confirm new password"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={setField('confirmPassword')}
          error={errors.confirmPassword}
          required
        />

        <Button type="submit" size="lg" fullWidth loading={pending} disabled={pending}>
          {pending ? 'Saving…' : 'Save new password'}
        </Button>
      </form>

      <p className="mt-7 border-t border-paper-300 pt-5 text-sm text-ink-500">
        Did not mean to reset it?{' '}
        <Link to="/login" className="rounded font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800">
          Back to sign in
        </Link>
        .
      </p>
    </div>
  );
}
