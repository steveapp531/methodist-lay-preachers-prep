import {
  ANSWER_CONFIDENCE,
  CONTENT_STATUS,
  DIFFICULTIES,
  QUESTION_TYPES,
  SOURCE_KIND,
} from '../../../shared/constants.js';
import { Chapter } from '../models/Chapter.js';
import { Exam } from '../models/Exam.js';
import { Question } from '../models/Question.js';
import { Subject } from '../models/Subject.js';
import { Topic } from '../models/Topic.js';
import { logger } from '../config/logger.js';
import { slugify } from '../utils/text.js';

/**
 * Imports a question bank from plain records.
 *
 * The import format is human-writable on purpose: subjects, chapters and topics
 * are referenced by their codes and titles rather than database ids, so a row
 * can be typed in a spreadsheet without knowing anything about the database.
 *
 * Rows are validated individually. One bad row reports its own error and the
 * rest still import, because a 500-question import should not fail because of a
 * typo on line 212. `dryRun` validates without writing anything.
 */
export async function importQuestions({ rows, dryRun = false, defaultStatus = CONTENT_STATUS.DRAFT, actorId = null }) {
  const cache = { exams: new Map(), subjects: new Map(), chapters: new Map(), topics: new Map() };
  const errors = [];
  const warnings = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const [index, row] of rows.entries()) {
    const line = index + 1;
    try {
      const resolved = await resolveRow(row, cache);
      const payload = buildPayload(row, resolved, defaultStatus, actorId);

      const problems = validatePayload(payload, row);
      if (problems.length) {
        errors.push({ line, questionId: row.questionId || null, problems });
        skipped += 1;
        continue;
      }
      if (resolved.warnings.length) warnings.push({ line, questionId: payload.questionId, warnings: resolved.warnings });

      if (dryRun) {
        created += 1;
        continue;
      }

      const existing = await Question.findOne({ questionId: payload.questionId });
      if (existing) {
        Object.assign(existing, payload);
        await existing.save();
        updated += 1;
      } else {
        await Question.create(payload);
        created += 1;
      }
    } catch (err) {
      errors.push({ line, questionId: row.questionId || null, problems: [err.message] });
      skipped += 1;
    }
  }

  if (!dryRun && (created || updated)) await refreshAllCounts();

  return { total: rows.length, created, updated, skipped, errors, warnings, dryRun };
}

async function resolveRow(row, cache) {
  const warnings = [];

  const examCode = String(row.examStage || row.exam || 'PART2').toUpperCase();
  let exam = cache.exams.get(examCode);
  if (!exam) {
    exam = await Exam.findOne({ code: examCode });
    if (!exam) throw new Error(`Unknown examination stage "${examCode}". Seed the examination before importing.`);
    cache.exams.set(examCode, exam);
  }

  const subjectKey = String(row.subject || row.subjectCode || '').trim();
  if (!subjectKey) throw new Error('A subject is required (use the subject code, e.g. "DOC", or its full name).');
  const subjectCacheKey = `${exam.code}:${subjectKey.toLowerCase()}`;
  let subject = cache.subjects.get(subjectCacheKey);
  if (!subject) {
    subject = await Subject.findOne({
      exam: exam._id,
      $or: [{ code: subjectKey.toUpperCase() }, { slug: slugify(subjectKey) }, { name: subjectKey }],
    });
    if (!subject) throw new Error(`Unknown subject "${subjectKey}" for ${exam.code}.`);
    cache.subjects.set(subjectCacheKey, subject);
  }

  let chapter = null;
  const chapterKey = String(row.chapter || '').trim();
  if (chapterKey) {
    const key = `${subject._id}:${chapterKey.toLowerCase()}`;
    chapter = cache.chapters.get(key);
    if (chapter === undefined) {
      chapter = await Chapter.findOne({
        subject: subject._id,
        $or: [{ slug: slugify(`${subject.code}-${chapterKey}`) }, { title: new RegExp(`^${escape(chapterKey)}$`, 'i') }, { number: chapterKey }],
      });
      cache.chapters.set(key, chapter);
    }
    if (!chapter) warnings.push(`Chapter "${chapterKey}" was not found; the question was imported without one.`);
  }

  let topic = null;
  const topicKey = String(row.topic || '').trim();
  if (topicKey) {
    const key = `${subject._id}:${topicKey.toLowerCase()}`;
    topic = cache.topics.get(key);
    if (topic === undefined) {
      topic = await Topic.findOne({
        subject: subject._id,
        ...(chapter ? { chapter: chapter._id } : {}),
        $or: [{ title: new RegExp(`^${escape(topicKey)}$`, 'i') }, { slug: slugify(topicKey) }, { number: topicKey }],
      });
      cache.topics.set(key, topic);
    }
    if (!topic) warnings.push(`Topic "${topicKey}" was not found; the question was imported without one.`);
  }

  return { exam, subject, chapter: chapter || null, topic: topic || null, warnings };
}

