import { useEffect, useMemo, useState } from 'react';
import { adminApi, contentApi } from '@/services/api';
import { useAsync, useDocumentTitle } from '@/hooks';
import { useToast } from '@/context/ToastContext';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Icon,
  Input,
  Modal,
  Select,
  Skeleton,
  Textarea,
  cx,
} from '@/components/ui';
import { CONTENT_STATUS, QUESTION_TYPES } from '@shared/constants';
import { QUESTION_TYPE_LABELS, minutesLabel, plural } from '@/utils/format';

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

const KIND_LABELS = {
  fixed: 'Fixed paper',
  dynamic: 'Sampled afresh each sitting',
};

function blankSection(index) {
  return {
    key: String.fromCharCode(65 + index),
    label: `Section ${String.fromCharCode(65 + index)}`,
    instructions: '',
    questionTypes: [],
    count: 20,
    answerCount: '',
    marksEach: 1,
    sampling: { subject: '', easy: 0.3, medium: 0.5, hard: 0.2 },
  };
}

function blankPaper() {
  return {
    _id: null,
    exam: '',
    subject: '',
    code: '',
    title: '',
    description: '',
    instructions: '',
    kind: 'dynamic',
    durationMinutes: 90,
    passMark: 50,
    order: 0,
    status: CONTENT_STATUS.PUBLISHED,
    sections: [blankSection(0)],
  };
}

function toForm(paper) {
  const idOf = (value) => (value && typeof value === 'object' ? String(value._id) : value ? String(value) : '');
  return {
    ...blankPaper(),
    _id: paper._id,
    exam: idOf(paper.exam),
    subject: idOf(paper.subject),
    code: paper.code || '',
    title: paper.title || '',
    description: paper.description || '',
    instructions: paper.instructions || '',
    kind: paper.kind || 'dynamic',
    durationMinutes: paper.durationMinutes ?? 90,
    passMark: paper.passMark ?? 50,
    order: paper.order ?? 0,
    status: paper.status || CONTENT_STATUS.PUBLISHED,
    sections: (paper.sections || []).length
      ? paper.sections.map((section, index) => ({
          key: section.key || String.fromCharCode(65 + index),
          label: section.label || '',
          instructions: section.instructions || '',
          questionTypes: section.questionTypes || [],
          count: section.count ?? 1,
          answerCount: section.answerCount ?? '',
          marksEach: section.marksEach ?? 1,
          sampling: {
            subject: idOf(section.sampling?.subject),
            easy: section.sampling?.difficultyMix?.easy ?? 0.3,
            medium: section.sampling?.difficultyMix?.medium ?? 0.5,
            hard: section.sampling?.difficultyMix?.hard ?? 0.2,
          },
        }))
      : [blankSection(0)],
  };
}

function sectionMarks(section) {
  const answered = section.answerCount === '' || section.answerCount == null ? Number(section.count) : Number(section.answerCount);
  return (Number.isFinite(answered) ? answered : 0) * (Number(section.marksEach) || 0);
}

function mixSum(section) {
  return (
    (Number(section.sampling.easy) || 0) + (Number(section.sampling.medium) || 0) + (Number(section.sampling.hard) || 0)
  );
}

