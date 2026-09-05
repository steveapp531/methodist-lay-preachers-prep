import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminApi, contentApi } from '@/services/api';
import { useAsync, useDebounced, useDocumentTitle } from '@/hooks';
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
  ProgressBar,
  Select,
  Skeleton,
  SourceBadge,
  cx,
} from '@/components/ui';
import { ANSWER_CONFIDENCE, CONTENT_STATUS, DIFFICULTIES, QUESTION_TYPES, SOURCE_KIND } from '@shared/constants';
import { DIFFICULTY_LABELS, DIFFICULTY_TONES, QUESTION_TYPE_LABELS, accuracyTone, percent } from '@/utils/format';

const STATUS_LABELS = {
  [CONTENT_STATUS.DRAFT]: 'Draft',
  [CONTENT_STATUS.NEEDS_REVIEW]: 'Needs review',
  [CONTENT_STATUS.PUBLISHED]: 'Published',
  [CONTENT_STATUS.ARCHIVED]: 'Archived',
};

const STATUS_TONES = {
  [CONTENT_STATUS.DRAFT]: 'neutral',
  [CONTENT_STATUS.NEEDS_REVIEW]: 'warning',
  [CONTENT_STATUS.PUBLISHED]: 'success',
  [CONTENT_STATUS.ARCHIVED]: 'outline',
};

const STATUS_ICONS = {
  [CONTENT_STATUS.DRAFT]: 'pen',
  [CONTENT_STATUS.NEEDS_REVIEW]: 'alert',
  [CONTENT_STATUS.PUBLISHED]: 'check',
  [CONTENT_STATUS.ARCHIVED]: 'inbox',
};

const SOURCE_LABELS = {
  [SOURCE_KIND.PAST_PAPER]: 'Official past paper',
  [SOURCE_KIND.MANUAL_DERIVED]: 'From the syllabus',
  [SOURCE_KIND.DEMO]: 'Demo content',
};

const CONFIDENCE_LABELS = {
  [ANSWER_CONFIDENCE.VERIFIED]: 'Verified',
  [ANSWER_CONFIDENCE.PROVISIONAL]: 'Provisional',
  [ANSWER_CONFIDENCE.UNVERIFIED]: 'Unverified',
};

const SORTS = [
  { value: '', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'hardest', label: 'Lowest accuracy first' },
];

/** Filters that live in the query string, with the label used in the "active filters" row. */
const FILTER_FIELDS = [
  { key: 'search', label: 'Search' },
  { key: 'subject', label: 'Subject' },
  { key: 'type', label: 'Type' },
  { key: 'difficulty', label: 'Difficulty' },
  { key: 'status', label: 'Status' },
  { key: 'sourceKind', label: 'Source' },
  { key: 'answerConfidence', label: 'Answer confidence' },
  { key: 'year', label: 'Year' },
];

const YEARS = (() => {
  const now = new Date().getFullYear();
  return Array.from({ length: 21 }, (_, i) => now - i);
})();