function buildPayload(row, { exam, subject, chapter, topic }, defaultStatus, actorId) {
  const type = normaliseType(row.questionType || row.type);
  const options = normaliseOptions(row, type);
  const correctOptionKeys = normaliseCorrectKeys(row, options, type);

  return {
    questionId: String(row.questionId || row.id || autoId(subject, type, row)).trim(),
    exam: exam._id,
    subject: subject._id,
    chapter: chapter?._id || null,
    topic: topic?._id || null,
    type,
    prompt: String(row.question || row.prompt || '').trim(),
    context: String(row.context || '').trim(),
    options,
    correctOptionKeys,
    acceptedAnswers: toArray(row.acceptedAnswers ?? row.correctAnswer).filter((v) => type === QUESTION_TYPES.FILL_BLANK),
    matchPairs: Array.isArray(row.matchPairs) ? row.matchPairs : [],
    idealAnswer: String(row.idealAnswer || '').trim(),
    keyPoints: toArray(row.keyPoints),
    markingRubric: normaliseRubric(row.markingRubric),
    marks: Number(row.marks) || (type === QUESTION_TYPES.THEORY ? 25 : 1),
    suggestedMinutes: row.suggestedMinutes != null ? Number(row.suggestedMinutes) : null,
    explanation: String(row.explanation || '').trim(),
    manualReference: {
      subjectName: row.manualReference?.subjectName || subject.name,
      chapterTitle: row.manualReference?.chapterTitle || chapter?.title || '',
      topicTitle: row.manualReference?.topicTitle || topic?.title || '',
      anchor: row.manualReference?.anchor ?? topic?.sourceAnchor ?? null,
      pageNumber: row.pageNumber ?? row.manualReference?.pageNumber ?? null,
      excerpt: String(row.manualReference?.excerpt || row.manualExcerpt || '').trim(),
      citation: row.manualReference?.citation || row.manualReference_citation || topic?.citation || '',
    },
    scriptureReferences: normaliseScriptures(row.scriptureReferences),
    difficulty: Object.values(DIFFICULTIES).includes(row.difficulty) ? row.difficulty : DIFFICULTIES.MEDIUM,
    tags: toArray(row.tags),
    sourceKind: Object.values(SOURCE_KIND).includes(row.sourceKind) ? row.sourceKind : SOURCE_KIND.MANUAL_DERIVED,
    source: {
      label: String(row.source?.label || row.source || '').trim(),
      paperCode: String(row.source?.paperCode || '').trim(),
      year: row.source?.year ?? row.year ?? null,
      sitting: String(row.source?.sitting || row.sitting || '').trim(),
      sectionLabel: String(row.source?.sectionLabel || row.section || '').trim(),
      questionNumber: String(row.source?.questionNumber || row.questionNumber || '').trim(),
    },
    answerConfidence: Object.values(ANSWER_CONFIDENCE).includes(row.answerConfidence)
      ? row.answerConfidence
      : ANSWER_CONFIDENCE.UNVERIFIED,
    reviewNotes: String(row.reviewNotes || '').trim(),
    status: Object.values(CONTENT_STATUS).includes(row.status) ? row.status : defaultStatus,
    updatedBy: actorId,
  };
}

/**
 * Validation rules exist to stop a question reaching a candidate in a state
 * where it cannot teach them anything — no answer key, or an answer key that
 * points at an option that does not exist.
 */
