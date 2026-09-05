import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, api, contentApi } from '@/services/api';
import { useAsync, useDocumentTitle } from '@/hooks';
import { useToast } from '@/context/ToastContext';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  EmptyState,
  ErrorState,
  Icon,
  Input,
  Modal,
  Select,
  Skeleton,
  SkeletonText,
  StatTile,
  Textarea,
  cx,
} from '@/components/ui';
import { minutesLabel, plural } from '@/utils/format';

const COLOURS = [
  { value: 'brand', label: 'Indigo', dot: 'bg-brand-600' },
  { value: 'flame', label: 'Flame', dot: 'bg-flame-500' },
  { value: 'gold', label: 'Gold', dot: 'bg-gold-500' },
  { value: 'success', label: 'Green', dot: 'bg-success-500' },
  { value: 'warning', label: 'Amber', dot: 'bg-warning-500' },
  { value: 'danger', label: 'Red', dot: 'bg-danger-500' },
];

export default function AdminContentPage() {
  useDocumentTitle('Subjects and topics');

  const [selectedId, setSelectedId] = useState(null);
  const [editingSubject, setEditingSubject] = useState(null);
  const [editingTopicId, setEditingTopicId] = useState(null);

  // Subjects belong to an examination stage, and an administrator does not
  // necessarily sit one, so every stage is asked for and the results merged.
  const subjects = useAsync(async () => {
    const { exams = [] } = (await adminApi.exams()) || {};
    const lists = await Promise.all(
      exams.map(async (exam) => {
        const result = await contentApi.subjects({ exam: exam._id }).catch(() => ({ subjects: [] }));
        return (result?.subjects || []).map((subject) => ({ ...subject, examName: exam.shortName || exam.name }));
      }),
    );
    return { subjects: lists.flat() };
  }, []);

  const rows = subjects.data?.subjects || [];

  useEffect(() => {
    if (!selectedId && rows.length) setSelectedId(rows[0]._id);
  }, [rows, selectedId]);

  const detail = useAsync(async () => (selectedId ? contentApi.subject(selectedId) : null), [selectedId]);

  const selected = rows.find((row) => row._id === selectedId);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-serif text-2xl font-semibold text-ink-900">Subjects and topics</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-500">
          The shape of the syllabus as candidates read it.
        </p>
      </header>

      <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
        <Icon name="info" size={18} className="mt-0.5 shrink-0 text-brand-700" />
        <p className="text-sm leading-relaxed text-ink-700">
          The syllabus text itself is not edited here. Every passage a candidate reads in Study comes from the official
          manual import and is kept verbatim, with its anchor and citation, so it can always be checked against the
          printed book. What you can edit here is the study apparatus written around that text — summaries, key points,
          key terms and examination focus — and whether a subject or topic is published.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
        {/* ------------------------------------------------------- subjects */}
        <Card as="section" className="min-w-0">
          <CardHeader title="Subjects" subtitle={`${rows.length} in the syllabus`} icon={<Icon name="book" size={18} />} />

          {subjects.loading && (
            <div className="space-y-2 p-4" aria-busy="true" aria-live="polite">
              <p className="sr-only">Loading subjects.</p>
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16" rounded="rounded-lg" />
              ))}
            </div>
          )}

          {!subjects.loading && subjects.error && <ErrorState error={subjects.error} onRetry={subjects.reload} />}

          {!subjects.loading && !subjects.error && rows.length === 0 && (
            <EmptyState
              icon="book"
              title="No subjects have been loaded"
              message="Subjects, chapters and topics come from the official manual import. Run that import before adding questions."
            />
          )}

          {!subjects.loading && !subjects.error && rows.length > 0 && (
            <ul className="divide-y divide-paper-100">
              {rows.map((subject) => {
                const isSelected = subject._id === selectedId;
                return (
                  <li key={subject._id}>
                    <div
                      className={cx(
                        'flex items-start gap-2 px-3 py-3 transition-colors',
                        isSelected ? 'bg-brand-50' : 'hover:bg-paper-50',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedId(subject._id)}
                        aria-current={isSelected ? 'true' : undefined}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={cx(
                              'h-2.5 w-2.5 shrink-0 rounded-full',
                              COLOURS.find((c) => c.value === subject.colour)?.dot || 'bg-brand-600',
                            )}
                            aria-hidden="true"
                          />
                          <span className="truncate text-sm font-medium text-ink-800">{subject.name}</span>
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
                          <Badge tone="outline" size="sm">
                            {subject.code}
                          </Badge>
                          {subject.examName && <span>{subject.examName}</span>}
                          <span>·</span>
                          <span className="tabular">{plural(subject.stats?.topicCount || 0, 'topic')}</span>
                          <span>·</span>
                          <span className="tabular">{plural(subject.stats?.questionCount || 0, 'question')}</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingSubject(subject)}
                        aria-label={`Edit ${subject.name}`}
                        className="mt-0.5 rounded-lg p-1.5 text-ink-500 hover:bg-paper-200 hover:text-ink-800"
                      >
                        <Icon name="pen" size={15} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="border-t border-paper-200 px-4 py-3 text-xs leading-relaxed text-ink-500">
            Only published subjects are listed. Unpublishing a subject removes it from this list as well as from Study.
          </p>
        </Card>

        {/* ---------------------------------------------------- subject tree */}
        <div className="min-w-0 space-y-5">
          {selected && (
            <Card as="section">
              <CardHeader
                title={selected.name}
                subtitle={selected.paper || selected.shortName}
                icon={<Icon name="stack" size={18} />}
                action={
                  <Button variant="secondary" size="sm" onClick={() => setEditingSubject(selected)} icon={<Icon name="pen" size={14} />}>
                    Edit subject
                  </Button>
                }
              />
              <div className="space-y-4 p-5">
                {selected.description && <p className="text-sm leading-relaxed text-ink-600">{selected.description}</p>}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatTile label="Chapters" value={selected.stats?.chapterCount || 0} />
                  <StatTile label="Topics" value={selected.stats?.topicCount || 0} />
                  <StatTile label="Questions" value={selected.stats?.questionCount || 0} tone="brand" />
                  <StatTile
                    label="Words of syllabus"
                    value={(selected.stats?.wordCount || 0).toLocaleString('en-GB')}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" size="sm" to={`/admin/questions?subject=${selected._id}`} icon={<Icon name="quiz" size={14} />}>
                    Questions in this subject
                  </Button>
                  <Button variant="ghost" size="sm" to={`/study/subject/${selected._id}`} icon={<Icon name="eye" size={14} />}>
                    See it as a candidate does
                  </Button>
                </div>
              </div>
            </Card>
          )}

          <Card as="section">
            <CardHeader
              title="Chapters and topics"
              subtitle="Expand a chapter to see its topics."
              icon={<Icon name="scroll" size={18} />}
            />

            {detail.loading && (
              <div className="space-y-3 p-5" aria-busy="true" aria-live="polite">
                <p className="sr-only">Loading chapters and topics.</p>
                <SkeletonText lines={8} />
              </div>
            )}

            {!detail.loading && detail.error && <ErrorState error={detail.error} onRetry={detail.reload} />}

            {!detail.loading && !detail.error && !detail.data && (
              <EmptyState icon="book" title="Choose a subject" message="Pick a subject on the left to see its chapters and topics." />
            )}

            {!detail.loading && !detail.error && detail.data && detail.data.chapters?.length === 0 && (
              <EmptyState
                icon="scroll"
                title="This subject has no published chapters"
                message="Chapters and topics come from the manual import. Run the import, or check whether they have been unpublished."
              />
            )}

            {!detail.loading && !detail.error && detail.data?.chapters?.length > 0 && (
              <ul className="divide-y divide-paper-200">
                {detail.data.chapters.map((chapter) => (
                  <li key={chapter._id}>
                    <details className="group" open>
                      <summary className="flex cursor-pointer items-center gap-2.5 px-5 py-3.5 hover:bg-paper-50">
                        <Icon name="chevronRight" size={16} strokeStyle className="shrink-0 text-ink-400 transition-transform group-open:rotate-90" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-serif text-sm font-semibold text-ink-800">
                            {chapter.number ? `${chapter.number}. ` : ''}
                            {chapter.title}
                          </span>
                          <span className="text-xs text-ink-500">
                            {plural(chapter.topics?.length || 0, 'topic')}
                            {chapter.stats?.wordCount ? ` · ${chapter.stats.wordCount.toLocaleString('en-GB')} words` : ''}
                          </span>
                        </span>
                      </summary>

                      {chapter.topics?.length ? (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[40rem] border-collapse text-sm">
                            <caption className="sr-only">Topics in {chapter.title}</caption>
                            <thead>
                              <tr className="border-y border-paper-200 bg-paper-50 text-left text-xs uppercase tracking-wide text-ink-400">
                                <th scope="col" className="py-2 pl-12 pr-3 font-medium">Topic</th>
                                <th scope="col" className="px-3 py-2 text-right font-medium">Words</th>
                                <th scope="col" className="px-3 py-2 text-right font-medium">Reading</th>
                                <th scope="col" className="px-3 py-2 text-right font-medium">Questions</th>
                                <th scope="col" className="px-3 py-2 font-medium">State</th>
                                <th scope="col" className="px-5 py-2 text-right font-medium">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {chapter.topics.map((topic) => (
                                <tr key={topic._id} className="border-b border-paper-100 last:border-0 hover:bg-paper-50">
                                  <th scope="row" className="py-2.5 pl-12 pr-3 text-left font-normal">
                                    <Link to={`/study/topic/${topic._id}`} className="text-sm text-ink-800 hover:text-brand-700">
                                      {topic.number ? `${topic.number}. ` : ''}
                                      {topic.title}
                                    </Link>
                                  </th>
                                  <td className="tabular px-3 py-2.5 text-right text-xs text-ink-600">
                                    {(topic.wordCount || 0).toLocaleString('en-GB')}
                                  </td>
                                  <td className="px-3 py-2.5 text-right text-xs text-ink-600">
                                    {minutesLabel(topic.estimatedMinutes || 0)}
                                  </td>
                                  <td className="tabular px-3 py-2.5 text-right text-xs text-ink-600">
                                    {topic.stats?.questionCount ?? 0}
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <Badge tone="success" size="sm" icon={<Icon name="check" size={11} />}>
                                      Published
                                    </Badge>
                                  </td>
                                  <td className="px-5 py-2.5 text-right">
                                    <Button variant="ghost" size="sm" onClick={() => setEditingTopicId(topic._id)} icon={<Icon name="pen" size={14} />}>
                                      Edit
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="px-12 pb-4 text-sm text-ink-500">This chapter has no published topics.</p>
                      )}
                    </details>
                  </li>
                ))}
              </ul>
            )}

            <p className="border-t border-paper-200 px-5 py-3 text-xs leading-relaxed text-ink-500">
              This tree shows published chapters and topics. A topic you unpublish disappears from here, and from
              Study, until it is published again.
            </p>
          </Card>
        </div>
      </div>

      {editingSubject && (
        <SubjectEditor
          subject={editingSubject}
          onClose={() => setEditingSubject(null)}
          onSaved={async () => {
            setEditingSubject(null);
            await subjects.reload();
            await detail.reload();
          }}
        />
      )}

      {editingTopicId && (
        <TopicEditor
          topicId={editingTopicId}
          onClose={() => setEditingTopicId(null)}
          onSaved={async () => {
            setEditingTopicId(null);
            await detail.reload();
            await subjects.reload();
          }}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- editors --- */

function SubjectEditor({ subject, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: subject.name || '',
    shortName: subject.shortName || '',
    paper: subject.paper || '',
    description: subject.description || '',
    order: subject.order ?? 0,
    colour: subject.colour || 'brand',
    isPublished: subject.isPublished !== false,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const patch = (changes) => setForm((current) => ({ ...current, ...changes }));

  const save = async (event) => {
    event.preventDefault();
    const found = {};
    if (!form.name.trim() || form.name.trim().length < 2) found.name = 'A subject needs a name.';
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      // The client exposes no subject update helper, so the generic verb is used.
      await api.patch(`/admin/subjects/${subject._id}`, {
        name: form.name.trim(),
        shortName: form.shortName.trim(),
        paper: form.paper.trim(),
        description: form.description.trim(),
        order: Number(form.order) || 0,
        colour: form.colour,
        isPublished: form.isPublished,
      });
      toast.success(`${form.name.trim()} was saved.`);
      await onSaved();
    } catch (err) {
      const details = Array.isArray(err.details) ? err.details : [];
      const mapped = {};
      details.forEach((detail) => {
        if (detail.field) mapped[detail.field] = detail.message;
      });
      setErrors(mapped);
      toast.error(err.message || 'That subject could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Edit ${subject.name}`}
      description="The chapters and topics beneath a subject come from the manual import and are not changed here."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} icon={<Icon name="check" size={16} />}>
            Save subject
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Name" required value={form.name} error={errors.name} onChange={(e) => patch({ name: e.target.value })} />
          <Input
            label="Short name"
            value={form.shortName}
            error={errors.shortName}
            hint="Used where space is tight, for example “Doctrine”."
            onChange={(e) => patch({ shortName: e.target.value })}
          />
          <Input
            label="Paper"
            value={form.paper}
            error={errors.paper}
            hint="The paper title as printed on the examination question paper."
            onChange={(e) => patch({ paper: e.target.value })}
            className="sm:col-span-2"
          />
        </div>

        <Textarea
          label="Description"
          rows={3}
          value={form.description}
          error={errors.description}
          onChange={(e) => patch({ description: e.target.value })}
          hint="Shown to candidates above the chapter list."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Order"
            type="number"
            min="0"
            value={form.order}
            error={errors.order}
            hint="Lower subjects are listed first."
            onChange={(e) => patch({ order: e.target.value })}
          />
          <div>
            <Select label="Colour" value={form.colour} onChange={(e) => patch({ colour: e.target.value })}>
              {COLOURS.map((colour) => (
                <option key={colour.value} value={colour.value}>
                  {colour.label}
                </option>
              ))}
            </Select>
            <p className="mt-2 flex items-center gap-2 text-xs text-ink-500">
              <span
                className={cx('h-3 w-3 rounded-full', COLOURS.find((c) => c.value === form.colour)?.dot || 'bg-brand-600')}
                aria-hidden="true"
              />
              This colour marks the subject throughout the application. Colour is never the only signal.
            </p>
          </div>
        </div>

        <Checkbox
          label="Published"
          description="Unpublishing hides the subject, and everything under it, from candidates and from this list."
          checked={form.isPublished}
          onChange={(e) => patch({ isPublished: e.target.checked })}
        />
      </form>
    </Modal>
  );
}

function TopicEditor({ topicId, onClose, onSaved }) {
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(() => contentApi.topic(topicId), [topicId]);
  const topic = data?.topic;

  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!topic) return;
    setForm({
      summary: topic.summary || '',
      keyPoints: topic.keyPoints?.length ? [...topic.keyPoints] : [''],
      keyTerms: topic.keyTerms?.length ? topic.keyTerms.map((t) => ({ term: t.term, definition: t.definition })) : [],
      examFocus: topic.examFocus?.length ? [...topic.examFocus] : [''],
      isPublished: topic.isPublished !== false,
    });
  }, [topic]);

  const blockCount = topic?.blocks?.length || 0;

  const patch = (changes) => setForm((current) => ({ ...current, ...changes }));

  const save = async (event) => {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setErrors({});
    try {
      await api.patch(`/admin/topics/${topicId}`, {
        summary: form.summary.trim(),
        keyPoints: form.keyPoints.map((p) => p.trim()).filter(Boolean),
        keyTerms: form.keyTerms
          .filter((t) => t.term.trim() && t.definition.trim())
          .map((t) => ({ term: t.term.trim(), definition: t.definition.trim() })),
        examFocus: form.examFocus.map((f) => f.trim()).filter(Boolean),
        isPublished: form.isPublished,
      });
      toast.success(`${topic.title} was saved.`);
      await onSaved();
    } catch (err) {
      const details = Array.isArray(err.details) ? err.details : [];
      const mapped = {};
      details.forEach((detail) => {
        if (detail.field) mapped[detail.field] = detail.message;
      });
      setErrors(mapped);
      toast.error(err.message || 'That topic could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={topic?.title || 'Topic'}
      description={topic ? [topic.subject?.name, topic.chapter?.title].filter(Boolean).join(' — ') : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={!form} icon={<Icon name="check" size={16} />}>
            Save topic
          </Button>
        </>
      }
    >
      {loading && <SkeletonText lines={8} />}

      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && form && (
        <form onSubmit={save} className="space-y-5" noValidate>
          <div className="rounded-lg border border-paper-300 bg-paper-50 p-3.5">
            <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-600">
              <Icon name="info" size={14} className="mt-px shrink-0" />
              This topic holds {plural(blockCount, 'passage')} of syllabus text ({(topic.wordCount || 0).toLocaleString('en-GB')} words).
              That text is reproduced from the official manual and is not edited here — only the study apparatus below
              is.
            </p>
            {topic.citation && <p className="mt-2 text-xs italic text-ink-500">{topic.citation}</p>}
          </div>

          <Textarea
            label="Summary"
            rows={4}
            value={form.summary}
            error={errors.summary}
            onChange={(e) => patch({ summary: e.target.value })}
            hint="A short orientation, written from the passage above. Shown at the head of the topic."
          />

          <StringList
            legend="Key points"
            hint="The points a candidate should carry away."
            values={form.keyPoints}
            placeholder="A point from this topic"
            addLabel="Add a key point"
            onChange={(keyPoints) => patch({ keyPoints })}
          />

          <fieldset>
            <legend className="mb-1 text-sm font-medium text-ink-700">Key terms</legend>
            <p className="mb-2.5 text-xs leading-relaxed text-ink-500">
              Terms a candidate is expected to be able to define.
            </p>
            <ul className="space-y-2">
              {form.keyTerms.map((entry, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Input
                    label={`Term ${index + 1}`}
                    value={entry.term}
                    placeholder="Term"
                    className="w-40 shrink-0 [&>label]:sr-only"
                    onChange={(e) =>
                      patch({ keyTerms: form.keyTerms.map((t, i) => (i === index ? { ...t, term: e.target.value } : t)) })
                    }
                  />
                  <Input
                    label={`Definition ${index + 1}`}
                    value={entry.definition}
                    placeholder="Definition"
                    className="flex-1 [&>label]:sr-only"
                    onChange={(e) =>
                      patch({
                        keyTerms: form.keyTerms.map((t, i) => (i === index ? { ...t, definition: e.target.value } : t)),
                      })
                    }
                  />
                  <button
                    type="button"
                    onClick={() => patch({ keyTerms: form.keyTerms.filter((_, i) => i !== index) })}
                    aria-label={`Remove term ${index + 1}`}
                    className="mt-1 rounded-lg p-2 text-ink-500 hover:bg-danger-50 hover:text-danger-600"
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </li>
              ))}
            </ul>
            <Button
              className="mt-2.5"
              variant="secondary"
              size="sm"
              icon={<Icon name="plus" size={14} />}
              onClick={() => patch({ keyTerms: [...form.keyTerms, { term: '', definition: '' }] })}
            >
              Add a term
            </Button>
          </fieldset>

          <StringList
            legend="Examination focus"
            hint="What examiners have asked about this topic, and how."
            values={form.examFocus}
            placeholder="Often examined as a short definition"
            addLabel="Add a focus note"
            onChange={(examFocus) => patch({ examFocus })}
          />

          <Checkbox
            label="Published"
            description="Unpublishing hides the topic from candidates and removes it from this tree."
            checked={form.isPublished}
            onChange={(e) => patch({ isPublished: e.target.checked })}
          />
        </form>
      )}
    </Modal>
  );
}

function StringList({ legend, hint, values, placeholder, addLabel, onChange }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium text-ink-700">{legend}</legend>
      {hint && <p className="mb-2.5 text-xs leading-relaxed text-ink-500">{hint}</p>}
      <ul className="space-y-2">
        {values.map((value, index) => (
          <li key={index} className="flex items-start gap-2">
            <Input
              label={`${legend}, item ${index + 1}`}
              value={value}
              placeholder={placeholder}
              className="flex-1 [&>label]:sr-only"
              onChange={(e) => onChange(values.map((v, i) => (i === index ? e.target.value : v)))}
            />
            <button
              type="button"
              onClick={() => onChange(values.length === 1 ? [''] : values.filter((_, i) => i !== index))}
              aria-label={`Remove item ${index + 1}`}
              className="mt-1 rounded-lg p-2 text-ink-500 hover:bg-danger-50 hover:text-danger-600"
            >
              <Icon name="trash" size={15} />
            </button>
          </li>
        ))}
      </ul>
      <Button className="mt-2.5" variant="secondary" size="sm" onClick={() => onChange([...values, ''])} icon={<Icon name="plus" size={14} />}>
        {addLabel}
      </Button>
    </fieldset>
  );
}
