import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '@/services/api';
import { useAction, useDocumentTitle } from '@/hooks';
import { Badge, Button, Icon, Input } from '@/components/ui';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * In development the API hands back the reset link so the flow can be exercised
 * without a mail transport. Where it points at this same site, keep the visitor
 * inside the application rather than reloading the page.
 */
function DevResetLink({ link }) {
  let internal = null;
  try {
    const url = new URL(link, window.location.origin);
    if (url.origin === window.location.origin) internal = `${url.pathname}${url.search}`;
  } catch {
    internal = null;
  }

  return (
    <div className="mt-5 rounded-lg border border-warning-500 bg-warning-50 p-3.5">
      <Badge tone="warning" size="sm" icon={<Icon name="alert" size={12} />}>
        Development only
      </Badge>
      <p className="mt-2 text-sm leading-relaxed text-ink-700">
        No mail is being sent from this server, so the reset link is shown here. It will not appear once the platform is
        live.
      </p>
      {internal ? (
        <Link
          to={internal}
          className="mt-2 block break-all rounded font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
        >
          Open the reset link
        </Link>
      ) : (
        <a
          href={link}
          className="mt-2 block break-all rounded font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
        >
          {link}
        </a>
      )}
    </div>
  );
}

export default function ForgotPasswordPage() {
  useDocumentTitle('Reset your password');

  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState(null);
  const [sent, setSent] = useState(null); // { message, devResetLink }

  const { run, pending, error, clearError } = useAction(authApi.forgotPassword);

  const onSubmit = async (event) => {
    event.preventDefault();

    const trimmed = email.trim();
    if (!trimmed) {
      setFieldError('Please enter your email address');
      return;
    }
    if (!EMAIL_PATTERN.test(trimmed)) {
      setFieldError('Please enter a valid email address');
      return;
    }
    setFieldError(null);

    try {
      const result = await run({ email: trimmed });
      setSent({
        message: result?.message || 'If an account exists for that address, a reset link has been sent.',
        devResetLink: result?.devResetLink || null,
      });
    } catch {
      // Rendered from `error` below.
    }
  };

  if (sent) {
    return (
      <div>
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success-100 text-success-600">
          <Icon name="check" size={24} />
        </span>
        <h1 className="mt-5 font-serif text-2xl font-semibold text-ink-900">Check your email</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-600" role="status">
          {sent.message}
        </p>
        <p className="mt-4 text-sm leading-relaxed text-ink-500">
          We give the same answer whether or not an account exists for that address. That is deliberate: it means nobody
          can use this page to find out who has an account here.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-ink-500">
          The link is valid for a short time. If it does not arrive, check your spam folder, then try again with the
          address you registered.
        </p>

        {sent.devResetLink && <DevResetLink link={sent.devResetLink} />}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Button
            variant="secondary"
            onClick={() => {
              setSent(null);
              clearError();
            }}
          >
            Use a different address
          </Button>
          <Button to="/login" variant="ghost">
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header>
        <h1 className="font-serif text-2xl font-semibold text-ink-900">Reset your password</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          Enter the email address you registered with and we will send you a link to set a new password.
        </p>
      </header>

      <form onSubmit={onSubmit} noValidate className="mt-7 space-y-5">
        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-danger-500 bg-danger-50 px-3.5 py-2.5 text-sm text-danger-600"
          >
            <Icon name="alert" size={16} className="mt-0.5" />
            <span>{error.message || 'We could not send the link just now. Please try again.'}</span>
          </p>
        )}

        <Input
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (fieldError) setFieldError(null);
            if (error) clearError();
          }}
          error={fieldError}
          required
          autoFocus
        />

        <Button type="submit" size="lg" fullWidth loading={pending} disabled={pending}>
          {pending ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>

      <p className="mt-7 border-t border-paper-300 pt-5 text-sm text-ink-500">
        Remembered it?{' '}
        <Link to="/login" className="rounded font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800">
          Back to sign in
        </Link>
        .
      </p>
    </div>
  );
}
