import { forwardRef, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

/** Joins class names, dropping falsy values. */
export const cx = (...parts) => parts.filter(Boolean).join(' ');

/* ---------------------------------------------------------------- Button --- */

const BUTTON_VARIANTS = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900 disabled:bg-brand-300',
  secondary: 'bg-white text-brand-800 border border-paper-300 hover:bg-paper-100 active:bg-paper-200',
  ghost: 'bg-transparent text-brand-700 hover:bg-brand-50 active:bg-brand-100',
  danger: 'bg-danger-500 text-white hover:bg-danger-600 active:bg-danger-600',
  gold: 'bg-gold-500 text-ink-900 hover:bg-gold-600 hover:text-white',
  subtle: 'bg-paper-200 text-ink-700 hover:bg-paper-300',
};

const BUTTON_SIZES = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2.5',
};

export const Button = forwardRef(function Button(
  { as, to, href, variant = 'primary', size = 'md', loading = false, icon, iconRight, fullWidth, className, children, disabled, ...props },
  ref,
) {
  const Component = as || (to ? Link : href ? 'a' : 'button');
  const isDisabled = disabled || loading;

  return (
    <Component
      ref={ref}
      to={to}
      href={href}
      // Anchors have no disabled attribute; aria-disabled communicates the state.
      {...(Component === 'button' ? { disabled: isDisabled, type: props.type || 'button' } : {})}
      aria-disabled={isDisabled || undefined}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-60',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? <Spinner size={size === 'lg' ? 20 : 16} /> : icon}
      {children}
      {!loading && iconRight}
    </Component>
  );
});

