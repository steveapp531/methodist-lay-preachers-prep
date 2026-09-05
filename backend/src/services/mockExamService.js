import mongoose from 'mongoose';
import { CONTENT_STATUS, QUESTION_TYPES, SESSION_MODES, readinessBand } from '../../../shared/constants.js';
import { ExamAttempt } from '../models/ExamAttempt.js';
import { MockExam } from '../models/MockExam.js';
import { Question } from '../models/Question.js';
import { ApiError } from '../utils/ApiError.js';
import { submitAnswer } from './attemptService.js';

const { Types } = mongoose;
const oid = (v) => new Types.ObjectId(String(v));

/**
 * Starts a sitting.
 *
 * The deadline is computed and stored server-side, so a candidate cannot buy
 * extra time by pausing the tab or editing a clock. Dynamic papers sample their
 * questions now, meaning the same mock can be retaken with a fresh paper.
 */
export async function startAttempt({ user, mockExamId }) {
  const mock = await MockExam.findOne({ _id: mockExamId, status: CONTENT_STATUS.PUBLISHED });
  if (!mock) throw ApiError.notFound('That mock examination is not available.');

  const existing = await ExamAttempt.findOne({ user: user._id, mockExam: mock._id, status: 'in_progress' });
  if (existing) {
    if (existing.expiresAt > new Date()) return { attempt: existing, mock, resumed: true };
    existing.status = 'expired';
    await existing.save();
  }

  const answers = [];
  for (const section of mock.sections) {
    const questions = section.questions?.length
      ? await Question.find({ _id: { $in: section.questions }, status: CONTENT_STATUS.PUBLISHED })
      : await sampleSection(mock, section);

    if (questions.length < section.count) {
      throw ApiError.unprocessable(
        `"${section.label}" needs ${section.count} questions but only ${questions.length} are published. ` +
          'Publish more questions for this section, or reduce its size in the admin area.',
      );
    }

    questions.slice(0, section.count).forEach((question, index) => {
      answers.push({
        question: question._id,
        sectionKey: section.key,
        order: index + 1,
        marksAvailable: section.marksEach ?? question.totalMarks ?? 1,
        // Theory sections offer more questions than must be answered; which
        // ones count is decided at submission from what was actually written.
        counted: section.answerCount == null,
      });
    });
  }

  const now = new Date();
  const attempt = await ExamAttempt.create({
    user: user._id,
    exam: mock.exam,
    mockExam: mock._id,
    subject: mock.subject,
    title: mock.title,
    durationMinutes: mock.durationMinutes,
    startedAt: now,
    expiresAt: new Date(now.getTime() + mock.durationMinutes * 60000),
    answers,
    status: 'in_progress',
  });

  return { attempt, mock, resumed: false };
}

async function sampleSection(mock, section) {
  const filter = {
    exam: mock.exam,
    status: CONTENT_STATUS.PUBLISHED,
    type: { $in: section.questionTypes?.length ? section.questionTypes : [QUESTION_TYPES.MULTIPLE_CHOICE] },
  };
  const subject = section.sampling?.subject || mock.subject;
  if (subject) filter.subject = oid(subject);
  if (section.sampling?.chapters?.length) filter.chapter = { $in: section.sampling.chapters.map(oid) };
  if (section.sampling?.topics?.length) filter.topic = { $in: section.sampling.topics.map(oid) };

  const mix = section.sampling?.difficultyMix || { easy: 0.3, medium: 0.5, hard: 0.2 };
  const wanted = section.count;
  const picked = [];
  const seen = new Set();

  for (const [difficulty, share] of Object.entries(mix)) {
    const want = Math.round(wanted * share);
    if (want <= 0) continue;
    const rows = await Question.aggregate([
      { $match: { ...filter, difficulty, _id: { $nin: [...seen].map(oid) } } },
      { $sample: { size: want } },
    ]);
    rows.forEach((r) => {
      if (!seen.has(String(r._id))) {
        seen.add(String(r._id));
        picked.push(r);
      }
    });
  }

  if (picked.length < wanted) {
    const rows = await Question.aggregate([
      { $match: { ...filter, _id: { $nin: [...seen].map(oid) } } },
      { $sample: { size: wanted - picked.length } },
    ]);
    rows.forEach((r) => {
      if (!seen.has(String(r._id))) {
        seen.add(String(r._id));
        picked.push(r);
      }
    });
  }

  return Question.find({ _id: { $in: picked.map((p) => p._id) } });
}

