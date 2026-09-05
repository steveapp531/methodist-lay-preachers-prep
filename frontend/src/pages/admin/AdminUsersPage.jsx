import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi } from '@/services/api';
import { useAsync, useDebounced, useDocumentTitle } from '@/hooks';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Icon,
  Input,
  Modal,
  ProgressBar,
  Select,
  Skeleton,
  SkeletonText,
  StatTile,
  cx,
} from '@/components/ui';
import { ROLES } from '@shared/constants';
import { accuracyTone, formatDate, formatDateTime, initials, percent, plural, relativeTime } from '@/utils/format';

const ROLE_LABELS = { [ROLES.STUDENT]: 'Candidate', [ROLES.ADMIN]: 'Administrator' };

export default function AdminUsersPage() {
  useDocumentTitle('People');

  const toast = useToast();
  const { user: signedInUser } = useAuth();

  const [searchText, setSearchText] = useState('');
  const debouncedSearch = useDebounced(searchText, 350);
  const [exam, setExam] = useState('');
  const [role, setRole] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);

  const [openUserId, setOpenUserId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setPage(1), [debouncedSearch, exam, role, active]);

  const exams = useAsync(() => adminApi.exams(), []);

  const query = useMemo(
    () => ({
      page,
      limit: 20,
      search: debouncedSearch || undefined,
      exam: exam || undefined,
      role: role || undefined,
      active: active || undefined,
    }),
    [page, debouncedSearch, exam, role, active],
  );

  const { data, error, loading, reload } = useAsync(() => adminApi.users(query), [JSON.stringify(query)]);

  const rows = data?.users || [];
  const meta = data?._meta;
  const hasFilters = Boolean(debouncedSearch || exam || role || active);

  const clearFilters = () => {
    setSearchText('');
    setExam('');
    setRole('');
    setActive('');
  };

  const applyChange = useCallback(async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await adminApi.updateUser(confirm.user._id, confirm.payload);
      toast.success(confirm.successMessage);
      setConfirm(null);
      await reload();
    } catch (err) {
      // The API refuses some changes on purpose — say so plainly rather than
      // pretending the control was never there.
      toast.error(err.message || 'That change could not be made.');
      setConfirm((current) => (current ? { ...current, refusal: err.message } : current));
    } finally {
      setBusy(false);
    }
  }, [confirm, reload, toast]);

  const askRoleChange = (user) => {
    const nextRole = user.role === ROLES.ADMIN ? ROLES.STUDENT : ROLES.ADMIN;
    setConfirm({
      user,
      payload: { role: nextRole },
      title: nextRole === ROLES.ADMIN ? `Make ${user.name} an administrator?` : `Remove ${user.name}'s administrator role?`,
      message:
        nextRole === ROLES.ADMIN
          ? `${user.name} will be able to add, edit, publish and delete questions, and to see every candidate's results.`
          : `${user.name} will keep their account and their study record, but will lose access to the administration area.`,
      confirmLabel: nextRole === ROLES.ADMIN ? 'Make administrator' : 'Remove the role',
      tone: nextRole === ROLES.ADMIN ? 'primary' : 'danger',
      successMessage: `${user.name} is now ${ROLE_LABELS[nextRole].toLowerCase()}.`,
    });
  };

  const askActiveChange = (user) => {
    const nextActive = !user.isActive;
    setConfirm({
      user,
      payload: { isActive: nextActive },
      title: nextActive ? `Restore access for ${user.name}?` : `Suspend ${user.name}'s access?`,
      message: nextActive
        ? `${user.name} will be able to sign in again. Nothing in their study record was removed while they were suspended.`
        : `${user.name} will not be able to sign in. Their account, results and notes are kept, and access can be restored at any time.`,
      confirmLabel: nextActive ? 'Restore access' : 'Suspend access',
      tone: nextActive ? 'primary' : 'danger',
      successMessage: nextActive ? `${user.name} can sign in again.` : `${user.name}'s access is suspended.`,
    });
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-serif text-2xl font-semibold text-ink-900">People</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-500">
          Everyone with an account. These are real candidates preparing for an examination — change a role or suspend an
          account only with good reason.
        </p>
      </header>

      <Card as="section" aria-label="Filter people">
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Search"
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Name, email, diocese or circuit"
          />
          <Select label="Examination stage" value={exam} onChange={(e) => setExam(e.target.value)} disabled={exams.loading}>
            <option value="">Every stage</option>
            {(exams.data?.exams || []).map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Every role</option>
            <option value={ROLES.STUDENT}>{ROLE_LABELS[ROLES.STUDENT]}</option>
            <option value={ROLES.ADMIN}>{ROLE_LABELS[ROLES.ADMIN]}</option>
          </Select>
          <Select label="Access" value={active} onChange={(e) => setActive(e.target.value)}>
            <option value="">Active and suspended</option>
            <option value="true">Active only</option>
            <option value="false">Suspended only</option>
          </Select>
        </div>

        {hasFilters && (
          <div className="flex items-center justify-between gap-3 border-t border-paper-200 bg-paper-50 px-4 py-2.5">
            <p className="flex items-center gap-1.5 text-xs text-ink-500">
              <Icon name="filter" size={13} />
              A filter is applied, so this is not everyone.
            </p>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        )}
      </Card>

      <Card>
        {loading && <UsersSkeleton />}

        {!loading && error && <ErrorState error={error} onRetry={reload} />}

        {!loading && !error && rows.length === 0 && (
          <EmptyState
            icon="users"
            title={hasFilters ? 'Nobody matches those filters' : 'Nobody has registered yet'}
            message={
              hasFilters
                ? 'Try a different search, or clear the filters to see everyone.'
                : 'Accounts will be listed here as candidates sign up.'
            }
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        )}

        {!loading && !error && rows.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[58rem] border-collapse text-sm">
                <caption className="sr-only">
                  Registered people, with their examination stage, role, registration date, last activity and study
                  record.
                </caption>
                <thead>
                  <tr className="border-b border-paper-200 text-left text-xs uppercase tracking-wide text-ink-400">
                    <th scope="col" className="px-4 py-3 font-medium">Name</th>
                    <th scope="col" className="px-3 py-3 font-medium">Email</th>
                    <th scope="col" className="px-3 py-3 font-medium">Stage</th>
                    <th scope="col" className="px-3 py-3 font-medium">Role</th>
                    <th scope="col" className="px-3 py-3 font-medium">Registered</th>
                    <th scope="col" className="px-3 py-3 font-medium">Last active</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">Answered</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">Accuracy</th>
                    <th scope="col" className="px-3 py-3 font-medium">Access</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isSelf = String(row._id) === String(signedInUser?._id || signedInUser?.id);
                    return (
                      <tr key={row._id} className="border-b border-paper-100 last:border-0 hover:bg-paper-50">
                        <th scope="row" className="px-4 py-3 text-left align-middle font-normal">
                          <button
                            type="button"
                            onClick={() => setOpenUserId(row._id)}
                            className="flex items-center gap-2.5 text-left"
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">
                              {initials(row.name)}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-ink-800 hover:text-brand-700">
                                {row.name}
                              </span>
                              {(row.circuit || row.diocese) && (
                                <span className="block truncate text-xs text-ink-500">
                                  {[row.circuit, row.diocese].filter(Boolean).join(' · ')}
                                </span>
                              )}
                            </span>
                          </button>
                        </th>
                        <td className="max-w-[14rem] truncate px-3 py-3 text-ink-600">{row.email}</td>
                        <td className="px-3 py-3 text-ink-600">{row.examStage?.shortName || '—'}</td>
                        <td className="px-3 py-3">
                          <Badge tone={row.role === ROLES.ADMIN ? 'gold' : 'neutral'} size="sm">
                            {ROLE_LABELS[row.role] || row.role}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-ink-600">{formatDate(row.createdAt)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-ink-600">
                          {row.lastActiveAt ? relativeTime(row.lastActiveAt) : 'Never'}
                        </td>
                        <td className="tabular px-3 py-3 text-right text-ink-600">{row.activity?.questionsAnswered ?? 0}</td>
                        <td className="px-3 py-3 text-right">
                          {row.activity?.questionsAnswered ? (
                            <Badge tone={accuracyTone(row.activity.accuracy)} size="sm">
                              {percent(row.activity.accuracy)}
                            </Badge>
                          ) : (
                            <span className="text-xs text-ink-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <Badge
                            tone={row.isActive ? 'success' : 'danger'}
                            size="sm"
                            icon={<Icon name={row.isActive ? 'check' : 'close'} size={11} />}
                          >
                            {row.isActive ? 'Active' : 'Suspended'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <Button variant="ghost" size="sm" onClick={() => setOpenUserId(row._id)}>
                              View
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => askRoleChange(row)}
                              title={
                                isSelf && row.role === ROLES.ADMIN
                                  ? 'You cannot remove your own administrator role.'
                                  : undefined
                              }
                            >
                              {row.role === ROLES.ADMIN ? 'Make candidate' : 'Make administrator'}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => askActiveChange(row)}>
                              {row.isActive ? 'Suspend' : 'Restore'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination meta={meta} onPage={setPage} />
          </>
        )}
      </Card>

      <UserDetailModal userId={openUserId} onClose={() => setOpenUserId(null)} />

      <ConfirmDialog
        open={Boolean(confirm)}
        onCancel={() => setConfirm(null)}
        onConfirm={applyChange}
        loading={busy}
        tone={confirm?.tone || 'primary'}
        confirmLabel={confirm?.confirmLabel || 'Confirm'}
        title={confirm?.title || ''}
        message={
          confirm?.refusal ? `${confirm.refusal} Nothing was changed.` : confirm?.message || ''
        }
      />
    </div>
  );
}

function UserDetailModal({ userId, onClose }) {
  const { data, error, loading, reload } = useAsync(async () => (userId ? adminApi.user(userId) : null), [userId]);

  const user = data?.user;
  const stats = data?.stats;

  return (
    <Modal
      open={Boolean(userId)}
      onClose={onClose}
      size="lg"
      title={user?.name || 'Candidate record'}
      description={user?.email}
    >
      {loading && <SkeletonText lines={8} />}

      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && user && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={user.role === ROLES.ADMIN ? 'gold' : 'neutral'} size="sm">
              {ROLE_LABELS[user.role] || user.role}
            </Badge>
            <Badge tone={user.isActive ? 'success' : 'danger'} size="sm">
              {user.isActive ? 'Active' : 'Suspended'}
            </Badge>
            {user.examStage?.name && (
              <Badge tone="brand" size="sm">
                {user.examStage.name}
              </Badge>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-400">Registered</dt>
              <dd className="text-ink-700">{formatDate(user.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-400">Last active</dt>
              <dd className="text-ink-700">{user.lastActiveAt ? formatDateTime(user.lastActiveAt) : 'Never'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-400">Circuit</dt>
              <dd className="text-ink-700">{user.circuit || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-400">Diocese</dt>
              <dd className="text-ink-700">{user.diocese || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-400">Society</dt>
              <dd className="text-ink-700">{user.society || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-400">Current streak</dt>
              <dd className="text-ink-700">{plural(user.streak?.current || 0, 'day')}</dd>
            </div>
          </dl>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Answered" value={stats?.questionsAnswered ?? 0} />
            <StatTile
              label="Accuracy"
              value={stats?.questionsAnswered ? percent(stats.accuracy) : '—'}
              tone={stats?.questionsAnswered ? accuracyTone(stats.accuracy) : 'neutral'}
            />
            <StatTile label="Study minutes" value={stats?.studyMinutes ?? 0} />
            <StatTile label="Mock papers" value={stats?.mockExams ?? 0} />
          </div>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Progress by subject</h3>
            {data.subjectProgress?.length ? (
              <ul className="space-y-3">
                {data.subjectProgress.map((row) => (
                  <li key={row.subject}>
                    <ProgressBar
                      value={Math.round(row.mastery || 0)}
                      max={100}
                      tone={accuracyTone((row.mastery || 0) / 100)}
                      label={`${row.subject} — ${plural(row.topics || 0, 'topic')} touched`}
                      showValue
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-500">No topic has been studied yet.</p>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Recent mock examinations</h3>
            {data.mockExams?.length ? (
              <ul className="divide-y divide-paper-100 rounded-lg border border-paper-200">
                {data.mockExams.map((mock) => (
                  <li key={mock._id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink-800">{mock.title}</p>
                      <p className="text-xs text-ink-500">{formatDate(mock.submittedAt)}</p>
                    </div>
                    <Badge tone={accuracyTone((mock.percentage || 0) / 100)} size="sm">
                      {Math.round(mock.percentage || 0)}%
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-500">No mock paper has been sat yet.</p>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}

function Pagination({ meta, onPage }) {
  if (!meta || meta.pages <= 1) {
    return (
      <p className="border-t border-paper-200 px-4 py-3 text-xs text-ink-500">
        {meta?.total ?? 0} {meta?.total === 1 ? 'person' : 'people'}
      </p>
    );
  }

  const first = (meta.page - 1) * meta.limit + 1;
  const last = Math.min(meta.page * meta.limit, meta.total);

  return (
    <nav
      className="flex flex-col gap-3 border-t border-paper-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      aria-label="People pages"
    >
      <p className="tabular text-xs text-ink-500">
        Showing {first}–{last} of {meta.total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
          icon={<Icon name="chevronLeft" size={14} strokeStyle />}
        >
          Previous
        </Button>
        <span className="tabular px-1 text-xs text-ink-600">
          Page {meta.page} of {meta.pages}
        </span>
        <Button
          size="sm"
          variant="secondary"
          disabled={meta.page >= meta.pages}
          onClick={() => onPage(meta.page + 1)}
          iconRight={<Icon name="chevronRight" size={14} strokeStyle />}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}

function UsersSkeleton() {
  return (
    <div className="p-4" aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading people.</p>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className={cx('flex items-center gap-3 py-3', i > 0 && 'border-t border-paper-100')}>
          <Skeleton className="h-8 w-8" rounded="rounded-full" />
          <Skeleton className="h-4 w-40" rounded="rounded" />
          <Skeleton className="h-4 flex-1" rounded="rounded" />
          <Skeleton className="h-4 w-20" rounded="rounded" />
          <Skeleton className="h-4 w-16" rounded="rounded" />
        </div>
      ))}
    </div>
  );
}