export function Spinner({ size = 16, className }) {
  return (
    <svg
      className={cx('animate-spin', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ Card --- */

export function Card({ as: Component = 'div', className, hover, children, ...props }) {
  return (
    <Component className={cx('card', hover && 'card-hover', className)} {...props}>
      {children}
    </Component>
  );
}

export function CardHeader({ title, subtitle, action, icon, className }) {
  return (
    <div className={cx('flex items-start justify-between gap-4 border-b border-paper-200 px-5 py-4', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && <div className="mt-0.5 text-brand-600">{icon}</div>}
        <div className="min-w-0">
          <h2 className="truncate font-serif text-base font-semibold text-ink-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/* ----------------------------------------------------------------- Badge --- */

const BADGE_TONES = {
  neutral: 'bg-paper-200 text-ink-600',
  brand: 'bg-brand-100 text-brand-800',
  success: 'bg-success-100 text-success-700',
  warning: 'bg-warning-100 text-warning-600',
  danger: 'bg-danger-100 text-danger-600',
  gold: 'bg-gold-100 text-gold-700',
  flame: 'bg-flame-100 text-flame-700',
  outline: 'border border-paper-300 text-ink-600',
};

export function Badge({ tone = 'neutral', size = 'md', icon, className, children }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        BADGE_TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/**
 * States what a question is and where it came from. Official examination
 * material and practice material written from the syllabus are never presented
 * as the same thing.
 */
export function SourceBadge({ sourceKind, source, answerConfidence, size = 'sm' }) {
  const map = {
    past_paper: { tone: 'gold', label: source?.label || 'Official past paper' },
    manual_derived: { tone: 'brand', label: 'From the syllabus' },
    demo: { tone: 'neutral', label: 'Demo content' },
  };
  const entry = map[sourceKind] || map.manual_derived;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge tone={entry.tone} size={size}>
        {entry.label}
      </Badge>
      {answerConfidence === 'unverified' && (
        <Badge tone="warning" size={size} title="The answer to this question has not been traced to the syllabus.">
          Answer unverified
        </Badge>
      )}
    </span>
  );
}

/* -------------------------------------------------------------- Progress --- */

export function ProgressBar({ value, max = 100, tone = 'brand', size = 'md', label, showValue, className }) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const tones = {
    brand: 'bg-brand-600',
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    danger: 'bg-danger-500',
    gold: 'bg-gold-500',
  };

  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
          {label && <span className="text-ink-600">{label}</span>}
          {showValue && <span className="tabular font-medium text-ink-800">{Math.round(percent)}%</span>}
        </div>
      )}
      <div
        className={cx('w-full overflow-hidden rounded-full bg-paper-200', size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2')}
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Progress'}
      >
        <div className={cx('h-full rounded-full transition-all duration-500', tones[tone])} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function ProgressRing({ value, size = 72, stroke = 7, tone = 'brand', label, sublabel }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = Math.min(100, Math.max(0, value || 0));
  const tones = { brand: '#2f4877', success: '#1f9d55', warning: '#c98a1e', danger: '#c53030', gold: '#c8a951' };

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f0ece4" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tones[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (percent / 100) * circumference}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular font-serif text-lg font-semibold leading-none text-ink-900">{label ?? `${Math.round(percent)}%`}</span>
        {sublabel && <span className="mt-0.5 text-[10px] uppercase tracking-wide text-ink-400">{sublabel}</span>}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- Stats --- */

export function StatTile({ label, value, sublabel, tone = 'neutral', icon, className }) {
  const tones = {
    neutral: 'text-ink-900',
    brand: 'text-brand-700',
    success: 'text-success-600',
    warning: 'text-warning-600',
    danger: 'text-danger-600',
  };
  return (
    <div className={cx('rounded-xl border border-paper-300 bg-white p-4', className)}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-400">
        {icon}
        <span>{label}</span>
      </div>
      <p className={cx('mt-2 tabular font-serif text-2xl font-semibold leading-none', tones[tone])}>{value}</p>
      {sublabel && <p className="mt-1.5 text-xs text-ink-500">{sublabel}</p>}
    </div>
  );
}

/* ----------------------------------------------------------------- Forms --- */

export const Input = forwardRef(function Input({ label, hint, error, id, className, required, ...props }, ref) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const describedBy = [hint && `${inputId}-hint`, error && `${inputId}-error`].filter(Boolean).join(' ');

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink-700">
          {label}
          {required && <span className="ml-0.5 text-danger-500" aria-hidden="true">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy || undefined}
        className={cx(
          'w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400',
          'transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25',
          'disabled:bg-paper-100 disabled:text-ink-400',
          error ? 'border-danger-500' : 'border-paper-300',
        )}
        {...props}
      />
      {hint && !error && (
        <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-ink-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} className="mt-1.5 flex items-center gap-1 text-xs text-danger-600" role="alert">
          <Icon name="alert" size={13} />
          {error}
        </p>
      )}
    </div>
  );
});

export const Textarea = forwardRef(function Textarea({ label, hint, error, id, className, rows = 5, ...props }, ref) {
  const generatedId = useId();
  const inputId = id || generatedId;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink-700">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        aria-invalid={error ? 'true' : undefined}
        className={cx(
          'w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm leading-relaxed text-ink-900 placeholder:text-ink-400',
          'transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25',
          error ? 'border-danger-500' : 'border-paper-300',
        )}
        {...props}
      />
      {hint && !error && <p className="mt-1.5 text-xs text-ink-500">{hint}</p>}
      {error && (
        <p className="mt-1.5 text-xs text-danger-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});

export const Select = forwardRef(function Select({ label, hint, error, id, className, children, ...props }, ref) {
  const generatedId = useId();
  const inputId = id || generatedId;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink-700">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={inputId}
        className={cx(
          'w-full appearance-none rounded-lg border bg-white bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat px-3.5 py-2.5 pr-10 text-sm text-ink-900',
          'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25',
          error ? 'border-danger-500' : 'border-paper-300',
        )}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%236b7280'%3E%3Cpath d='M5.5 7.5 10 12l4.5-4.5'  stroke='%236b7280' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
        }}
        {...props}
      >
        {children}
      </select>
      {hint && !error && <p className="mt-1.5 text-xs text-ink-500">{hint}</p>}
      {error && (
        <p className="mt-1.5 text-xs text-danger-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});

export function Checkbox({ label, description, id, className, ...props }) {
  const generatedId = useId();
  const inputId = id || generatedId;
  return (
    <div className={cx('flex items-start gap-2.5', className)}>
      <input
        id={inputId}
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-paper-400 text-brand-600 focus:ring-brand-500"
        {...props}
      />
      <label htmlFor={inputId} className="text-sm text-ink-700">
        {label}
        {description && <span className="mt-0.5 block text-xs text-ink-500">{description}</span>}
      </label>
    </div>
  );
}

/* ------------------------------------------------------------------ Tabs --- */

export function Tabs({ tabs, active, onChange, className }) {
  const listRef = useRef(null);

  // Arrow keys move between tabs, as expected of a tablist.
  const onKeyDown = (event) => {
    const index = tabs.findIndex((t) => t.key === active);
    if (index === -1) return;
    let next = null;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next === null) return;
    event.preventDefault();
    onChange(tabs[next].key);
    listRef.current?.querySelectorAll('[role="tab"]')[next]?.focus();
  };

  return (
    <div ref={listRef} role="tablist" onKeyDown={onKeyDown} className={cx('flex gap-1 overflow-x-auto border-b border-paper-300', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          type="button"
          aria-selected={active === tab.key}
          tabIndex={active === tab.key ? 0 : -1}
          onClick={() => onChange(tab.key)}
          className={cx(
            'relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors',
            active === tab.key ? 'text-brand-800' : 'text-ink-500 hover:text-ink-700',
          )}
        >
          {tab.label}
          {tab.count != null && (
            <span className="ml-1.5 rounded-full bg-paper-200 px-1.5 py-0.5 text-[11px] tabular text-ink-600">{tab.count}</span>
          )}
          {active === tab.key && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-700" />}
        </button>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- Modal --- */

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  const panelRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
      if (event.key !== 'Tab') return;
      // Keep focus inside the dialog while it is open.
      const focusable = panelRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector('button, input, textarea, a')?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          'relative w-full animate-slide-up rounded-t-2xl bg-white shadow-lift sm:rounded-2xl',
          sizes[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-paper-200 px-5 py-4">
          <div>
            <h2 id={titleId} className="font-serif text-lg font-semibold text-ink-900">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded-lg p-1.5 text-ink-400 hover:bg-paper-100 hover:text-ink-700"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 scrollbar-thin">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-paper-200 px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onCancel, onConfirm, title, message, confirmLabel = 'Confirm', tone = 'primary', loading }) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-ink-600">{message}</p>
    </Modal>
  );
}

/* ------------------------------------------------------- States and empty --- */

export function EmptyState({ icon = 'inbox', title, message, action, className }) {
  return (
    <div className={cx('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-paper-200 text-ink-400">
        <Icon name={icon} size={26} />
      </div>
      <h3 className="font-serif text-base font-semibold text-ink-800">{title}</h3>
      {message && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-500">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }) {
  const retryable = error?.isRetryable !== false;
  return (
    <div className={cx('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger-50 text-danger-500">
        <Icon name="alert" size={26} />
      </div>
      <h3 className="font-serif text-base font-semibold text-ink-800">Something went wrong</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-500">
        {error?.message || 'We could not load this just now.'}
      </p>
      {onRetry && retryable && (
        <Button className="mt-5" variant="secondary" onClick={onRetry} icon={<Icon name="refresh" size={15} />}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className, rounded = 'rounded-lg' }) {
  return <div className={cx('skeleton', rounded, className)} aria-hidden="true" />;
}

export function SkeletonText({ lines = 3, className }) {
  return (
    <div className={cx('space-y-2.5', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cx('h-3.5', i === lines - 1 ? 'w-2/3' : 'w-full')} rounded="rounded" />
      ))}
    </div>
  );
}

export function LoadingScreen({ message = 'Loading…' }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-ink-500">
      <Spinner size={28} className="text-brand-600" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

/* ---------------------------------------------------------------- Tooltip --- */

export function Tooltip({ label, children, className }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className={cx('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink-900 px-2 py-1 text-xs text-white shadow-lift"
        >
          {label}
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ Icons --- */

const ICON_PATHS = {
  dashboard: 'M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm9 0h7v-9h-7v9Zm0-16v5h7V4h-7Z',
  book: 'M4 4.5A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 1 4 17.5v-13Zm2.5 12.5H18V4H6.5a.5.5 0 0 0-.5.5v12.6c.15-.06.32-.1.5-.1Z',
  quiz: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm.02 15.5a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4ZM13 13.2V14h-2v-1.6c0-.5.28-.95.72-1.18l.9-.47c.42-.22.68-.65.68-1.12a1.3 1.3 0 0 0-2.6 0H8.7a3.3 3.3 0 1 1 5.36 2.58l-.9.47a.2.2 0 0 0-.16.2Z',
  exam: 'M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm8 1.5V8h4.5L14 3.5ZM8 12h8v1.6H8V12Zm0 3.4h8V17H8v-1.6Z',
  cards: 'M3 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm4-4h11a3 3 0 0 1 3 3v11h-2V6a1 1 0 0 0-1-1H7V3Z',
  target: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 3.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Zm0 3a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z',
  bookmark: 'M6 2h12a1 1 0 0 1 1 1v18.2a.8.8 0 0 1-1.24.67L12 18.3l-5.76 3.57A.8.8 0 0 1 5 21.2V3a1 1 0 0 1 1-1Z',
  scroll: 'M5 3h11a2 2 0 0 1 2 2v13a3 3 0 0 0 3 3H8a3 3 0 0 1-3-3V3Zm2 2v13a1 1 0 0 0 1 1h9.17A5 5 0 0 1 16 18V5H7Z',
  chart: 'M4 20V10h4v10H4Zm6 0V4h4v16h-4Zm6 0v-7h4v7h-4Z',
  note: 'M5 3h9l5 5v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm3 8h8v1.6H8V11Zm0 3.6h8v1.6H8v-1.6Z',
  user: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 2.46-8 5.5V22h16v-2.5c0-3.04-3.58-5.5-8-5.5Z',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm9.3 4c0 .6-.06 1.18-.16 1.74l2.1 1.63-2 3.46-2.5-1a7.9 7.9 0 0 1-3 1.74L15.3 22h-4l-.44-2.43a7.9 7.9 0 0 1-3-1.74l-2.5 1-2-3.46 2.1-1.63a8.3 8.3 0 0 1 0-3.48L3.36 8.63l2-3.46 2.5 1a7.9 7.9 0 0 1 3-1.74L11.3 2h4l.44 2.43a7.9 7.9 0 0 1 3 1.74l2.5-1 2 3.46-2.1 1.63c.1.56.16 1.14.16 1.74Z',
  search: 'M10.5 3a7.5 7.5 0 1 0 4.55 13.46l4.24 4.25 1.42-1.42-4.25-4.24A7.5 7.5 0 0 0 10.5 3Zm0 2a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Z',
  close: 'M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6Z',
  check: 'M9.55 17.6 4 12.05l1.4-1.4 4.15 4.14L18.6 5.7 20 7.1Z',
  alert: 'M12 2 1.5 20.5h21L12 2Zm0 5.5 7 12.2H5l7-12.2ZM11 11v4.5h2V11h-2Zm0 5.6v1.8h2v-1.8h-2Z',
  info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 5h2v2h-2V7Zm0 4h2v7h-2v-7Z',
  refresh: 'M12 4V1L8 5l4 4V6a6 6 0 1 1-5.65 8h-2.1A8 8 0 1 0 12 4Z',
  flame: 'M13.5 2c.6 3.2-1.3 4.6-2.6 6.2C9.4 10 8 11.6 8 14.3A6 6 0 0 0 20 15c0-4.4-3.9-6-6.5-13ZM9.4 13.9c-1.4 1-2.2 2.2-2.2 3.6a4.4 4.4 0 0 0 .9 2.6A6 6 0 0 1 4 15c0-1.6.6-2.8 1.5-3.8.2 1.3 1.4 2.3 3.9 2.7Z',
  award: 'M12 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12Zm0 2.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6ZM7.5 15.2 5 22l4.4-1.7L12 22l2.6-1.7L19 22l-2.5-6.8a8 8 0 0 1-9 0Z',
  sprout: 'M12 22v-7.2C12 10.5 8.8 8 5 8v2c2.7 0 4.6 1.7 4.9 4.4C8 13.1 6 13 4 13.5 5 17 8 19 12 19v3h2v-3c4 0 7-2 8-5.5-2-.5-4-.4-5.9.9C16.4 11.7 18.3 10 21 10V8c-3.8 0-7 2.5-7 6.8V22h-2Z',
  stack: 'M12 2 2 7l10 5 10-5-10-5Zm-7.8 8.4L2 11.5l10 5 10-5-2.2-1.1L12 14l-7.8-3.6Zm0 4.5L2 16l10 5 10-5-2.2-1.1L12 18.5l-7.8-3.6Z',
  clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 5v5.3l4 2.3-1 1.7-5-2.9V7h2Z',
  pen: 'M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25ZM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z',
  'bookmark-check': 'M6 2h12a1 1 0 0 1 1 1v18.2a.8.8 0 0 1-1.24.67L12 18.3l-5.76 3.57A.8.8 0 0 1 5 21.2V3a1 1 0 0 1 1-1Zm5 12.2 4.9-4.9-1.4-1.4-3.5 3.5-1.5-1.5-1.4 1.4 2.9 2.9Z',
  mic: 'M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z',
  stop: 'M6 6h12v12H6z',
  play: 'M8 5v14l11-7z',
  chevronRight: 'M9 6l6 6-6 6',
  chevronLeft: 'M15 6l-6 6 6 6',
  chevronDown: 'M6 9l6 6 6-6',
  menu: 'M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h18v2H3v-2Z',
  inbox: 'M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm1 2v8h4a3 3 0 0 0 6 0h4V6H5Z',
  logout: 'M5 3h8v2H6v14h7v2H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm11.2 5.2 1.4-1.4L22.8 12l-5.2 5.2-1.4-1.4 2.8-2.8H9v-2h9.99l-2.8-2.8Z',
  plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z',
  filter: 'M3 5h18v2l-7 7v6l-4-2v-4L3 7V5Z',
  trash: 'M6 7h12v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7Zm3-4h6l1 2h4v2H4V5h4l1-2Z',
  eye: 'M12 5c-5 0-9 4.5-9 7s4 7 9 7 9-4.5 9-7-4-7-9-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  upload: 'M11 16V8.8L8.4 11.4 7 10l5-5 5 5-1.4 1.4L13 8.8V16h-2ZM5 18h14v2H5v-2Z',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7.5.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20c0-3 3.1-5.5 7-5.5s7 2.5 7 5.5v1H2v-1Zm15.5-4.6c2.6.5 4.5 2.3 4.5 4.6v1h-4.2v-1c0-1.7-.7-3.2-1.9-4.3.5-.2 1-.3 1.6-.3Z',
};

export function Icon({ name, size = 20, className, strokeStyle = false, ...props }) {
  const path = ICON_PATHS[name];
  if (!path) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={strokeStyle ? 'none' : 'currentColor'}
      stroke={strokeStyle ? 'currentColor' : undefined}
      strokeWidth={strokeStyle ? 2 : undefined}
      strokeLinecap={strokeStyle ? 'round' : undefined}
      strokeLinejoin={strokeStyle ? 'round' : undefined}
      className={cx('shrink-0', className)}
      aria-hidden="true"
      {...props}
    >
      <path d={path} />
    </svg>
  );
}

/* --------------------------------------------------------------- Toasts --- */

export function ToastViewport({ toasts, onDismiss }) {
  const tones = {
    success: 'border-success-500 bg-success-50 text-success-700',
    danger: 'border-danger-500 bg-danger-50 text-danger-600',
    warning: 'border-warning-500 bg-warning-50 text-warning-600',
    info: 'border-brand-500 bg-brand-50 text-brand-800',
  };
  const icons = { success: 'check', danger: 'alert', warning: 'alert', info: 'info' };

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cx(
            'pointer-events-auto flex animate-slide-up items-start gap-3 rounded-xl border-l-4 bg-white p-3.5 shadow-lift',
            tones[toast.tone] || tones.info,
          )}
          role={toast.tone === 'danger' ? 'alert' : 'status'}
        >
          <Icon name={icons[toast.tone] || 'info'} size={18} className="mt-0.5" />
          <div className="min-w-0 flex-1">
            {toast.title && <p className="text-sm font-semibold">{toast.title}</p>}
            <p className="text-sm leading-snug">{toast.message}</p>
            {toast.action}
          </div>
          <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Dismiss" className="-mr-1 -mt-1 rounded p-1 opacity-60 hover:opacity-100">
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