/** Saves progress mid-examination. No marking happens here. */
export async function saveProgress({ attempt, updates = [] }) {
  const byQuestion = new Map(attempt.answers.map((a) => [String(a.question), a]));
  for (const update of updates) {
    const answer = byQuestion.get(String(update.questionId));
    if (!answer) continue;
    if (update.selectedOptionKeys !== undefined) answer.selectedOptionKeys = update.selectedOptionKeys;
    if (update.textAnswer !== undefined) answer.textAnswer = update.textAnswer;
    if (update.matchAnswer !== undefined) answer.matchAnswer = update.matchAnswer;
    if (update.flagged !== undefined) answer.flagged = Boolean(update.flagged);
    if (update.viaVoice !== undefined) answer.viaVoice = Boolean(update.viaVoice);
    if (update.timeSpentSeconds !== undefined) {
      answer.timeSpentSeconds = Math.max(0, Math.min(Number(update.timeSpentSeconds) || 0, 7200));
    }
    answer.answered = hasContent(answer);
  }
  attempt.markModified('answers');
  await attempt.save();
  return attempt;
}

function hasContent(answer) {
  return Boolean(
    answer.selectedOptionKeys?.length ||
      String(answer.textAnswer || '').trim() ||
      (answer.matchAnswer && Object.keys(Object.fromEntries(answer.matchAnswer)).length),
  );
}

/**
 * Marks the whole paper.
 *
 * Theory sections that offer a choice ("answer three of five") count only the
 * candidate's best answers, which is how a real examiner would treat them.
 */
export async function submitAttempt({ user, attempt, autoSubmitted = false }) {
  if (attempt.status !== 'in_progress') {
    throw ApiError.conflict('That examination has already been submitted.');
  }

  const mock = await MockExam.findById(attempt.mockExam).lean();
  const questions = await Question.find({ _id: { $in: attempt.answers.map((a) => a.question) } });
  const byId = new Map(questions.map((q) => [String(q._id), q]));

  const graded = [];
  for (const answer of attempt.answers) {
    const question = byId.get(String(answer.question));
    if (!question) continue;

    const attempted = hasContent(answer);
    if (!attempted) {
      answer.answered = false;
      answer.isCorrect = false;
      answer.score = 0;
      answer.marksAwarded = 0;
      answer.marksAvailable = question.totalMarks || answer.marksAvailable || 1;
      graded.push({ answer, question, attempted: false });
      continue;
    }

    const { result, theoryEvaluation } = await submitAnswer({
      user,
      question,
      response: {
        selectedOptionKeys: answer.selectedOptionKeys,
        textAnswer: answer.textAnswer,
        matchAnswer: answer.matchAnswer ? Object.fromEntries(answer.matchAnswer) : undefined,
        viaVoice: answer.viaVoice,
      },
      mode: SESSION_MODES.MOCK_EXAM,
      examAttemptId: attempt._id,
      timeSpentSeconds: answer.timeSpentSeconds,
    });

    answer.answered = true;
    answer.isCorrect = result.isCorrect;
    answer.score = result.score;
    answer.marksAwarded = result.marksAwarded;
    answer.marksAvailable = result.marksAvailable;
    answer.theoryEvaluation = theoryEvaluation?._id || null;
    graded.push({ answer, question, attempted: true });
  }

  applySectionChoice(attempt, mock, graded);
  rollUp(attempt, graded);
  await buildBreakdown(attempt, graded);

  attempt.status = 'marked';
  attempt.submittedAt = new Date();
  attempt.autoSubmitted = autoSubmitted;
  attempt.timeTakenSeconds = Math.round((attempt.submittedAt - attempt.startedAt) / 1000);
  attempt.readinessScore = attempt.percentage;
  attempt.readinessBand = readinessBand(attempt.percentage).key;
  attempt.markModified('answers');
  await attempt.save();

  return attempt;
}