function validatePayload(payload, row) {
  const problems = [];
  if (!payload.prompt) problems.push('The question text is empty.');
  if (!payload.questionId) problems.push('A questionId is required.');

  if (payload.type === QUESTION_TYPES.THEORY) {
    if (!payload.idealAnswer && !payload.keyPoints.length && !payload.markingRubric.length) {
      problems.push('A theory question needs an idealAnswer, keyPoints, or a markingRubric so it can be marked.');
    }
  } else if (payload.type === QUESTION_TYPES.FILL_BLANK) {
    if (!payload.acceptedAnswers.length) problems.push('A fill-in-the-blank question needs at least one accepted answer.');
  } else if (payload.type === QUESTION_TYPES.MATCHING) {
    if (!payload.matchPairs.length) problems.push('A matching question needs matchPairs.');
  } else {
    if (payload.options.length < 2) problems.push('An objective question needs at least two options.');
    if (!payload.correctOptionKeys.length) {
      // A past paper transcribed without its answer key is a legitimate state:
      // it is kept, flagged, and held back from candidates until reviewed.
      if (payload.sourceKind === SOURCE_KIND.PAST_PAPER) {
        payload.answerConfidence = ANSWER_CONFIDENCE.UNVERIFIED;
        payload.status = CONTENT_STATUS.NEEDS_REVIEW;
        payload.reviewNotes = [payload.reviewNotes, 'Imported without an answer key.'].filter(Boolean).join(' ');
      } else {
        problems.push('No correct answer was given.');
      }
    } else {
      const keys = new Set(payload.options.map((o) => String(o.key).toUpperCase()));
      const stray = payload.correctOptionKeys.filter((k) => !keys.has(String(k).toUpperCase()));
      if (stray.length) problems.push(`The answer key refers to options that do not exist: ${stray.join(', ')}.`);
    }
  }

  // A published question must be able to explain itself.
  if (payload.status === CONTENT_STATUS.PUBLISHED && !payload.explanation && !payload.manualReference.excerpt) {
    problems.push('A published question needs an explanation or a syllabus excerpt so a wrong answer teaches something.');
  }

  if (row.questionType && !payload.type) problems.push(`Unknown question type "${row.questionType}".`);
  return problems;
}

function normaliseType(value) {
  const key = String(value || '').toLowerCase().replace(/[\s-]/g, '_');
  const aliases = {
    mcq: QUESTION_TYPES.MULTIPLE_CHOICE,
    multiple_choice: QUESTION_TYPES.MULTIPLE_CHOICE,
    objective: QUESTION_TYPES.MULTIPLE_CHOICE,
    true_false: QUESTION_TYPES.TRUE_FALSE,
    truefalse: QUESTION_TYPES.TRUE_FALSE,
    tf: QUESTION_TYPES.TRUE_FALSE,
    multiple_response: QUESTION_TYPES.MULTIPLE_RESPONSE,
    multi_select: QUESTION_TYPES.MULTIPLE_RESPONSE,
    fill_blank: QUESTION_TYPES.FILL_BLANK,
    fill_in_the_blank: QUESTION_TYPES.FILL_BLANK,
    completion: QUESTION_TYPES.FILL_BLANK,
    short_answer: QUESTION_TYPES.FILL_BLANK,
    matching: QUESTION_TYPES.MATCHING,
    theory: QUESTION_TYPES.THEORY,
    essay: QUESTION_TYPES.THEORY,
  };
  return aliases[key] || QUESTION_TYPES.MULTIPLE_CHOICE;
}

function normaliseOptions(row, type) {
  if (type === QUESTION_TYPES.THEORY || type === QUESTION_TYPES.FILL_BLANK || type === QUESTION_TYPES.MATCHING) return [];

  if (type === QUESTION_TYPES.TRUE_FALSE && !row.options?.length) {
    return [
      { key: 'A', text: 'True', isCorrect: false, rationale: '' },
      { key: 'B', text: 'False', isCorrect: false, rationale: '' },
    ];
  }

  const raw = row.options;
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw.map((option, i) => {
      if (typeof option === 'string') {
        return { key: letter(i), text: option.trim(), isCorrect: false, rationale: '' };
      }
      return {
        key: String(option.key || letter(i)).toUpperCase(),
        text: String(option.text ?? option.value ?? '').trim(),
        isCorrect: Boolean(option.isCorrect),
        rationale: String(option.rationale || '').trim(),
      };
    });
  }

  // Object form: { A: "...", B: "..." }
  return Object.entries(raw).map(([key, text]) => ({
    key: String(key).toUpperCase(),
    text: String(text).trim(),
    isCorrect: false,
    rationale: '',
  }));
}

