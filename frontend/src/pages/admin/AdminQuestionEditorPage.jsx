import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { adminApi, contentApi } from '@/services/api';
import { useAsync, useDocumentTitle, useUnsavedChangesWarning } from '@/hooks';
import { useToast } from '@/context/ToastContext';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  ErrorState,
  Icon,
  Input,
  Select,
  Skeleton,
  SkeletonText,
  SourceBadge,
  Tabs,
  Textarea,
  cx,
} from '@/components/ui';
import QuestionRenderer from '@/components/quiz/QuestionRenderer';
import AnswerFeedback from '@/components/quiz/AnswerFeedback';
import { ANSWER_CONFIDENCE, CONTENT_STATUS, DIFFICULTIES, QUESTION_TYPES, SOURCE_KIND } from '@shared/constants';
import { DIFFICULTY_LABELS, QUESTION_TYPE_LABELS } from '@/utils/format';

const STATUS_LABELS = {
  [CONTENT_STATUS.DRAFT]: 'Draft — not offered to candidates',
  [CONTENT_STATUS.NEEDS_REVIEW]: 'Needs review — held back until checked',
  [CONTENT_STATUS.PUBLISHED]: 'Published — live for candidates',
  [CONTENT_STATUS.ARCHIVED]: 'Archived — withdrawn, history kept',
};

const SOURCE_LABELS = {
  [SOURCE_KIND.PAST_PAPER]: 'Official past paper',
  [SOURCE_KIND.MANUAL_DERIVED]: 'Written from the official syllabus',
  [SOURCE_KIND.DEMO]: 'Demo content',
};

const CONFIDENCE_LABELS = {
  [ANSWER_CONFIDENCE.VERIFIED]: 'Verified — traced to a syllabus passage',
  [ANSWER_CONFIDENCE.PROVISIONAL]: 'Provisional — supported, not conclusively located',
  [ANSWER_CONFIDENCE.UNVERIFIED]: 'Unverified — no supporting passage found',
};

const OPTION_TYPES = [QUESTION_TYPES.MULTIPLE_CHOICE, QUESTION_TYPES.TRUE_FALSE, QUESTION_TYPES.MULTIPLE_RESPONSE];

const LETTERS = 'ABCDEFGHIJKL'.split('');

function blankForm() {
  return {
    questionId: '',
    exam: '',
    subject: '',
    chapter: '',
    topic: '',
    type: QUESTION_TYPES.MULTIPLE_CHOICE,
    prompt: '',
    context: '',
    options: [
      { key: 'A', text: '', isCorrect: false, rationale: '' },
      { key: 'B', text: '', isCorrect: false, rationale: '' },
      { key: 'C', text: '', isCorrect: false, rationale: '' },
      { key: 'D', text: '', isCorrect: false, rationale: '' },
    ],
    acceptedAnswers: [''],
    matchPairs: [
      { left: '', right: '' },
      { left: '', right: '' },
    ],
    idealAnswer: '',
    keyPoints: [''],
    markingRubric: [],
    marks: 1,
    suggestedMinutes: '',
    explanation: '',
    manualReference: {
      subjectName: '',
      chapterTitle: '',
      topicTitle: '',
      anchor: '',
      pageNumber: '',
      excerpt: '',
      citation: '',
    },
    scriptureReferences: [],
    difficulty: DIFFICULTIES.MEDIUM,
    tags: [],
    sourceKind: SOURCE_KIND.MANUAL_DERIVED,
    source: { label: '', paperCode: '', year: '', sitting: '', sectionLabel: '', questionNumber: '' },
    answerConfidence: ANSWER_CONFIDENCE.UNVERIFIED,
    reviewNotes: '',
    status: CONTENT_STATUS.DRAFT,
  };
}

/** Turns the stored document back into the flat, string-friendly form shape. */
function toForm(question) {
  const base = blankForm();
  const idOf = (value) => (value && typeof value === 'object' ? String(value._id) : value ? String(value) : '');

  return {
    ...base,
    questionId: question.questionId || '',
    exam: idOf(question.exam),
    subject: idOf(question.subject),
    chapter: idOf(question.chapter),
    topic: idOf(question.topic),
    type: question.type || base.type,
    prompt: question.prompt || '',
    context: question.context || '',
    options: question.options?.length
      ? question.options.map((o) => ({
          key: o.key || '',
          text: o.text || '',
          isCorrect: Boolean(o.isCorrect) || (question.correctOptionKeys || []).includes(o.key),
          rationale: o.rationale || '',
        }))
      : base.options,
    acceptedAnswers: question.acceptedAnswers?.length ? [...question.acceptedAnswers] : [''],
    matchPairs: question.matchPairs?.length
      ? question.matchPairs.map((p) => ({ left: p.left || '', right: p.right || '' }))
      : base.matchPairs,
    idealAnswer: question.idealAnswer || '',
    keyPoints: question.keyPoints?.length ? [...question.keyPoints] : [''],
    markingRubric: (question.markingRubric || []).map((c) => ({
      id: c.id || '',
      label: c.label || '',
      description: c.description || '',
      marks: c.marks ?? 1,
      keywordsText: (c.keywords || []).join(', '),
      synonymsText: (c.synonyms || []).map((group) => group.join(', ')).join('\n'),
      required: Boolean(c.required),
    })),
    marks: question.marks ?? 1,
    suggestedMinutes: question.suggestedMinutes ?? '',
    explanation: question.explanation || '',
    manualReference: {
      subjectName: question.manualReference?.subjectName || '',
      chapterTitle: question.manualReference?.chapterTitle || '',
      topicTitle: question.manualReference?.topicTitle || '',
      anchor: question.manualReference?.anchor ?? '',
      pageNumber: question.manualReference?.pageNumber ?? '',
      excerpt: question.manualReference?.excerpt || '',
      citation: question.manualReference?.citation || '',
    },
    scriptureReferences: (question.scriptureReferences || []).map((s) => ({
      book: s.book || '',
      chapter: s.chapter ?? '',
      verses: s.verses || '',
    })),
    difficulty: question.difficulty || DIFFICULTIES.MEDIUM,
    tags: question.tags || [],
    sourceKind: question.sourceKind || SOURCE_KIND.MANUAL_DERIVED,
    source: {
      label: question.source?.label || '',
      paperCode: question.source?.paperCode || '',
      year: question.source?.year ?? '',
      sitting: question.source?.sitting || '',
      sectionLabel: question.source?.sectionLabel || '',
      questionNumber: question.source?.questionNumber || '',
    },
    answerConfidence: question.answerConfidence || ANSWER_CONFIDENCE.UNVERIFIED,
    reviewNotes: question.reviewNotes || '',
    status: question.status || CONTENT_STATUS.DRAFT,
  };
}

const numberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** Accepts "Amos 5:24", "1 Kings 18", "Psalm 23:1-6". */
export function parseScriptureReference(text) {
  const match = String(text || '')
    .trim()
    .match(/^((?:[1-3]\s*)?[A-Za-z][A-Za-z\s.]*?)\s+(\d{1,3})(?::([\d\-,\s]+))?$/);
  if (!match) return null;
  return {
    book: match[1].trim().replace(/\.$/, ''),
    chapter: Number(match[2]),
    verses: match[3] ? match[3].replace(/\s/g, '') : '',
  };
}

function referenceLine(entry) {
  if (!entry?.book || !entry?.chapter) return '';
  return `${entry.book} ${entry.chapter}${entry.verses ? `:${entry.verses}` : ''}`;
}