/** "Answer three of five": keep the best three, exclude the rest from totals. */
function applySectionChoice(attempt, mock, graded) {
  if (!mock?.sections?.length) return;
  for (const section of mock.sections) {
    if (section.answerCount == null || section.answerCount >= section.count) {
      graded.filter((g) => g.answer.sectionKey === section.key).forEach((g) => {
        g.answer.counted = true;
      });
      continue;
    }
    const inSection = graded.filter((g) => g.answer.sectionKey === section.key);
    const ranked = [...inSection].sort((a, b) => b.answer.marksAwarded - a.answer.marksAwarded);
    const keep = new Set(ranked.slice(0, section.answerCount).map((g) => String(g.answer.question)));
    inSection.forEach((g) => {
      g.answer.counted = keep.has(String(g.answer.question));
    });
  }
}

function rollUp(attempt, graded) {
  let objectiveMarks = 0;
  let objectiveAvailable = 0;
  let theoryMarks = 0;
  let theoryAvailable = 0;
  let attempted = 0;
  let correct = 0;
  let incorrect = 0;

  for (const { answer, question } of graded) {
    if (!answer.counted) continue;
    const isTheory = question.type === QUESTION_TYPES.THEORY;
    if (isTheory) {
      theoryMarks += answer.marksAwarded;
      theoryAvailable += answer.marksAvailable;
    } else {
      objectiveMarks += answer.marksAwarded;
      objectiveAvailable += answer.marksAvailable;
    }
    if (answer.answered) {
      attempted += 1;
      if (answer.isCorrect) correct += 1;
      else incorrect += 1;
    }
  }

  attempt.objectiveMarks = round1(objectiveMarks);
  attempt.objectiveAvailable = round1(objectiveAvailable);
  attempt.theoryMarks = round1(theoryMarks);
  attempt.theoryAvailable = round1(theoryAvailable);
  attempt.totalMarks = round1(objectiveMarks + theoryMarks);
  attempt.totalAvailable = round1(objectiveAvailable + theoryAvailable);
  attempt.percentage = attempt.totalAvailable ? Math.round((attempt.totalMarks / attempt.totalAvailable) * 100) : 0;
  attempt.questionsAttempted = attempted;
  attempt.questionsCorrect = correct;
  attempt.questionsIncorrect = incorrect;
}

async function buildBreakdown(attempt, graded) {
  const byTopic = new Map();
  const topicIds = [...new Set(graded.map((g) => g.question.topic).filter(Boolean).map(String))];
  const topics = topicIds.length
    ? await mongoose.model('Topic').find({ _id: { $in: topicIds } }).populate('subject', 'name shortName').lean()
    : [];
  const topicById = new Map(topics.map((t) => [String(t._id), t]));

  for (const { answer, question } of graded) {
    if (!answer.counted || !question.topic) continue;
    const key = String(question.topic);
    const topic = topicById.get(key);
    const entry = byTopic.get(key) || {
      topic: question.topic,
      topicTitle: topic?.title || 'Unassigned',
      subjectName: topic?.subject?.shortName || topic?.subject?.name || '',
      attempted: 0,
      correct: 0,
    };
    entry.attempted += 1;
    if (answer.isCorrect) entry.correct += 1;
    byTopic.set(key, entry);
  }

  const rows = [...byTopic.values()].map((t) => ({ ...t, accuracy: t.attempted ? t.correct / t.attempted : 0 }));
  rows.sort((a, b) => a.accuracy - b.accuracy);

  attempt.topicBreakdown = rows;
  attempt.weakTopics = rows.filter((r) => r.accuracy < 0.6).slice(0, 5).map((r) => r.topicTitle);
  attempt.strongTopics = [...rows].reverse().filter((r) => r.accuracy >= 0.8).slice(0, 5).map((r) => r.topicTitle);
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

/** Submits any sitting whose deadline has passed. */
export async function expireOverdueAttempts(user) {
  const overdue = await ExamAttempt.find({ user: user._id, status: 'in_progress', expiresAt: { $lte: new Date() } });
  const results = [];
  for (const attempt of overdue) {
    results.push(await submitAttempt({ user, attempt, autoSubmitted: true }));
  }
  return results;
}