function normaliseCorrectKeys(row, options, type) {
  if (type === QUESTION_TYPES.THEORY || type === QUESTION_TYPES.FILL_BLANK || type === QUESTION_TYPES.MATCHING) return [];

  const flagged = options.filter((o) => o.isCorrect).map((o) => o.key);
  if (flagged.length) return flagged;

  const raw = row.correctAnswer ?? row.correctOptionKeys ?? row.answer;
  if (raw == null || raw === '') return [];

  const values = toArray(raw).map((v) => String(v).trim());
  const keys = [];
  for (const value of values) {
    const upper = value.toUpperCase();
    if (options.some((o) => o.key === upper)) {
      keys.push(upper);
      continue;
    }
    // True/False papers often record the answer as the word, not the letter.
    const byText = options.find((o) => o.text.toLowerCase() === value.toLowerCase());
    if (byText) keys.push(byText.key);
  }

  options.forEach((o) => {
    o.isCorrect = keys.includes(o.key);
  });
  return keys;
}

function normaliseRubric(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((c, i) => ({
    id: String(c.id || `c${i + 1}`),
    label: String(c.label || c.criterion || `Point ${i + 1}`),
    description: String(c.description || ''),
    marks: Number(c.marks) || 1,
    keywords: toArray(c.keywords),
    synonyms: Array.isArray(c.synonyms) ? c.synonyms.map((s) => toArray(s)) : [],
    required: Boolean(c.required),
  }));
}

function normaliseScriptures(raw) {
  return toArray(raw)
    .map((entry) => {
      if (typeof entry === 'string') {
        const match = entry.match(/^\s*((?:[1-3]\s*)?[A-Za-z][A-Za-z\s]*?)\s+(\d{1,3})(?::([\d\-,\s]+))?\s*$/);
        if (!match) return null;
        const book = match[1].trim();
        return { book, chapter: Number(match[2]), verses: match[3]?.replace(/\s/g, '') || null, reference: entry.trim(), note: '' };
      }
      if (!entry?.book || !entry?.chapter) return null;
      return {
        book: String(entry.book),
        chapter: Number(entry.chapter),
        verses: entry.verses ? String(entry.verses) : null,
        reference: entry.reference || `${entry.book} ${entry.chapter}${entry.verses ? `:${entry.verses}` : ''}`,
        note: String(entry.note || ''),
      };
    })
    .filter(Boolean);
}

function toArray(value) {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value.map((v) => (typeof v === 'string' ? v.trim() : v)).filter((v) => v !== '');
  if (typeof value === 'string') {
    return value.includes('|')
      ? value.split('|').map((v) => v.trim()).filter(Boolean)
      : [value.trim()];
  }
  return [value];
}

function letter(index) {
  return String.fromCharCode(65 + index);
}

function escape(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function autoId(subject, type, row) {
  const base = `${subject.code}-${type === QUESTION_TYPES.THEORY ? 'T' : 'O'}`;
  const hint = row.source?.year || row.year || 'X';
  const n = row.source?.questionNumber || row.questionNumber || Math.random().toString(36).slice(2, 7);
  return `${base}-${hint}-${n}`;
}

async function refreshAllCounts() {
  const published = { status: CONTENT_STATUS.PUBLISHED };
  const subjects = await Subject.find().select('_id').lean();
  for (const subject of subjects) {
    await Subject.updateOne(
      { _id: subject._id },
      { 'stats.questionCount': await Question.countDocuments({ subject: subject._id, ...published }) },
    );
  }
  const topics = await Topic.find().select('_id').lean();
  for (const topic of topics) {
    await Topic.updateOne(
      { _id: topic._id },
      { 'stats.questionCount': await Question.countDocuments({ topic: topic._id, ...published }) },
    );
  }
  logger.debug('Refreshed content counts after import');
}