function rubricTotal(rubric) {
  return (rubric || []).reduce((sum, criterion) => sum + (Number(criterion.marks) || 0), 0);
}

export default function AdminQuestionEditorPage() {
  const { questionId } = useParams();
  const isNew = !questionId || questionId === 'new';
  const navigate = useNavigate();
  const toast = useToast();

  useDocumentTitle(isNew ? 'New question' : 'Edit question');

  const [form, setForm] = useState(blankForm);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState({});
  const [otherErrors, setOtherErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [previewTab, setPreviewTab] = useState('question');
  const [previewAnswer, setPreviewAnswer] = useState({ selectedOptionKeys: [], textAnswer: '', matchAnswer: {}, viaVoice: false });
  const errorSummaryRef = useRef(null);

  useUnsavedChangesWarning(dirty && !saving);

  const patch = useCallback((changes) => {
    setForm((current) => ({ ...current, ...(typeof changes === 'function' ? changes(current) : changes) }));
    setDirty(true);
  }, []);

  /* ------------------------------------------------------------- loading --- */

  const exams = useAsync(() => adminApi.exams(), []);

  const existing = useAsync(async () => {
    if (isNew) return null;
    return adminApi.question(questionId);
  }, [questionId, isNew]);

  useEffect(() => {
    if (existing.data?.question) {
      setForm(toForm(existing.data.question));
      setDirty(false);
    }
  }, [existing.data]);

  // A new question defaults to the first examination stage, so the dependent
  // selects have something to work with straight away.
  useEffect(() => {
    if (!isNew) return;
    const first = exams.data?.exams?.[0];
    if (first) {
      setForm((current) => (current.exam ? current : { ...current, exam: String(first._id) }));
    }
  }, [exams.data, isNew]);

  const subjects = useAsync(async () => {
    if (!form.exam) return { subjects: [] };
    return contentApi.subjects({ exam: form.exam });
  }, [form.exam]);

  const subjectTree = useAsync(async () => {
    if (!form.subject) return null;
    return contentApi.subject(form.subject);
  }, [form.subject]);

  const chapters = subjectTree.data?.chapters || [];
  const topics = useMemo(() => {
    if (form.chapter) return chapters.find((c) => String(c._id) === form.chapter)?.topics || [];
    return chapters.flatMap((c) => c.topics || []);
  }, [chapters, form.chapter]);

  const chosenSubject = (subjects.data?.subjects || []).find((s) => String(s._id) === form.subject);
  const chosenChapter = chapters.find((c) => String(c._id) === form.chapter);
  const chosenTopic = topics.find((t) => String(t._id) === form.topic);

  /** Fills the manual reference from the chosen topic, leaving typed values alone. */
  const fillReferenceFromTopic = useCallback(
    async ({ force = false } = {}) => {
      if (!form.topic) return;
      let detail = null;
      try {
        detail = (await contentApi.topic(form.topic))?.topic || null;
      } catch {
        /* The placement is still valid without the citation. */
      }
      setForm((current) => {
        const reference = { ...current.manualReference };
        const set = (key, value) => {
          if (value == null || value === '') return;
          const empty = reference[key] === '' || reference[key] === null || reference[key] === undefined;
          if (force || empty) reference[key] = value;
        };
        set('subjectName', detail?.subject?.name || chosenSubject?.name || '');
        set('chapterTitle', detail?.chapter?.title || chosenChapter?.title || '');
        set('topicTitle', detail?.title || chosenTopic?.title || '');
        set('anchor', detail?.sourceAnchor ?? '');
        set('pageNumber', detail?.pageNumber ?? '');
        set('citation', detail?.citation || '');
        return { ...current, manualReference: reference };
      });
      setDirty(true);
    },
    [form.topic, chosenSubject, chosenChapter, chosenTopic],
  );

  // Choosing a topic prefills the citation block, because a question that
  // cannot say where its answer comes from should not be written at all.
  const lastPrefilled = useRef(null);
  useEffect(() => {
    if (!form.topic || lastPrefilled.current === form.topic) return;
    lastPrefilled.current = form.topic;
    fillReferenceFromTopic();
  }, [form.topic, fillReferenceFromTopic]);

  /* ----------------------------------------------------------- type rules --- */

  const changeType = (type) => {
    patch((current) => {
      const next = { ...current, type };
      if (type === QUESTION_TYPES.TRUE_FALSE) {
        next.options = [
          { key: 'A', text: 'True', isCorrect: current.options?.[0]?.isCorrect || false, rationale: current.options?.[0]?.rationale || '' },
          { key: 'B', text: 'False', isCorrect: current.options?.[1]?.isCorrect || false, rationale: current.options?.[1]?.rationale || '' },
        ];
      }
      if (type === QUESTION_TYPES.THEORY && !current.markingRubric.length && Number(current.marks) <= 1) {
        next.marks = 25;
      }
      return next;
    });
  };

  const correctCount = form.options.filter((o) => o.isCorrect).length;
  const rubricSum = rubricTotal(form.markingRubric);
  const rubricMismatch = form.type === QUESTION_TYPES.THEORY && form.markingRubric.length > 0 && rubricSum !== Number(form.marks);

  /* ---------------------------------------------------------- validation --- */

  const validate = () => {
    const found = {};

    if (!form.exam) found.exam = 'Choose the examination stage this question belongs to.';
    if (!form.subject) found.subject = 'Choose a subject.';
    if (!form.prompt.trim() || form.prompt.trim().length < 3) found.prompt = 'Write the question text.';
    if (!form.sourceKind) found.sourceKind = 'Say where this question came from.';

    if (OPTION_TYPES.includes(form.type)) {
      const filled = form.options.filter((o) => o.text.trim());
      if (filled.length < 2) found.options = 'An objective question needs at least two options.';
      form.options.forEach((option, index) => {
        if (!option.key.trim()) found[`options.${index}.key`] = 'Every option needs a key.';
        if (!option.text.trim()) found[`options.${index}.text`] = 'Write the option text, or remove the option.';
      });
      const keys = form.options.map((o) => o.key.trim().toUpperCase());
      if (new Set(keys).size !== keys.length) found.options = 'Two options share the same key.';

      if (form.type === QUESTION_TYPES.MULTIPLE_RESPONSE) {
        if (correctCount < 1) found.correct = 'Mark at least one option as correct.';
      } else if (correctCount !== 1) {
        found.correct =
          correctCount === 0
            ? 'Mark exactly one option as correct.'
            : `Only one option can be correct for a ${QUESTION_TYPE_LABELS[form.type].toLowerCase()} question — ${correctCount} are marked.`;
      }
    }

    if (form.type === QUESTION_TYPES.FILL_BLANK && !form.acceptedAnswers.some((a) => a.trim())) {
      found.acceptedAnswers = 'Give at least one accepted answer.';
    }

    if (form.type === QUESTION_TYPES.MATCHING && !form.matchPairs.some((p) => p.left.trim() && p.right.trim())) {
      found.matchPairs = 'Give at least one complete pair.';
    }

    if (form.type === QUESTION_TYPES.THEORY) {
      const hasMarking = form.idealAnswer.trim() || form.keyPoints.some((p) => p.trim()) || form.markingRubric.length;
      if (!hasMarking) {
        found.idealAnswer = 'A theory question needs an ideal answer, key points or a marking rubric so it can be marked.';
      }
      form.markingRubric.forEach((criterion, index) => {
        if (!criterion.id.trim()) found[`markingRubric.${index}.id`] = 'Give the criterion an identifier.';
        if (!criterion.label.trim()) found[`markingRubric.${index}.label`] = 'Give the criterion a label.';
      });
    }

    form.scriptureReferences.forEach((entry, index) => {
      if (!entry.book.trim()) found[`scriptureReferences.${index}.book`] = 'Name the book.';
      if (!entry.chapter) found[`scriptureReferences.${index}.chapter`] = 'Give the chapter.';
    });

    // The product principle, enforced: a published question must be able to
    // teach a candidate why they were wrong.
    if (form.status === CONTENT_STATUS.PUBLISHED) {
      if (!form.explanation.trim() && !form.manualReference.excerpt.trim()) {
        found.explanation =
          'A published question needs an explanation or a syllabus excerpt, so that getting it wrong teaches something.';
      }
      if (form.answerConfidence === ANSWER_CONFIDENCE.UNVERIFIED) {
        found.answerConfidence =
          'An unverified answer must not be published. Trace it to the syllabus, or leave the question as needs review.';
      }
    }

    return found;
  };

  /* --------------------------------------------------------------- saving --- */

  const buildPayload = () => {
    const usesOptions = OPTION_TYPES.includes(form.type);
    const options = usesOptions
      ? form.options
          .filter((o) => o.text.trim())
          .map((o) => ({
            key: o.key.trim().toUpperCase(),
            text: o.text.trim(),
            isCorrect: Boolean(o.isCorrect),
            rationale: o.rationale.trim(),
          }))
      : [];

    return {
      questionId: form.questionId.trim() || undefined,
      exam: form.exam,
      subject: form.subject,
      chapter: form.chapter || null,
      topic: form.topic || null,
      type: form.type,
      prompt: form.prompt.trim(),
      context: form.context.trim(),
      options,
      correctOptionKeys: options.filter((o) => o.isCorrect).map((o) => o.key),
      acceptedAnswers:
        form.type === QUESTION_TYPES.FILL_BLANK ? form.acceptedAnswers.map((a) => a.trim()).filter(Boolean) : [],
      matchPairs:
        form.type === QUESTION_TYPES.MATCHING
          ? form.matchPairs.filter((p) => p.left.trim() && p.right.trim()).map((p) => ({ left: p.left.trim(), right: p.right.trim() }))
          : [],
      idealAnswer: form.type === QUESTION_TYPES.THEORY ? form.idealAnswer.trim() : '',
      keyPoints: form.type === QUESTION_TYPES.THEORY ? form.keyPoints.map((p) => p.trim()).filter(Boolean) : [],
      markingRubric:
        form.type === QUESTION_TYPES.THEORY
          ? form.markingRubric.map((criterion, index) => ({
              id: criterion.id.trim() || `c${index + 1}`,
              label: criterion.label.trim(),
              description: criterion.description.trim(),
              marks: Number(criterion.marks) || 0,
              keywords: criterion.keywordsText
                .split(',')
                .map((k) => k.trim())
                .filter(Boolean),
              synonyms: criterion.synonymsText
                .split('\n')
                .map((line) => line.split(',').map((s) => s.trim()).filter(Boolean))
                .filter((group) => group.length > 0),
              required: Boolean(criterion.required),
            }))
          : [],
      marks: Number(form.marks) || 1,
      suggestedMinutes: numberOrNull(form.suggestedMinutes),
      explanation: form.explanation.trim(),
      manualReference: {
        subjectName: form.manualReference.subjectName.trim(),
        chapterTitle: form.manualReference.chapterTitle.trim(),
        topicTitle: form.manualReference.topicTitle.trim(),
        anchor: numberOrNull(form.manualReference.anchor),
        pageNumber: numberOrNull(form.manualReference.pageNumber),
        excerpt: form.manualReference.excerpt.trim(),
        citation: form.manualReference.citation.trim(),
      },
      scriptureReferences: form.scriptureReferences
        .filter((entry) => entry.book.trim() && entry.chapter)
        .map((entry) => ({
          book: entry.book.trim(),
          chapter: Number(entry.chapter),
          verses: entry.verses.trim() || null,
          reference: referenceLine({ book: entry.book.trim(), chapter: entry.chapter, verses: entry.verses.trim() }),
          note: '',
        })),
      difficulty: form.difficulty,
      tags: form.tags,
      sourceKind: form.sourceKind,
      source: {
        label: form.source.label.trim(),
        paperCode: form.source.paperCode.trim(),
        year: numberOrNull(form.source.year),
        sitting: form.source.sitting.trim(),
        sectionLabel: form.source.sectionLabel.trim(),
        questionNumber: form.source.questionNumber.trim(),
      },
      answerConfidence: form.answerConfidence,
      reviewNotes: form.reviewNotes.trim(),
      status: form.status,
    };
  };

  const save = async (event) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    setOtherErrors([]);

    if (Object.keys(found).length) {
      toast.error('Some details need attention before this can be saved.');
      // The summary is rendered by this same update, so focus after the commit.
      setTimeout(() => errorSummaryRef.current?.focus(), 0);
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      if (isNew) {
        const result = await adminApi.createQuestion(payload);
        setDirty(false);
        toast.success(`${result.question.questionId} was created.`);
        navigate(`/admin/questions/${result.question._id}`, { replace: true });
      } else {
        // The examination stage is fixed once a question exists.
        const rest = { ...payload };
        delete rest.exam;
        const result = await adminApi.updateQuestion(questionId, rest);
        setForm(toForm(result.question));
        setDirty(false);
        toast.success('Your changes were saved.');
      }
    } catch (err) {
      // The API answers with a list of {field, message}; put each one where it belongs.
      const details = Array.isArray(err.details) ? err.details : [];
      const mapped = {};
      const leftover = [];
      details.forEach((detail) => {
        if (detail.field) mapped[detail.field] = detail.message;
        else leftover.push(detail.message);
      });
      setErrors(mapped);
      setOtherErrors(leftover.length ? leftover : details.length ? [] : [err.message]);
      toast.error(err.message || 'That could not be saved.');
      setTimeout(() => errorSummaryRef.current?.focus(), 0);
    } finally {
      setSaving(false);
    }
  };

  /* -------------------------------------------------------------- preview --- */

  const previewQuestion = useMemo(() => {
    const marks = form.type === QUESTION_TYPES.THEORY && form.markingRubric.length ? rubricSum : Number(form.marks) || 1;
    return {
      id: 'preview',
      questionId: form.questionId || 'Not yet numbered',
      type: form.type,
      prompt: form.prompt || 'Your question will appear here.',
      context: form.context,
      options: form.options.filter((o) => o.text.trim()).map((o) => ({ key: o.key, text: o.text })),
      matchPairs: form.matchPairs.filter((p) => p.left.trim()).map((p) => ({ left: p.left })),
      matchOptions: form.matchPairs.filter((p) => p.right.trim()).map((p) => p.right),
      marks,
      suggestedMinutes: numberOrNull(form.suggestedMinutes),
      difficulty: form.difficulty,
      tags: form.tags,
      sourceKind: form.sourceKind,
      source: form.source,
      subject: chosenSubject ? { name: chosenSubject.name, shortName: chosenSubject.shortName } : null,
      topic: chosenTopic ? { title: chosenTopic.title } : null,
    };
  }, [form, rubricSum, chosenSubject, chosenTopic]);

  const previewReview = useMemo(
    () => ({
      ...previewQuestion,
      options: form.options
        .filter((o) => o.text.trim())
        .map((o) => ({ key: o.key, text: o.text, isCorrect: o.isCorrect, rationale: o.rationale })),
      correctOptionKeys: form.options.filter((o) => o.isCorrect && o.text.trim()).map((o) => o.key),
      acceptedAnswers: form.acceptedAnswers.filter((a) => a.trim()),
      matchPairs: form.matchPairs.filter((p) => p.left.trim() && p.right.trim()),
      idealAnswer: form.idealAnswer,
      keyPoints: form.keyPoints.filter((p) => p.trim()),
      explanation: form.explanation,
      manualReference: form.manualReference,
      scriptureReferences: form.scriptureReferences
        .filter((s) => s.book.trim() && s.chapter)
        .map((s) => ({ ...s, reference: referenceLine(s) })),
      answerConfidence: form.answerConfidence,
    }),
    [previewQuestion, form],
  );

  const previewTheoryEvaluation = useMemo(() => {
    if (form.type !== QUESTION_TYPES.THEORY) return null;
    const criteria = form.markingRubric.map((criterion, index) => ({
      id: criterion.id || `c${index + 1}`,
      label: criterion.label || `Point ${index + 1}`,
      marksAvailable: Number(criterion.marks) || 0,
      marksAwarded: 0,
      verdict: 'missing',
      evidence: '',
      guidance: criterion.description,
    }));
    const available = criteria.length ? rubricSum : Number(form.marks) || 0;
    return {
      marksAwarded: 0,
      marksAvailable: available,
      percentage: 0,
      criteria,
      covered: [],
      partial: [],
      missing: criteria.map((c) => c.label),
      feedback: 'This is an illustration: it shows the panel as it would look for an answer that covered none of the rubric.',
      engine: 'rubric',
      confidence: 'illustrative',
      wordCount: 0,
    };
  }, [form.type, form.markingRubric, form.marks, rubricSum]);

  /* ----------------------------------------------------------------- view --- */

  if (!isNew && existing.loading) return <EditorSkeleton />;
  if (!isNew && existing.error) {
    return (
      <Card>
        <ErrorState error={existing.error} onRetry={existing.reload} />
      </Card>
    );
  }

  const errorCount = Object.keys(errors).length + otherErrors.length;

  return (
    <form onSubmit={save} className="space-y-5" noValidate>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link to="/admin/questions" className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline">
            <Icon name="chevronLeft" size={14} strokeStyle />
            Back to the question bank
          </Link>
          <h1 className="mt-1.5 font-serif text-2xl font-semibold text-ink-900">
            {isNew ? 'New question' : `Edit ${form.questionId || 'question'}`}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-500">
            Every part of this form has one purpose: that a candidate who answers wrongly is shown the right answer, the
            reason for it, and where in the syllabus it is found.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {dirty && (
            <span className="flex items-center gap-1.5 text-xs text-warning-600">
              <Icon name="info" size={13} />
              Unsaved changes
            </span>
          )}
          <Button variant="secondary" to="/admin/questions">
            Cancel
          </Button>
          <Button type="submit" loading={saving} icon={<Icon name="check" size={16} />}>
            {isNew ? 'Create question' : 'Save changes'}
          </Button>
        </div>
      </header>

      {errorCount > 0 && (
        <div
          ref={errorSummaryRef}
          tabIndex={-1}
          role="alert"
          className="rounded-xl border border-danger-500 bg-danger-50 p-4 focus:outline-none focus:ring-2 focus:ring-danger-500/40"
        >
          <p className="flex items-center gap-2 font-serif text-sm font-semibold text-danger-600">
            <Icon name="alert" size={16} />
            {errorCount === 1 ? 'One thing needs attention' : `${errorCount} things need attention`}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-700">
            {Object.entries(errors).map(([field, message]) => (
              <li key={field}>{message}</li>
            ))}
            {otherErrors.map((message, i) => (
              <li key={`other-${i}`}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
        {/* ------------------------------------------------------------ form */}
        <div className="min-w-0 space-y-5">
          {/* Placement */}
          <Card as="section">
            <CardHeader
              title="Placement"
              subtitle="Where this question sits in the syllabus."
              icon={<Icon name="stack" size={18} />}
            />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Select
                label="Examination stage"
                required
                value={form.exam}
                error={errors.exam}
                disabled={!isNew || exams.loading}
                hint={!isNew ? 'The examination stage cannot be changed once a question exists.' : undefined}
                onChange={(e) => patch({ exam: e.target.value, subject: '', chapter: '', topic: '' })}
              >
                <option value="">Choose a stage…</option>
                {(exams.data?.exams || []).map((exam) => (
                  <option key={exam._id} value={exam._id}>
                    {exam.name}
                  </option>
                ))}
              </Select>

              <Select
                label="Subject"
                required
                value={form.subject}
                error={errors.subject}
                disabled={!form.exam || subjects.loading}
                onChange={(e) => patch({ subject: e.target.value, chapter: '', topic: '' })}
              >
                <option value="">{subjects.loading ? 'Loading subjects…' : 'Choose a subject…'}</option>
                {(subjects.data?.subjects || []).map((subject) => (
                  <option key={subject._id} value={subject._id}>
                    {subject.name}
                  </option>
                ))}
              </Select>

              <Select
                label="Chapter"
                value={form.chapter}
                error={errors.chapter}
                disabled={!form.subject || subjectTree.loading}
                hint="Optional, but it makes the question easier to find."
                onChange={(e) => patch({ chapter: e.target.value, topic: '' })}
              >
                <option value="">{subjectTree.loading ? 'Loading chapters…' : 'No chapter'}</option>
                {chapters.map((chapter) => (
                  <option key={chapter._id} value={chapter._id}>
                    {chapter.number ? `${chapter.number}. ` : ''}
                    {chapter.title}
                  </option>
                ))}
              </Select>

              <Select
                label="Topic"
                value={form.topic}
                error={errors.topic}
                disabled={!form.subject || subjectTree.loading}
                hint="Choosing a topic fills in the syllabus reference below."
                onChange={(e) => patch({ topic: e.target.value })}
              >
                <option value="">No topic</option>
                {topics.map((topic) => (
                  <option key={topic._id} value={topic._id}>
                    {topic.number ? `${topic.number}. ` : ''}
                    {topic.title}
                  </option>
                ))}
              </Select>

              <Input
                label="Question identifier"
                value={form.questionId}
                error={errors.questionId}
                onChange={(e) => patch({ questionId: e.target.value })}
                hint={isNew ? 'Leave blank and one will be generated, for example DOC-O-0042.' : 'Used by imports and exports.'}
                className="sm:col-span-2"
              />
            </div>
          </Card>

          {/* The question */}
          <Card as="section">
            <CardHeader title="The question" icon={<Icon name="quiz" size={18} />} />
            <div className="space-y-4 p-5">
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-ink-700">Question type</legend>
                <div className="flex flex-wrap gap-2">
                  {Object.values(QUESTION_TYPES).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => changeType(type)}
                      aria-pressed={form.type === type}
                      className={cx(
                        'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                        form.type === type
                          ? 'border-brand-600 bg-brand-50 text-brand-800'
                          : 'border-paper-300 bg-white text-ink-600 hover:border-brand-300 hover:bg-paper-50',
                      )}
                    >
                      {QUESTION_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
              </fieldset>

              <Textarea
                label="Question text"
                required
                rows={3}
                value={form.prompt}
                error={errors.prompt}
                onChange={(e) => patch({ prompt: e.target.value })}
                placeholder="What is asked of the candidate?"
              />

              <Textarea
                label="Context (optional)"
                rows={3}
                value={form.context}
                error={errors.context}
                onChange={(e) => patch({ context: e.target.value })}
                hint="A passage, stem or scenario printed above the question."
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Marks"
                  type="number"
                  min="0"
                  max="200"
                  value={form.marks}
                  error={errors.marks}
                  onChange={(e) => patch({ marks: e.target.value })}
                />
                <Input
                  label="Suggested minutes (optional)"
                  type="number"
                  min="0"
                  max="180"
                  value={form.suggestedMinutes}
                  error={errors.suggestedMinutes}
                  onChange={(e) => patch({ suggestedMinutes: e.target.value })}
                />
              </div>
            </div>
          </Card>

          {/* Answer */}
          <Card as="section">
            <CardHeader
              title="The answer"
              subtitle={`How a ${QUESTION_TYPE_LABELS[form.type].toLowerCase()} question is marked.`}
              icon={<Icon name="check" size={18} />}
            />
            <div className="space-y-4 p-5">
              {OPTION_TYPES.includes(form.type) && (
                <OptionEditor
                  form={form}
                  patch={patch}
                  errors={errors}
                  correctCount={correctCount}
                  locked={form.type === QUESTION_TYPES.TRUE_FALSE}
                  multiple={form.type === QUESTION_TYPES.MULTIPLE_RESPONSE}
                />
              )}

              {form.type === QUESTION_TYPES.FILL_BLANK && (
                <RepeatableStrings
                  legend="Accepted answers"
                  hint="Spelling is compared loosely, but list every wording a marker would accept."
                  values={form.acceptedAnswers}
                  error={errors.acceptedAnswers}
                  placeholder="An answer a candidate might write"
                  addLabel="Add another accepted answer"
                  onChange={(acceptedAnswers) => patch({ acceptedAnswers })}
                />
              )}

              {form.type === QUESTION_TYPES.MATCHING && <MatchPairEditor form={form} patch={patch} errors={errors} />}

              {form.type === QUESTION_TYPES.THEORY && (
                <TheoryEditor
                  form={form}
                  patch={patch}
                  errors={errors}
                  rubricSum={rubricSum}
                  rubricMismatch={rubricMismatch}
                />
              )}
            </div>
          </Card>

          {/* Teaching */}
          <Card as="section">
            <CardHeader
              title="Teaching"
              subtitle="What a candidate is shown once they have answered."
              icon={<Icon name="book" size={18} />}
            />
            <div className="space-y-4 p-5">
              <Textarea
                label="Explanation"
                rows={4}
                value={form.explanation}
                error={errors.explanation}
                onChange={(e) => patch({ explanation: e.target.value })}
                hint="Why the correct answer is correct. Written plainly, addressed to the candidate."
              />

              <fieldset className="rounded-xl border border-paper-300 p-4">
                <legend className="flex items-center gap-2 px-1.5 text-sm font-medium text-ink-700">
                  Syllabus reference
                  {form.topic && (
                    <button
                      type="button"
                      onClick={() => fillReferenceFromTopic({ force: true })}
                      className="text-xs font-normal text-brand-700 hover:underline"
                    >
                      Refill from the chosen topic
                    </button>
                  )}
                </legend>
                <p className="mb-3 px-1.5 text-xs leading-relaxed text-ink-500">
                  Where in the official manual this answer is grounded. The excerpt is shown to the candidate as a
                  quotation, so keep it verbatim.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Subject name"
                    value={form.manualReference.subjectName}
                    error={errors['manualReference.subjectName']}
                    onChange={(e) => patch({ manualReference: { ...form.manualReference, subjectName: e.target.value } })}
                  />
                  <Input
                    label="Chapter title"
                    value={form.manualReference.chapterTitle}
                    error={errors['manualReference.chapterTitle']}
                    onChange={(e) => patch({ manualReference: { ...form.manualReference, chapterTitle: e.target.value } })}
                  />
                  <Input
                    label="Topic title"
                    value={form.manualReference.topicTitle}
                    error={errors['manualReference.topicTitle']}
                    onChange={(e) => patch({ manualReference: { ...form.manualReference, topicTitle: e.target.value } })}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Anchor"
                      type="number"
                      value={form.manualReference.anchor}
                      error={errors['manualReference.anchor']}
                      hint="Paragraph number"
                      onChange={(e) => patch({ manualReference: { ...form.manualReference, anchor: e.target.value } })}
                    />
                    <Input
                      label="Page"
                      type="number"
                      value={form.manualReference.pageNumber}
                      error={errors['manualReference.pageNumber']}
                      onChange={(e) => patch({ manualReference: { ...form.manualReference, pageNumber: e.target.value } })}
                    />
                  </div>
                  <Textarea
                    label="Excerpt from the manual"
                    rows={3}
                    className="sm:col-span-2"
                    value={form.manualReference.excerpt}
                    error={errors['manualReference.excerpt']}
                    onChange={(e) => patch({ manualReference: { ...form.manualReference, excerpt: e.target.value } })}
                    hint="A short verbatim passage that supports the answer."
                  />
                  <Input
                    label="Citation"
                    className="sm:col-span-2"
                    value={form.manualReference.citation}
                    error={errors['manualReference.citation']}
                    onChange={(e) => patch({ manualReference: { ...form.manualReference, citation: e.target.value } })}
                    hint="How the source is named beneath the quotation."
                  />
                </div>
              </fieldset>

              <ScriptureEditor form={form} patch={patch} errors={errors} />
            </div>
          </Card>

          {/* Classification */}
          <Card as="section">
            <CardHeader
              title="Classification and provenance"
              subtitle="Candidates are always told whether a question is official examination material."
              icon={<Icon name="filter" size={18} />}
            />
            <div className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Difficulty"
                  value={form.difficulty}
                  error={errors.difficulty}
                  onChange={(e) => patch({ difficulty: e.target.value })}
                >
                  {Object.values(DIFFICULTIES).map((value) => (
                    <option key={value} value={value}>
                      {DIFFICULTY_LABELS[value]}
                    </option>
                  ))}
                </Select>

                <Select
                  label="Source"
                  required
                  value={form.sourceKind}
                  error={errors.sourceKind}
                  onChange={(e) => patch({ sourceKind: e.target.value })}
                >
                  {Object.values(SOURCE_KIND).map((value) => (
                    <option key={value} value={value}>
                      {SOURCE_LABELS[value]}
                    </option>
                  ))}
                </Select>
              </div>

              <TagInput tags={form.tags} onChange={(tags) => patch({ tags })} error={errors.tags} />

              <fieldset className="rounded-xl border border-paper-300 p-4">
                <legend className="px-1.5 text-sm font-medium text-ink-700">Source details</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Label"
                    className="sm:col-span-2"
                    value={form.source.label}
                    error={errors['source.label']}
                    placeholder="Doctrine Part II — September 2025"
                    onChange={(e) => patch({ source: { ...form.source, label: e.target.value } })}
                  />
                  <Input
                    label="Paper code"
                    value={form.source.paperCode}
                    error={errors['source.paperCode']}
                    onChange={(e) => patch({ source: { ...form.source, paperCode: e.target.value } })}
                  />
                  <Input
                    label="Year"
                    type="number"
                    min="1900"
                    max="2100"
                    value={form.source.year}
                    error={errors['source.year']}
                    onChange={(e) => patch({ source: { ...form.source, year: e.target.value } })}
                  />
                  <Input
                    label="Sitting"
                    value={form.source.sitting}
                    error={errors['source.sitting']}
                    placeholder="September"
                    onChange={(e) => patch({ source: { ...form.source, sitting: e.target.value } })}
                  />
                  <Input
                    label="Section label"
                    value={form.source.sectionLabel}
                    error={errors['source.sectionLabel']}
                    placeholder="Section A"
                    onChange={(e) => patch({ source: { ...form.source, sectionLabel: e.target.value } })}
                  />
                  <Input
                    label="Question number"
                    value={form.source.questionNumber}
                    error={errors['source.questionNumber']}
                    onChange={(e) => patch({ source: { ...form.source, questionNumber: e.target.value } })}
                  />
                </div>
              </fieldset>

              <Select
                label="Answer confidence"
                value={form.answerConfidence}
                error={errors.answerConfidence}
                onChange={(e) => patch({ answerConfidence: e.target.value })}
                hint="An unverified answer is one nobody has traced to the syllabus. It must not be published."
              >
                {Object.values(ANSWER_CONFIDENCE).map((value) => (
                  <option key={value} value={value}>
                    {CONFIDENCE_LABELS[value]}
                  </option>
                ))}
              </Select>

              <Textarea
                label="Review notes"
                rows={2}
                value={form.reviewNotes}
                error={errors.reviewNotes}
                onChange={(e) => patch({ reviewNotes: e.target.value })}
                hint="For other administrators. Candidates never see this."
              />

              <Select
                label="Status"
                value={form.status}
                error={errors.status}
                onChange={(e) => patch({ status: e.target.value })}
              >
                {Object.values(CONTENT_STATUS).map((value) => (
                  <option key={value} value={value}>
                    {STATUS_LABELS[value]}
                  </option>
                ))}
              </Select>

              {form.status === CONTENT_STATUS.PUBLISHED && form.answerConfidence !== ANSWER_CONFIDENCE.VERIFIED && (
                <p className="flex items-start gap-2 rounded-lg bg-warning-50 p-3 text-xs leading-relaxed text-warning-600">
                  <Icon name="alert" size={14} className="mt-px" />
                  You are about to publish a question whose answer has not been verified against the syllabus. A
                  candidate will be told they are wrong on the strength of it.
                </p>
              )}
            </div>
          </Card>

          <div className="flex flex-wrap items-center justify-end gap-2 pb-2">
            <Button variant="secondary" to="/admin/questions">
              Cancel
            </Button>
            <Button type="submit" loading={saving} icon={<Icon name="check" size={16} />}>
              {isNew ? 'Create question' : 'Save changes'}
            </Button>
          </div>
        </div>

        {/* --------------------------------------------------------- preview */}
        <aside className="min-w-0">
          <div className="xl:sticky xl:top-20">
            <Card>
              <CardHeader
                title="Preview"
                subtitle="Exactly what a candidate would see."
                icon={<Icon name="eye" size={18} />}
              />
              <Tabs
                tabs={[
                  { key: 'question', label: 'The question' },
                  { key: 'feedback', label: 'After answering' },
                ]}
                active={previewTab}
                onChange={setPreviewTab}
                className="px-3"
              />

              <div className="max-h-[70vh] overflow-y-auto p-4 scrollbar-thin">
                {previewTab === 'question' ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="outline" size="sm">
                        {QUESTION_TYPE_LABELS[form.type]}
                      </Badge>
                      <Badge tone="neutral" size="sm">
                        {previewQuestion.marks} {previewQuestion.marks === 1 ? 'mark' : 'marks'}
                      </Badge>
                      <SourceBadge sourceKind={form.sourceKind} source={form.source} answerConfidence={form.answerConfidence} />
                    </div>

                    {form.context && (
                      <div className="rounded-lg border border-paper-200 bg-paper-50 p-3">
                        <p className="whitespace-pre-line font-serif text-sm leading-relaxed text-ink-700">{form.context}</p>
                      </div>
                    )}

                    <p className="font-serif text-base leading-relaxed text-ink-900">{previewQuestion.prompt}</p>

                    <QuestionRenderer
                      question={previewQuestion}
                      value={previewAnswer}
                      onChange={setPreviewAnswer}
                      revealed={false}
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="rounded-lg bg-paper-100 p-2.5 text-xs leading-relaxed text-ink-500">
                      Shown as it would appear to a candidate who answered incorrectly — the moment where the question
                      has to teach something.
                    </p>
                    <AnswerFeedback
                      result={{ isCorrect: false, score: 0, marksAwarded: 0, marksAvailable: previewQuestion.marks }}
                      review={previewReview}
                      theoryEvaluation={previewTheoryEvaluation}
                      soundEnabled={false}
                    />
                  </div>
                )}
              </div>
            </Card>
          </div>
        </aside>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------ sub-editors --- */

function OptionEditor({ form, patch, errors, correctCount, locked, multiple }) {
  const setOption = (index, changes) =>
    patch((current) => ({
      options: current.options.map((option, i) => (i === index ? { ...option, ...changes } : option)),
    }));

  const toggleCorrect = (index) =>
    patch((current) => ({
      options: current.options.map((option, i) => {
        if (multiple) return i === index ? { ...option, isCorrect: !option.isCorrect } : option;
        // Single-answer types: choosing one unmarks the rest.
        return { ...option, isCorrect: i === index };
      }),
    }));

  const move = (index, delta) =>
    patch((current) => {
      const next = [...current.options];
      const target = index + delta;
      if (target < 0 || target >= next.length) return {};
      [next[index], next[target]] = [next[target], next[index]];
      return { options: next };
    });

  const add = () =>
    patch((current) => ({
      options: [
        ...current.options,
        { key: LETTERS[current.options.length] || String(current.options.length + 1), text: '', isCorrect: false, rationale: '' },
      ],
    }));

  const remove = (index) => patch((current) => ({ options: current.options.filter((_, i) => i !== index) }));

  const relabel = () => patch((current) => ({ options: current.options.map((option, i) => ({ ...option, key: LETTERS[i] || String(i + 1) })) }));

  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium text-ink-700">Options</legend>
      <p className="mb-3 text-xs leading-relaxed text-ink-500">
        {locked
          ? 'True and False are fixed for this type. Mark which one is correct, and say why the other is not.'
          : multiple
            ? 'Mark every option that is correct. A rationale on a wrong option is what turns a mistake into a lesson.'
            : 'Mark exactly one option as correct. A rationale on each wrong option is what turns a mistake into a lesson.'}
      </p>

      {errors.options && (
        <p className="mb-2 flex items-center gap-1.5 text-xs text-danger-600" role="alert">
          <Icon name="alert" size={13} />
          {errors.options}
        </p>
      )}
      {errors.correct && (
        <p className="mb-2 flex items-center gap-1.5 text-xs text-danger-600" role="alert">
          <Icon name="alert" size={13} />
          {errors.correct}
        </p>
      )}
      {multiple && correctCount === 1 && (
        <p className="mb-2 flex items-center gap-1.5 text-xs text-warning-600">
          <Icon name="info" size={13} />
          Only one option is marked correct. A multiple response question normally has more than one.
        </p>
      )}

      <ul className="space-y-3">
        {form.options.map((option, index) => (
          <li
            key={index}
            className={cx(
              'rounded-xl border p-3',
              option.isCorrect ? 'border-success-500 bg-success-50' : 'border-paper-300 bg-white',
            )}
          >
            <div className="flex flex-wrap items-start gap-3">
              <Input
                label="Key"
                value={option.key}
                error={errors[`options.${index}.key`]}
                disabled={locked}
                onChange={(e) => setOption(index, { key: e.target.value.toUpperCase() })}
                className="w-20 shrink-0"
              />
              <Input
                label="Option text"
                value={option.text}
                error={errors[`options.${index}.text`]}
                disabled={locked}
                onChange={(e) => setOption(index, { text: e.target.value })}
                className="min-w-[12rem] flex-1"
              />
              <div className="flex shrink-0 items-center gap-1 pt-7">
                {!locked && (
                  <>
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move option ${option.key || index + 1} up`}
                      className="rounded-lg p-1.5 text-ink-500 hover:bg-paper-200 disabled:opacity-30"
                    >
                      <Icon name="chevronDown" size={15} strokeStyle className="rotate-180" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === form.options.length - 1}
                      aria-label={`Move option ${option.key || index + 1} down`}
                      className="rounded-lg p-1.5 text-ink-500 hover:bg-paper-200 disabled:opacity-30"
                    >
                      <Icon name="chevronDown" size={15} strokeStyle />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      disabled={form.options.length <= 2}
                      aria-label={`Remove option ${option.key || index + 1}`}
                      className="rounded-lg p-1.5 text-ink-500 hover:bg-danger-50 hover:text-danger-600 disabled:opacity-30"
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="mt-3 space-y-2.5">
              <Checkbox
                label={option.isCorrect ? 'This is a correct answer' : 'Mark this as a correct answer'}
                checked={option.isCorrect}
                onChange={() => toggleCorrect(index)}
              />
              <Textarea
                label={option.isCorrect ? 'Why this is right (optional)' : 'Why this is wrong (optional)'}
                rows={2}
                value={option.rationale}
                error={errors[`options.${index}.rationale`]}
                onChange={(e) => setOption(index, { rationale: e.target.value })}
              />
            </div>
          </li>
        ))}
      </ul>

      {!locked && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={add} icon={<Icon name="plus" size={14} />} disabled={form.options.length >= 12}>
            Add an option
          </Button>
          <Button variant="ghost" size="sm" onClick={relabel}>
            Relabel A, B, C…
          </Button>
        </div>
      )}
    </fieldset>
  );
}

function RepeatableStrings({ legend, hint, values, error, placeholder, addLabel, onChange, rows = 0 }) {
  const set = (index, value) => onChange(values.map((v, i) => (i === index ? value : v)));
  const add = () => onChange([...values, '']);
  const remove = (index) => onChange(values.length === 1 ? [''] : values.filter((_, i) => i !== index));

  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium text-ink-700">{legend}</legend>
      {hint && <p className="mb-2.5 text-xs leading-relaxed text-ink-500">{hint}</p>}
      {error && (
        <p className="mb-2 flex items-center gap-1.5 text-xs text-danger-600" role="alert">
          <Icon name="alert" size={13} />
          {error}
        </p>
      )}
      <ul className="space-y-2">
        {values.map((value, index) => (
          <li key={index} className="flex items-start gap-2">
            {rows > 0 ? (
              <Textarea
                label={`${legend}, item ${index + 1}`}
                rows={rows}
                value={value}
                placeholder={placeholder}
                onChange={(e) => set(index, e.target.value)}
                className="flex-1 [&>label]:sr-only"
              />
            ) : (
              <Input
                label={`${legend}, item ${index + 1}`}
                value={value}
                placeholder={placeholder}
                onChange={(e) => set(index, e.target.value)}
                className="flex-1 [&>label]:sr-only"
              />
            )}
            <button
              type="button"
              onClick={() => remove(index)}
              aria-label={`Remove item ${index + 1}`}
              className="mt-1 rounded-lg p-2 text-ink-500 hover:bg-danger-50 hover:text-danger-600"
            >
              <Icon name="trash" size={15} />
            </button>
          </li>
        ))}
      </ul>
      <Button className="mt-2.5" variant="secondary" size="sm" onClick={add} icon={<Icon name="plus" size={14} />}>
        {addLabel}
      </Button>
    </fieldset>
  );
}

function MatchPairEditor({ form, patch, errors }) {
  const set = (index, changes) =>
    patch((current) => ({ matchPairs: current.matchPairs.map((pair, i) => (i === index ? { ...pair, ...changes } : pair)) }));
  const add = () => patch((current) => ({ matchPairs: [...current.matchPairs, { left: '', right: '' }] }));
  const remove = (index) =>
    patch((current) => ({
      matchPairs: current.matchPairs.length === 1 ? [{ left: '', right: '' }] : current.matchPairs.filter((_, i) => i !== index),
    }));

  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium text-ink-700">Pairs to match</legend>
      <p className="mb-2.5 text-xs leading-relaxed text-ink-500">
        The candidate sees the left-hand items in order and chooses from a shuffled list of the right-hand ones.
      </p>
      {errors.matchPairs && (
        <p className="mb-2 flex items-center gap-1.5 text-xs text-danger-600" role="alert">
          <Icon name="alert" size={13} />
          {errors.matchPairs}
        </p>
      )}
      <ul className="space-y-2">
        {form.matchPairs.map((pair, index) => (
          <li key={index} className="flex items-start gap-2">
            <Input
              label={`Left item ${index + 1}`}
              value={pair.left}
              onChange={(e) => set(index, { left: e.target.value })}
              className="flex-1 [&>label]:sr-only"
              placeholder="Prompt"
            />
            <Icon name="chevronRight" size={16} className="mt-3 shrink-0 text-ink-300" strokeStyle />
            <Input
              label={`Right item ${index + 1}`}
              value={pair.right}
              onChange={(e) => set(index, { right: e.target.value })}
              className="flex-1 [&>label]:sr-only"
              placeholder="Its match"
            />
            <button
              type="button"
              onClick={() => remove(index)}
              aria-label={`Remove pair ${index + 1}`}
              className="mt-1 rounded-lg p-2 text-ink-500 hover:bg-danger-50 hover:text-danger-600"
            >
              <Icon name="trash" size={15} />
            </button>
          </li>
        ))}
      </ul>
      <Button className="mt-2.5" variant="secondary" size="sm" onClick={add} icon={<Icon name="plus" size={14} />}>
        Add a pair
      </Button>
    </fieldset>
  );
}

function TheoryEditor({ form, patch, errors, rubricSum, rubricMismatch }) {
  const setCriterion = (index, changes) =>
    patch((current) => ({
      markingRubric: current.markingRubric.map((criterion, i) => (i === index ? { ...criterion, ...changes } : criterion)),
    }));

  const addCriterion = () =>
    patch((current) => ({
      markingRubric: [
        ...current.markingRubric,
        {
          id: `c${current.markingRubric.length + 1}`,
          label: '',
          description: '',
          marks: 1,
          keywordsText: '',
          synonymsText: '',
          required: false,
        },
      ],
    }));

  const removeCriterion = (index) =>
    patch((current) => ({ markingRubric: current.markingRubric.filter((_, i) => i !== index) }));

  return (
    <div className="space-y-5">
      <Textarea
        label="Ideal answer"
        rows={6}
        value={form.idealAnswer}
        error={errors.idealAnswer}
        onChange={(e) => patch({ idealAnswer: e.target.value })}
        hint="What a full-mark answer contains. Shown to the candidate after marking."
      />

      <RepeatableStrings
        legend="Key points"
        hint="The points a marker looks for, one to a line."
        values={form.keyPoints}
        error={errors.keyPoints}
        placeholder="A point the answer should make"
        addLabel="Add a key point"
        onChange={(keyPoints) => patch({ keyPoints })}
      />

      <fieldset>
        <legend className="mb-1 text-sm font-medium text-ink-700">Marking rubric</legend>
        <p className="mb-2.5 text-xs leading-relaxed text-ink-500">
          Each criterion is marked separately, and the candidate is shown which ones their answer covered. Keywords and
          synonym groups are what the deterministic marker matches against.
        </p>

        <div
          className={cx(
            'mb-3 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2.5 text-sm',
            rubricMismatch ? 'bg-warning-50 text-warning-600' : 'bg-paper-100 text-ink-600',
          )}
          role={rubricMismatch ? 'alert' : undefined}
        >
          <Icon name={rubricMismatch ? 'alert' : 'info'} size={15} />
          <span className="tabular">
            Rubric total: {rubricSum} of {form.marks || 0} marks
          </span>
          {rubricMismatch && <span>— these do not agree. Adjust the criteria or the question's marks.</span>}
        </div>

        <ul className="space-y-3">
          {form.markingRubric.map((criterion, index) => (
            <li key={index} className="rounded-xl border border-paper-300 p-3.5">
              <div className="grid gap-3 sm:grid-cols-[6rem_1fr_5rem]">
                <Input
                  label="Identifier"
                  value={criterion.id}
                  error={errors[`markingRubric.${index}.id`]}
                  onChange={(e) => setCriterion(index, { id: e.target.value })}
                />
                <Input
                  label="Label"
                  value={criterion.label}
                  error={errors[`markingRubric.${index}.label`]}
                  placeholder="Definition"
                  onChange={(e) => setCriterion(index, { label: e.target.value })}
                />
                <Input
                  label="Marks"
                  type="number"
                  min="0"
                  value={criterion.marks}
                  error={errors[`markingRubric.${index}.marks`]}
                  onChange={(e) => setCriterion(index, { marks: e.target.value })}
                />
              </div>

              <div className="mt-3 space-y-3">
                <Textarea
                  label="Description"
                  rows={2}
                  value={criterion.description}
                  onChange={(e) => setCriterion(index, { description: e.target.value })}
                  hint="Shown as guidance when a candidate misses this criterion."
                />
                <Input
                  label="Keywords"
                  value={criterion.keywordsText}
                  onChange={(e) => setCriterion(index, { keywordsText: e.target.value })}
                  hint="Comma separated."
                  placeholder="grace, justification, faith"
                />
                <Textarea
                  label="Synonym groups"
                  rows={3}
                  value={criterion.synonymsText}
                  onChange={(e) => setCriterion(index, { synonymsText: e.target.value })}
                  hint="One group to a line, comma separated within a line. Any one term in a group satisfies the criterion."
                  placeholder={'atonement, reconciliation\nsanctification, holiness'}
                />
                <div className="flex items-center justify-between gap-3">
                  <Checkbox
                    label="Required — an answer that misses this cannot gain full marks"
                    checked={criterion.required}
                    onChange={(e) => setCriterion(index, { required: e.target.checked })}
                  />
                  <Button variant="ghost" size="sm" onClick={() => removeCriterion(index)} icon={<Icon name="trash" size={14} />}>
                    Remove
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <Button className="mt-3" variant="secondary" size="sm" onClick={addCriterion} icon={<Icon name="plus" size={14} />}>
          Add a criterion
        </Button>
      </fieldset>
    </div>
  );
}

function ScriptureEditor({ form, patch, errors }) {
  const [paste, setPaste] = useState('');
  const [pasteError, setPasteError] = useState('');

  const set = (index, changes) =>
    patch((current) => ({
      scriptureReferences: current.scriptureReferences.map((entry, i) => (i === index ? { ...entry, ...changes } : entry)),
    }));

  const remove = (index) =>
    patch((current) => ({ scriptureReferences: current.scriptureReferences.filter((_, i) => i !== index) }));

  const addBlank = () =>
    patch((current) => ({ scriptureReferences: [...current.scriptureReferences, { book: '', chapter: '', verses: '' }] }));

  const addFromPaste = () => {
    const parsed = parseScriptureReference(paste);
    if (!parsed) {
      setPasteError('That does not look like a reference. Try something like “Amos 5:24” or “1 Kings 18”.');
      return;
    }
    setPasteError('');
    setPaste('');
    patch((current) => ({ scriptureReferences: [...current.scriptureReferences, parsed] }));
  };

  return (
    <fieldset className="rounded-xl border border-paper-300 p-4">
      <legend className="px-1.5 text-sm font-medium text-ink-700">Scripture references</legend>
      <p className="mb-3 px-1.5 text-xs leading-relaxed text-ink-500">
        Shown with the answer, and linked to the passage. Paste a reference and it will be split for you.
      </p>

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <Input
          label="Paste a reference"
          value={paste}
          error={pasteError}
          placeholder="Amos 5:24"
          className="min-w-[12rem] flex-1"
          onChange={(e) => {
            setPaste(e.target.value);
            setPasteError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addFromPaste();
            }
          }}
        />
        <Button variant="secondary" onClick={addFromPaste} className="mb-0.5">
          Add
        </Button>
      </div>

      {form.scriptureReferences.length === 0 ? (
        <p className="px-1.5 text-xs text-ink-500">No scripture is attached to this question.</p>
      ) : (
        <ul className="space-y-2">
          {form.scriptureReferences.map((entry, index) => (
            <li key={index} className="flex items-start gap-2">
              <Input
                label={`Book ${index + 1}`}
                value={entry.book}
                error={errors[`scriptureReferences.${index}.book`]}
                onChange={(e) => set(index, { book: e.target.value })}
                className="flex-1 [&>label]:sr-only"
                placeholder="Book"
              />
              <Input
                label={`Chapter ${index + 1}`}
                type="number"
                min="1"
                value={entry.chapter}
                error={errors[`scriptureReferences.${index}.chapter`]}
                onChange={(e) => set(index, { chapter: e.target.value })}
                className="w-24 [&>label]:sr-only"
                placeholder="Ch."
              />
              <Input
                label={`Verses ${index + 1}`}
                value={entry.verses}
                onChange={(e) => set(index, { verses: e.target.value })}
                className="w-28 [&>label]:sr-only"
                placeholder="Verses"
              />
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={`Remove ${referenceLine(entry) || `reference ${index + 1}`}`}
                className="mt-1 rounded-lg p-2 text-ink-500 hover:bg-danger-50 hover:text-danger-600"
              >
                <Icon name="trash" size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Button className="mt-2.5" variant="ghost" size="sm" onClick={addBlank} icon={<Icon name="plus" size={14} />}>
        Add an empty row
      </Button>
    </fieldset>
  );
}

function TagInput({ tags, onChange, error }) {
  const [draft, setDraft] = useState('');

  const commit = () => {
    const value = draft.trim().replace(/,$/, '');
    if (!value) return;
    if (!tags.includes(value)) onChange([...tags, value]);
    setDraft('');
  };

  return (
    <div>
      <Input
        label="Tags"
        value={draft}
        error={error}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commit();
          }
          if (e.key === 'Backspace' && !draft && tags.length) onChange(tags.slice(0, -1));
        }}
        hint="Press Enter after each tag."
        placeholder="wesley, sacraments"
      />
      {tags.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li key={tag}>
              <button
                type="button"
                onClick={() => onChange(tags.filter((t) => t !== tag))}
                className="inline-flex items-center gap-1.5 rounded-full bg-paper-200 px-2.5 py-1 text-xs font-medium text-ink-700 hover:bg-danger-50 hover:text-danger-600"
              >
                {tag}
                <Icon name="close" size={11} />
                <span className="sr-only">Remove this tag</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EditorSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading the question.</p>
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="space-y-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="mb-4 h-5 w-40" />
              <SkeletonText lines={5} />
            </Card>
          ))}
        </div>
        <Card className="p-5">
          <Skeleton className="mb-4 h-5 w-32" />
          <SkeletonText lines={8} />
        </Card>
      </div>
    </div>
  );
}