export default function AdminMockExamsPage() {
  useDocumentTitle('Mock examinations');

  const toast = useToast();
  const { data, error, loading, reload } = useAsync(() => adminApi.mockExams(), []);
  const exams = useAsync(() => adminApi.exams(), []);

  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const papers = data?.mockExams || [];

  const doDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const result = await adminApi.deleteMockExam(confirmDelete._id);
      if (result?.archivedInsteadOfDeleted) {
        toast.info(`“${confirmDelete.title}” was archived rather than deleted, because ${result.attempts} sittings refer to it.`);
      } else {
        toast.success(`“${confirmDelete.title}” was deleted.`);
      }
      setConfirmDelete(null);
      await reload();
    } catch (err) {
      toast.error(err.message || 'That paper could not be removed.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink-900">Mock examinations</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-500">
            The papers candidates sit under timed conditions. A fixed paper reproduces a real sitting exactly; a sampled
            paper is drawn fresh from the bank each time, so it can be retaken.
          </p>
        </div>
        <Button onClick={() => setEditing(blankPaper())} icon={<Icon name="plus" size={16} />} className="shrink-0">
          New paper
        </Button>
      </header>

      {loading && (
        <div className="space-y-3" aria-busy="true" aria-live="polite">
          <p className="sr-only">Loading mock examinations.</p>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" rounded="rounded-xl" />
          ))}
        </div>
      )}

      {!loading && error && (
        <Card>
          <ErrorState error={error} onRetry={reload} />
        </Card>
      )}

      {!loading && !error && papers.length === 0 && (
        <Card>
          <EmptyState
            icon="exam"
            title="No mock papers yet"
            message="A mock paper puts a candidate under the same pressure as the real examination. Build one from the question bank."
            action={
              <Button onClick={() => setEditing(blankPaper())} icon={<Icon name="plus" size={16} />}>
                New paper
              </Button>
            }
          />
        </Card>
      )}

      {!loading && !error && papers.length > 0 && (
        <ul className="space-y-4">
          {papers.map((paper) => (
            <li key={paper._id}>
              <Card>
                <CardHeader
                  title={paper.title}
                  subtitle={paper.code}
                  icon={<Icon name="exam" size={18} />}
                  action={
                    <div className="flex shrink-0 gap-1.5">
                      <Button variant="secondary" size="sm" onClick={() => setEditing(toForm(paper))} icon={<Icon name="pen" size={14} />}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(paper)} icon={<Icon name="trash" size={14} />}>
                        Remove
                      </Button>
                    </div>
                  }
                />
                <div className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={STATUS_TONES[paper.status]} size="sm">
                      {STATUS_LABELS[paper.status] || paper.status}
                    </Badge>
                    <Badge tone={paper.kind === 'fixed' ? 'gold' : 'brand'} size="sm">
                      {KIND_LABELS[paper.kind] || paper.kind}
                    </Badge>
                    {paper.subject?.shortName && (
                      <Badge tone="outline" size="sm">
                        {paper.subject.shortName}
                      </Badge>
                    )}
                    <span className="flex items-center gap-1 text-xs text-ink-500">
                      <Icon name="clock" size={13} />
                      {minutesLabel(paper.durationMinutes)}
                    </span>
                    <span className="tabular text-xs text-ink-500">{paper.totalMarks || 0} marks</span>
                    <span className="tabular text-xs text-ink-500">Pass mark {paper.passMark}%</span>
                  </div>

                  {paper.description && <p className="text-sm leading-relaxed text-ink-600">{paper.description}</p>}

                  {paper.sections?.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[36rem] border-collapse text-sm">
                        <caption className="sr-only">Sections of {paper.title}</caption>
                        <thead>
                          <tr className="border-b border-paper-200 text-left text-xs uppercase tracking-wide text-ink-400">
                            <th scope="col" className="py-2 pr-3 font-medium">Section</th>
                            <th scope="col" className="px-3 py-2 font-medium">Types</th>
                            <th scope="col" className="px-3 py-2 text-right font-medium">Set</th>
                            <th scope="col" className="px-3 py-2 text-right font-medium">To answer</th>
                            <th scope="col" className="px-3 py-2 text-right font-medium">Marks each</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paper.sections.map((section) => (
                            <tr key={section.key} className="border-b border-paper-100 last:border-0">
                              <th scope="row" className="py-2 pr-3 text-left font-normal text-ink-700">
                                {section.label}
                              </th>
                              <td className="px-3 py-2 text-xs text-ink-600">
                                {(section.questionTypes || []).map((t) => QUESTION_TYPE_LABELS[t] || t).join(', ') || 'Any type'}
                              </td>
                              <td className="tabular px-3 py-2 text-right text-ink-600">{section.count}</td>
                              <td className="tabular px-3 py-2 text-right text-ink-600">{section.answerCount ?? section.count}</td>
                              <td className="tabular px-3 py-2 text-right text-ink-600">{section.marksEach}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <PaperEditor
          value={editing}
          exams={exams.data?.exams || []}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        loading={deleting}
        tone="danger"
        confirmLabel="Remove paper"
        title={`Remove “${confirmDelete?.title || 'this paper'}”?`}
        message="If any candidate has sat this paper, it will be archived rather than deleted, so their results and review stay intact. It will no longer be offered to anyone."
      />
    </div>
  );
}

function PaperEditor({ value, exams, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(value);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const isNew = !form._id;

  // A paper defaults to the first stage so the subject list has a scope.
  useEffect(() => {
    if (!form.exam && exams.length) setForm((current) => ({ ...current, exam: String(exams[0]._id) }));
  }, [exams, form.exam]);

  const subjects = useAsync(async () => {
    if (!form.exam) return { subjects: [] };
    return contentApi.subjects({ exam: form.exam });
  }, [form.exam]);

  const patch = (changes) => setForm((current) => ({ ...current, ...changes }));

  const setSection = (index, changes) =>
    setForm((current) => ({
      ...current,
      sections: current.sections.map((section, i) => (i === index ? { ...section, ...changes } : section)),
    }));

  const setSampling = (index, changes) =>
    setForm((current) => ({
      ...current,
      sections: current.sections.map((section, i) =>
        i === index ? { ...section, sampling: { ...section.sampling, ...changes } } : section,
      ),
    }));

  const addSection = () => setForm((current) => ({ ...current, sections: [...current.sections, blankSection(current.sections.length)] }));

  const removeSection = (index) =>
    setForm((current) => ({
      ...current,
      sections: current.sections.length === 1 ? current.sections : current.sections.filter((_, i) => i !== index),
    }));

  const totalMarks = useMemo(() => form.sections.reduce((sum, section) => sum + sectionMarks(section), 0), [form.sections]);

  const validate = () => {
    const found = {};
    if (!form.exam) found.exam = 'Choose an examination stage.';
    if (!form.code.trim() || form.code.trim().length < 2) found.code = 'Give the paper a code.';
    if (!form.title.trim() || form.title.trim().length < 2) found.title = 'Give the paper a title.';
    if (!Number(form.durationMinutes) || Number(form.durationMinutes) < 5) found.durationMinutes = 'A paper lasts at least five minutes.';
    if (!form.sections.length) found.sections = 'A paper needs at least one section.';

    form.sections.forEach((section, index) => {
      if (!section.key.trim()) found[`sections.${index}.key`] = 'Give the section a key.';
      if (!section.label.trim()) found[`sections.${index}.label`] = 'Give the section a label.';
      if (!Number(section.count) || Number(section.count) < 1) found[`sections.${index}.count`] = 'Set how many questions are presented.';
      if (section.answerCount !== '' && Number(section.answerCount) > Number(section.count)) {
        found[`sections.${index}.answerCount`] = 'A candidate cannot answer more questions than the section sets.';
      }
    });
    return found;
  };

  const save = async (event) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error('Some details need attention before this can be saved.');
      return;
    }

    const payload = {
      exam: form.exam,
      subject: form.subject || null,
      code: form.code.trim(),
      title: form.title.trim(),
      description: form.description.trim(),
      instructions: form.instructions.trim(),
      kind: form.kind,
      durationMinutes: Number(form.durationMinutes),
      passMark: Number(form.passMark) || 0,
      order: Number(form.order) || 0,
      status: form.status,
      sections: form.sections.map((section) => ({
        key: section.key.trim(),
        label: section.label.trim(),
        instructions: section.instructions.trim(),
        questionTypes: section.questionTypes,
        count: Number(section.count),
        answerCount: section.answerCount === '' ? null : Number(section.answerCount),
        marksEach: Number(section.marksEach) || 1,
        questions: [],
        sampling:
          form.kind === 'dynamic'
            ? {
                subject: section.sampling.subject || null,
                chapters: [],
                topics: [],
                difficultyMix: {
                  easy: Number(section.sampling.easy) || 0,
                  medium: Number(section.sampling.medium) || 0,
                  hard: Number(section.sampling.hard) || 0,
                },
              }
            : undefined,
      })),
    };

    setSaving(true);
    try {
      if (isNew) {
        await adminApi.createMockExam(payload);
        toast.success(`“${payload.title}” was created.`);
      } else {
        await adminApi.updateMockExam(form._id, payload);
        toast.success('Your changes were saved.');
      }
      await onSaved();
    } catch (err) {
      const details = Array.isArray(err.details) ? err.details : [];
      const mapped = {};
      details.forEach((detail) => {
        if (detail.field) mapped[detail.field] = detail.message;
      });
      setErrors(mapped);
      toast.error(err.message || 'That paper could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={isNew ? 'New mock examination' : `Edit ${form.title || 'paper'}`}
      description="Candidates sit this under timed conditions, so the shape of the paper matters as much as its questions."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} icon={<Icon name="check" size={16} />}>
            {isNew ? 'Create paper' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="space-y-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Examination stage"
            required
            value={form.exam}
            error={errors.exam}
            onChange={(e) => patch({ exam: e.target.value, subject: '' })}
          >
            <option value="">Choose a stage…</option>
            {exams.map((exam) => (
              <option key={exam._id} value={exam._id}>
                {exam.name}
              </option>
            ))}
          </Select>

          <Select
            label="Subject"
            value={form.subject}
            error={errors.subject}
            disabled={!form.exam || subjects.loading}
            hint="Leave blank for a paper that spans every subject."
            onChange={(e) => patch({ subject: e.target.value })}
          >
            <option value="">Every subject</option>
            {(subjects.data?.subjects || []).map((subject) => (
              <option key={subject._id} value={subject._id}>
                {subject.name}
              </option>
            ))}
          </Select>

          <Input
            label="Code"
            required
            value={form.code}
            error={errors.code}
            placeholder="DOC-MOCK-01"
            onChange={(e) => patch({ code: e.target.value })}
          />
          <Input
            label="Title"
            required
            value={form.title}
            error={errors.title}
            placeholder="Doctrine — full paper"
            onChange={(e) => patch({ title: e.target.value })}
          />
        </div>

        <Textarea
          label="Description"
          rows={2}
          value={form.description}
          error={errors.description}
          onChange={(e) => patch({ description: e.target.value })}
          hint="Shown to the candidate before they begin."
        />

        <Textarea
          label="Instructions"
          rows={3}
          value={form.instructions}
          error={errors.instructions}
          onChange={(e) => patch({ instructions: e.target.value })}
          hint="Printed at the head of the paper, as on the real examination."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Kind" value={form.kind} onChange={(e) => patch({ kind: e.target.value })}>
            <option value="dynamic">Sampled afresh each sitting</option>
            <option value="fixed">Fixed paper</option>
          </Select>
          <Input
            label="Duration in minutes"
            required
            type="number"
            min="5"
            max="360"
            value={form.durationMinutes}
            error={errors.durationMinutes}
            onChange={(e) => patch({ durationMinutes: e.target.value })}
          />
          <Input
            label="Pass mark (%)"
            type="number"
            min="0"
            max="100"
            value={form.passMark}
            error={errors.passMark}
            onChange={(e) => patch({ passMark: e.target.value })}
          />
          <Input
            label="Order"
            type="number"
            min="0"
            value={form.order}
            error={errors.order}
            hint="Lower papers are listed first."
            onChange={(e) => patch({ order: e.target.value })}
          />
        </div>

        <Select label="Status" value={form.status} onChange={(e) => patch({ status: e.target.value })}>
          {Object.values(CONTENT_STATUS).map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </Select>

        {form.kind === 'fixed' && (
          <p className="flex items-start gap-2 rounded-lg bg-paper-100 p-3 text-xs leading-relaxed text-ink-600">
            <Icon name="info" size={14} className="mt-px" />
            A fixed paper carries an explicit list of questions. The list is set from the question bank; the sections
            below describe its shape and marking.
          </p>
        )}

        {/* ------------------------------------------------------- sections */}
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-ink-700">Sections</legend>
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-paper-100 px-3 py-2 text-sm text-ink-600">
            <Icon name="info" size={15} />
            <span className="tabular">This paper is worth {totalMarks} marks in total.</span>
          </div>

          {errors.sections && (
            <p className="mb-2 text-xs text-danger-600" role="alert">
              {errors.sections}
            </p>
          )}

          <ul className="space-y-4">
            {form.sections.map((section, index) => {
              const sum = mixSum(section);
              const mixOff = form.kind === 'dynamic' && Math.abs(sum - 1) > 0.001;
              return (
                <li key={index} className="rounded-xl border border-paper-300 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="font-serif text-sm font-semibold text-ink-800">
                      {section.label || `Section ${index + 1}`}
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="tabular text-xs text-ink-500">{sectionMarks(section)} marks</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSection(index)}
                        disabled={form.sections.length === 1}
                        icon={<Icon name="trash" size={14} />}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[5rem_1fr]">
                    <Input
                      label="Key"
                      value={section.key}
                      error={errors[`sections.${index}.key`]}
                      onChange={(e) => setSection(index, { key: e.target.value.toUpperCase() })}
                    />
                    <Input
                      label="Label"
                      value={section.label}
                      error={errors[`sections.${index}.label`]}
                      placeholder="Section A — Objective"
                      onChange={(e) => setSection(index, { label: e.target.value })}
                    />
                  </div>

                  <Textarea
                    className="mt-3"
                    label="Instructions"
                    rows={2}
                    value={section.instructions}
                    onChange={(e) => setSection(index, { instructions: e.target.value })}
                    hint="Printed above this section, for example “Answer any four questions”."
                  />

                  <fieldset className="mt-3">
                    <legend className="mb-1.5 text-sm font-medium text-ink-700">Question types</legend>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {Object.values(QUESTION_TYPES).map((type) => (
                        <Checkbox
                          key={type}
                          label={QUESTION_TYPE_LABELS[type]}
                          checked={section.questionTypes.includes(type)}
                          onChange={(e) =>
                            setSection(index, {
                              questionTypes: e.target.checked
                                ? [...section.questionTypes, type]
                                : section.questionTypes.filter((t) => t !== type),
                            })
                          }
                        />
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-ink-500">Leave every box clear to allow any type.</p>
                  </fieldset>

                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <Input
                      label="Questions set"
                      type="number"
                      min="1"
                      value={section.count}
                      error={errors[`sections.${index}.count`]}
                      onChange={(e) => setSection(index, { count: e.target.value })}
                    />
                    <Input
                      label="Questions to answer"
                      type="number"
                      min="1"
                      value={section.answerCount}
                      error={errors[`sections.${index}.answerCount`]}
                      hint="Blank means all of them."
                      onChange={(e) => setSection(index, { answerCount: e.target.value })}
                    />
                    <Input
                      label="Marks each"
                      type="number"
                      min="0"
                      value={section.marksEach}
                      error={errors[`sections.${index}.marksEach`]}
                      onChange={(e) => setSection(index, { marksEach: e.target.value })}
                    />
                  </div>

                  {form.kind === 'dynamic' && (
                    <fieldset className="mt-3 rounded-lg border border-paper-200 bg-paper-50 p-3">
                      <legend className="px-1.5 text-sm font-medium text-ink-700">Sampling</legend>

                      <Select
                        label="Draw from subject"
                        value={section.sampling.subject}
                        disabled={!form.exam || subjects.loading}
                        onChange={(e) => setSampling(index, { subject: e.target.value })}
                        hint="Leave blank to draw from the whole paper's subject."
                      >
                        <option value="">Any subject</option>
                        {(subjects.data?.subjects || []).map((subject) => (
                          <option key={subject._id} value={subject._id}>
                            {subject.name}
                          </option>
                        ))}
                      </Select>

                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <Input
                          label="Easy"
                          type="number"
                          step="0.05"
                          min="0"
                          max="1"
                          value={section.sampling.easy}
                          onChange={(e) => setSampling(index, { easy: e.target.value })}
                        />
                        <Input
                          label="Medium"
                          type="number"
                          step="0.05"
                          min="0"
                          max="1"
                          value={section.sampling.medium}
                          onChange={(e) => setSampling(index, { medium: e.target.value })}
                        />
                        <Input
                          label="Hard"
                          type="number"
                          step="0.05"
                          min="0"
                          max="1"
                          value={section.sampling.hard}
                          onChange={(e) => setSampling(index, { hard: e.target.value })}
                        />
                      </div>

                      <p
                        className={cx(
                          'mt-2 flex items-center gap-1.5 text-xs',
                          mixOff ? 'text-warning-600' : 'text-ink-500',
                        )}
                        role={mixOff ? 'alert' : undefined}
                      >
                        <Icon name={mixOff ? 'alert' : 'info'} size={13} />
                        <span className="tabular">The difficulty mix adds up to {sum.toFixed(2)}.</span>
                        {mixOff && <span>It should add up to 1.00.</span>}
                      </p>
                    </fieldset>
                  )}
                </li>
              );
            })}
          </ul>

          <Button className="mt-3" variant="secondary" size="sm" onClick={addSection} icon={<Icon name="plus" size={14} />}>
            Add a section
          </Button>
        </fieldset>

        <p className="text-xs text-ink-500">
          {plural(form.sections.length, 'section')} · {minutesLabel(Number(form.durationMinutes) || 0)} ·{' '}
          {totalMarks} marks
        </p>
      </form>
    </Modal>
  );
}