export default function AdminQuestionsPage() {
  useDocumentTitle('Question bank');

  const toast = useToast();
  const [params, setParams] = useSearchParams();

  const filters = useMemo(
    () => ({
      search: params.get('search') || '',
      subject: params.get('subject') || '',
      type: params.get('type') || '',
      difficulty: params.get('difficulty') || '',
      status: params.get('status') || '',
      sourceKind: params.get('sourceKind') || '',
      answerConfidence: params.get('answerConfidence') || '',
      year: params.get('year') || '',
      sort: params.get('sort') || '',
      page: Number(params.get('page')) || 1,
    }),
    [params],
  );

  const [searchText, setSearchText] = useState(filters.search);
  const debouncedSearch = useDebounced(searchText, 350);

  // Typing writes into the URL once it settles, so a filtered view can be shared.
  useEffect(() => {
    if (debouncedSearch === filters.search) return;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (debouncedSearch) next.set('search', debouncedSearch);
        else next.delete('search');
        next.delete('page');
        return next;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // A filter changed elsewhere (a link from the overview, the back button).
  useEffect(() => {
    setSearchText((current) => (current === filters.search ? current : filters.search));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search]);

  const setFilter = useCallback(
    (key, value) => {
      setParams((current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key !== 'page') next.delete('page');
        return next;
      });
    },
    [setParams],
  );

  const clearFilters = useCallback(() => {
    setSearchText('');
    setParams(new URLSearchParams());
  }, [setParams]);

  // Subjects are scoped to an examination, and an administrator is not
  // necessarily sitting one, so every stage is asked for and the results merged.
  const subjects = useAsync(async () => {
    const { exams = [] } = (await adminApi.exams()) || {};
    const lists = await Promise.all(
      exams.map((exam) => contentApi.subjects({ exam: exam._id }).catch(() => ({ subjects: [] }))),
    );
    const seen = new Map();
    lists.forEach((list) => (list?.subjects || []).forEach((subject) => seen.set(subject._id, subject)));
    return { subjects: [...seen.values()] };
  }, []);

  const query = useMemo(
    () => ({
      page: filters.page,
      limit: 25,
      search: filters.search || undefined,
      subject: filters.subject || undefined,
      type: filters.type || undefined,
      difficulty: filters.difficulty || undefined,
      status: filters.status || undefined,
      sourceKind: filters.sourceKind || undefined,
      answerConfidence: filters.answerConfidence || undefined,
      year: filters.year || undefined,
      sort: filters.sort || undefined,
    }),
    [filters],
  );

  const { data, error, loading, reload } = useAsync(() => adminApi.questions(query), [JSON.stringify(query)]);

  const rows = data?.questions || [];
  const meta = data?._meta;

  const [selected, setSelected] = useState(() => new Set());
  const [bulk, setBulk] = useState(null); // { action, done, total }
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [rowBusy, setRowBusy] = useState(null);

  // A new page of results should never carry a stale selection.
  useEffect(() => setSelected(new Set()), [data]);

  const activeFilters = FILTER_FIELDS.filter((field) => filters[field.key]);

  const toggleRow = (id) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allOnPageSelected = rows.length > 0 && rows.every((row) => selected.has(row._id));

  const toggleAll = () =>
    setSelected(() => (allOnPageSelected ? new Set() : new Set(rows.map((row) => row._id))));

  const setStatus = async (question, status) => {
    setRowBusy(question._id);
    try {
      await adminApi.setQuestionStatus(question._id, status);
      toast.success(`${question.questionId} is now ${STATUS_LABELS[status].toLowerCase()}.`);
      await reload();
    } catch (err) {
      toast.error(err.message || 'That change could not be saved.');
    } finally {
      setRowBusy(null);
    }
  };

  /** Applied one at a time so a failure on row 12 does not lose rows 1 to 11. */
  const runBulk = async (status) => {
    const ids = rows.filter((row) => selected.has(row._id));
    if (!ids.length) return;

    setBulk({ action: status, done: 0, total: ids.length, failed: 0 });
    let failed = 0;
    for (const [index, question] of ids.entries()) {
      try {
        await adminApi.setQuestionStatus(question._id, status);
      } catch {
        failed += 1;
      }
      setBulk({ action: status, done: index + 1, total: ids.length, failed });
    }
    setBulk(null);

    if (failed) toast.warning(`${ids.length - failed} of ${ids.length} updated. ${failed} could not be changed.`);
    else toast.success(`${ids.length} ${ids.length === 1 ? 'question' : 'questions'} set to ${STATUS_LABELS[status].toLowerCase()}.`);

    setSelected(new Set());
    await reload();
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const result = await adminApi.deleteQuestion(confirmDelete._id);
      if (result?.archivedInsteadOfDeleted) {
        toast.info(
          `${confirmDelete.questionId} was archived rather than deleted, because ${result.attempts} attempts refer to it.`,
        );
      } else {
        toast.success(`${confirmDelete.questionId} was deleted.`);
      }
      setConfirmDelete(null);
      await reload();
    } catch (err) {
      toast.error(err.message || 'That question could not be removed.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink-900">Question bank</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-500">
            Everything candidates can be asked. Only published questions reach them; drafts and questions awaiting review
            are held back.
          </p>
        </div>
        <Button to="/admin/questions/new" icon={<Icon name="plus" size={16} />} className="shrink-0">
          New question
        </Button>
      </header>

      {/* ------------------------------------------------------------ filters */}
      <Card as="section" aria-label="Filter the question bank">
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Search"
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Question text, identifier or tag"
            className="sm:col-span-2 lg:col-span-2"
          />

          <Select
            label="Subject"
            value={filters.subject}
            onChange={(e) => setFilter('subject', e.target.value)}
            disabled={subjects.loading}
          >
            <option value="">Every subject</option>
            {(subjects.data?.subjects || []).map((subject) => (
              <option key={subject._id} value={subject._id}>
                {subject.name}
              </option>
            ))}
          </Select>

          <Select label="Type" value={filters.type} onChange={(e) => setFilter('type', e.target.value)}>
            <option value="">Every type</option>
            {Object.values(QUESTION_TYPES).map((type) => (
              <option key={type} value={type}>
                {QUESTION_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>

          <Select label="Difficulty" value={filters.difficulty} onChange={(e) => setFilter('difficulty', e.target.value)}>
            <option value="">Any difficulty</option>
            {Object.values(DIFFICULTIES).map((value) => (
              <option key={value} value={value}>
                {DIFFICULTY_LABELS[value]}
              </option>
            ))}
          </Select>

          <Select label="Status" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
            <option value="">Any status</option>
            {Object.values(CONTENT_STATUS).map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </Select>

          <Select label="Source" value={filters.sourceKind} onChange={(e) => setFilter('sourceKind', e.target.value)}>
            <option value="">Any source</option>
            {Object.values(SOURCE_KIND).map((value) => (
              <option key={value} value={value}>
                {SOURCE_LABELS[value]}
              </option>
            ))}
          </Select>

          <Select
            label="Answer confidence"
            value={filters.answerConfidence}
            onChange={(e) => setFilter('answerConfidence', e.target.value)}
          >
            <option value="">Any confidence</option>
            {Object.values(ANSWER_CONFIDENCE).map((value) => (
              <option key={value} value={value}>
                {CONFIDENCE_LABELS[value]}
              </option>
            ))}
          </Select>

          <Select label="Examination year" value={filters.year} onChange={(e) => setFilter('year', e.target.value)}>
            <option value="">Any year</option>
            {YEARS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </Select>

          <Select label="Order" value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)}>
            {SORTS.map((sort) => (
              <option key={sort.value} value={sort.value}>
                {sort.label}
              </option>
            ))}
          </Select>
        </div>

        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-paper-200 bg-paper-50 px-4 py-3">
            <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-500">
              <Icon name="filter" size={13} />
              Filtered
            </span>
            {activeFilters.map((field) => (
              <button
                key={field.key}
                type="button"
                onClick={() => setFilter(field.key, '')}
                className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800 hover:bg-brand-100"
              >
                {field.label}: {describeFilter(field.key, filters[field.key], subjects.data?.subjects)}
                <Icon name="close" size={11} />
                <span className="sr-only">Remove this filter</span>
              </button>
            ))}
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear all filters
            </Button>
          </div>
        )}
      </Card>

      {/* --------------------------------------------------------- bulk bar */}
      {selected.size > 0 && (
        <div className="sticky top-16 z-10 flex flex-col gap-3 rounded-xl border border-brand-300 bg-brand-50 p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-brand-800" role="status">
            {selected.size} {selected.size === 1 ? 'question' : 'questions'} selected on this page
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => runBulk(CONTENT_STATUS.PUBLISHED)} disabled={Boolean(bulk)}>
              Publish
            </Button>
            <Button size="sm" variant="secondary" onClick={() => runBulk(CONTENT_STATUS.DRAFT)} disabled={Boolean(bulk)}>
              Unpublish
            </Button>
            <Button size="sm" variant="secondary" onClick={() => runBulk(CONTENT_STATUS.NEEDS_REVIEW)} disabled={Boolean(bulk)}>
              Mark needs review
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={Boolean(bulk)}>
              Clear selection
            </Button>
          </div>
        </div>
      )}

      {bulk && (
        <div className="rounded-xl border border-paper-300 bg-white p-4" role="status" aria-live="polite">
          <ProgressBar
            value={bulk.done}
            max={bulk.total}
            tone="brand"
            label={`Applying “${STATUS_LABELS[bulk.action]}” — ${bulk.done} of ${bulk.total}`}
            showValue
          />
          {bulk.failed > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-danger-600">
              <Icon name="alert" size={13} />
              {bulk.failed} could not be changed. They will be listed again when the page reloads.
            </p>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------ results */}
      <Card>
        {loading && <TableSkeleton />}

        {!loading && error && <ErrorState error={error} onRetry={reload} />}

        {!loading && !error && rows.length === 0 && (
          <EmptyState
            icon="quiz"
            title={activeFilters.length ? 'No questions match those filters' : 'The question bank is empty'}
            message={
              activeFilters.length
                ? 'Try widening the search, or clear the filters to see the whole bank.'
                : 'Write a question by hand, or import a prepared set of records.'
            }
            action={
              activeFilters.length ? (
                <Button variant="secondary" onClick={clearFilters}>
                  Clear all filters
                </Button>
              ) : (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button to="/admin/questions/new" icon={<Icon name="plus" size={16} />}>
                    New question
                  </Button>
                  <Button variant="secondary" to="/admin/import" icon={<Icon name="upload" size={16} />}>
                    Import questions
                  </Button>
                </div>
              )
            }
          />
        )}

        {!loading && !error && rows.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[64rem] border-collapse text-sm">
                <caption className="sr-only">
                  Questions in the bank, with their identifier, text, type, placement, difficulty, source, status and
                  how candidates have performed on them.
                </caption>
                <thead>
                  <tr className="border-b border-paper-200 text-left text-xs uppercase tracking-wide text-ink-400">
                    <th scope="col" className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={toggleAll}
                        aria-label="Select every question on this page"
                        className="h-4 w-4 rounded border-paper-400 text-brand-600 focus:ring-brand-500"
                      />
                    </th>
                    <th scope="col" className="px-3 py-3 font-medium">Identifier</th>
                    <th scope="col" className="px-3 py-3 font-medium">Question</th>
                    <th scope="col" className="px-3 py-3 font-medium">Type</th>
                    <th scope="col" className="px-3 py-3 font-medium">Placement</th>
                    <th scope="col" className="px-3 py-3 font-medium">Difficulty</th>
                    <th scope="col" className="px-3 py-3 font-medium">Source</th>
                    <th scope="col" className="px-3 py-3 font-medium">Status</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">Attempts</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">Accuracy</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isSelected = selected.has(row._id);
                    const published = row.status === CONTENT_STATUS.PUBLISHED;
                    return (
                      <tr
                        key={row._id}
                        className={cx('border-b border-paper-100 last:border-0', isSelected ? 'bg-brand-50/60' : 'hover:bg-paper-50')}
                      >
                        <td className="px-4 py-3 align-top">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRow(row._id)}
                            aria-label={`Select ${row.questionId}`}
                            className="h-4 w-4 rounded border-paper-400 text-brand-600 focus:ring-brand-500"
                          />
                        </td>
                        <th scope="row" className="whitespace-nowrap px-3 py-3 text-left align-top">
                          <Link to={`/admin/questions/${row._id}`} className="tabular text-xs font-medium text-brand-700 hover:underline">
                            {row.questionId}
                          </Link>
                        </th>
                        <td className="max-w-sm px-3 py-3 align-top">
                          <Link to={`/admin/questions/${row._id}`} className="line-clamp-2 text-sm leading-snug text-ink-800 hover:text-brand-700">
                            {row.prompt}
                          </Link>
                          {row.answerConfidence === ANSWER_CONFIDENCE.UNVERIFIED && (
                            <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-warning-600">
                              <Icon name="alert" size={11} />
                              Answer not traced to the syllabus
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 align-top text-xs text-ink-600">
                          {QUESTION_TYPE_LABELS[row.type] || row.type}
                        </td>
                        <td className="max-w-[12rem] px-3 py-3 align-top text-xs text-ink-600">
                          <span className="block truncate font-medium text-ink-700">
                            {row.subject?.shortName || row.subject?.name || 'No subject'}
                          </span>
                          <span className="block truncate text-ink-500">{row.topic?.title || 'No topic'}</span>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <Badge tone={DIFFICULTY_TONES[row.difficulty]} size="sm">
                            {DIFFICULTY_LABELS[row.difficulty] || row.difficulty}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <SourceBadge sourceKind={row.sourceKind} source={row.source} answerConfidence={row.answerConfidence} />
                        </td>
                        <td className="px-3 py-3 align-top">
                          <Badge tone={STATUS_TONES[row.status]} size="sm" icon={<Icon name={STATUS_ICONS[row.status]} size={11} />}>
                            {STATUS_LABELS[row.status] || row.status}
                          </Badge>
                        </td>
                        <td className="tabular px-3 py-3 text-right align-top text-ink-600">{row.stats?.attempts ?? 0}</td>
                        <td className="px-3 py-3 text-right align-top">
                          {row.stats?.attempts ? (
                            <Badge tone={accuracyTone(row.stats.accuracy)} size="sm">
                              {percent(row.stats.accuracy)}
                            </Badge>
                          ) : (
                            <span className="text-xs text-ink-400">Not yet attempted</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              to={`/admin/questions/${row._id}`}
                              aria-label={`Edit ${row.questionId}`}
                              className="rounded-lg p-1.5 text-ink-500 hover:bg-paper-200 hover:text-ink-800"
                            >
                              <Icon name="pen" size={15} />
                            </Link>
                            <button
                              type="button"
                              onClick={() => setStatus(row, published ? CONTENT_STATUS.DRAFT : CONTENT_STATUS.PUBLISHED)}
                              disabled={rowBusy === row._id}
                              aria-label={published ? `Unpublish ${row.questionId}` : `Publish ${row.questionId}`}
                              className="rounded-lg p-1.5 text-ink-500 hover:bg-paper-200 hover:text-ink-800 disabled:opacity-50"
                            >
                              <Icon name={published ? 'stop' : 'check'} size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(row)}
                              aria-label={`Remove ${row.questionId}`}
                              className="rounded-lg p-1.5 text-ink-500 hover:bg-danger-50 hover:text-danger-600"
                            >
                              <Icon name="trash" size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination meta={meta} onPage={(page) => setFilter('page', String(page))} />
          </>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        loading={deleting}
        tone="danger"
        confirmLabel="Remove question"
        title={`Remove ${confirmDelete?.questionId || 'this question'}?`}
        message={
          confirmDelete?.stats?.attempts
            ? `Candidates have already answered this question ${confirmDelete.stats.attempts} times. It will be archived rather than deleted, so their results stay intact, and it will no longer be offered to anyone.`
            : 'This question has no attempt history, so it will be deleted outright. If any attempts are recorded by the time you confirm, it will be archived instead.'
        }
      />
    </div>
  );
}

function describeFilter(key, value, subjects) {
  if (key === 'subject') return subjects?.find((s) => s._id === value)?.shortName || subjects?.find((s) => s._id === value)?.name || 'chosen';
  if (key === 'type') return QUESTION_TYPE_LABELS[value] || value;
  if (key === 'difficulty') return DIFFICULTY_LABELS[value] || value;
  if (key === 'status') return STATUS_LABELS[value] || value;
  if (key === 'sourceKind') return SOURCE_LABELS[value] || value;
  if (key === 'answerConfidence') return CONFIDENCE_LABELS[value] || value;
  return value;
}

function Pagination({ meta, onPage }) {
  if (!meta || meta.pages <= 1) {
    return (
      <p className="border-t border-paper-200 px-4 py-3 text-xs text-ink-500">
        {meta?.total ?? 0} {meta?.total === 1 ? 'question' : 'questions'}
      </p>
    );
  }

  const first = (meta.page - 1) * meta.limit + 1;
  const last = Math.min(meta.page * meta.limit, meta.total);

  return (
    <nav
      className="flex flex-col gap-3 border-t border-paper-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Question bank pages"
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

function TableSkeleton() {
  return (
    <div className="p-4" aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading questions.</p>
      <Skeleton className="mb-3 h-8 w-full" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-paper-100 py-3 last:border-0">
          <Skeleton className="h-4 w-4" rounded="rounded" />
          <Skeleton className="h-4 w-24" rounded="rounded" />
          <Skeleton className="h-4 flex-1" rounded="rounded" />
          <Skeleton className="h-4 w-20" rounded="rounded" />
          <Skeleton className="h-4 w-16" rounded="rounded" />
        </div>
      ))}
    </div>
  );
}
