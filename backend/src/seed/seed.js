import mongoose from 'mongoose';
import { CONTENT_STATUS, EXAM_STAGE_CODES, QUESTION_TYPES, SOURCE_KIND } from '../../../shared/constants.js';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { Flashcard } from '../models/Flashcard.js';
import { MockExam } from '../models/MockExam.js';
import { Question } from '../models/Question.js';
import { Subject } from '../models/Subject.js';
import { Topic } from '../models/Topic.js';
import { User } from '../models/User.js';
import { importQuestions } from '../services/importService.js';
import { slugify } from '../utils/text.js';
import { buildScriptureIndex, ensureExam, loadManual, readJson } from './loadManual.js';

const RESET = process.argv.includes('--reset');
const SKIP_QUESTIONS = process.argv.includes('--manual-only');

/**
 * Seeds the database from the files in `data/part2`.
 *
 * Safe to run repeatedly. `--reset` clears content collections first (but never
 * users or their progress). Adding official content later means dropping new
 * JSON into `data/part2` and running this again.
 */
async function seed() {
  await connectDatabase();
  logger.info(RESET ? 'Seeding (content will be reset)…' : 'Seeding…');

  if (RESET) {
    await Promise.all([
      Question.deleteMany({}),
      Flashcard.deleteMany({}),
      MockExam.deleteMany({}),
      mongoose.model('Chapter').deleteMany({}),
      mongoose.model('Topic').deleteMany({}),
      mongoose.model('Subject').deleteMany({}),
      mongoose.model('ScriptureReference').deleteMany({}),
    ]);
    logger.warn('Content collections cleared. User accounts and progress were left untouched.');
  }

  /* ------------------------------------------------------ examination stages */

  const part2 = await ensureExam({
    code: EXAM_STAGE_CODES.PART2,
    name: "Lay Preachers' Examination Part 2",
    shortName: 'Part 2',
    programme: "Connexional Lay Preachers' Examination",
    awardingBody: 'The Methodist Church Ghana',
    description:
      'The second stage of the Connexional Lay Preachers\' Examination, covering six papers: Old Testament Studies, New Testament Studies, Doctrine, Liturgics, Methodist Studies and Church and Society. Each paper is examined by an objective section and a theory section.',
    order: 2,
    supportedQuestionTypes: Object.values(QUESTION_TYPES),
    hasTheoryPaper: true,
    paperBlueprint: {
      durationMinutes: 120,
      objectiveCount: 25,
      objectiveMarksEach: 1,
      theoryQuestionsOffered: 5,
      theoryQuestionsToAnswer: 3,
      theoryMarksEach: 25,
      passMark: 50,
    },
    isPublished: true,
  });

  // Part 1 exists so the stage picker is real from day one. It carries no
  // content yet; the architecture treats it exactly like Part 2 once loaded.
  await ensureExam({
    code: EXAM_STAGE_CODES.PART1,
    name: "Lay Preachers' Examination Part 1",
    shortName: 'Part 1',
    programme: "Connexional Lay Preachers' Examination",
    awardingBody: 'The Methodist Church Ghana',
    description:
      'The first stage of the Connexional Lay Preachers\' Examination. Primarily objective. Content for this stage has not been loaded yet.',
    order: 1,
    supportedQuestionTypes: [
      QUESTION_TYPES.MULTIPLE_CHOICE,
      QUESTION_TYPES.TRUE_FALSE,
      QUESTION_TYPES.FILL_BLANK,
      QUESTION_TYPES.MULTIPLE_RESPONSE,
    ],
    hasTheoryPaper: false,
    paperBlueprint: {
      durationMinutes: 90,
      objectiveCount: 40,
      objectiveMarksEach: 1,
      theoryQuestionsOffered: 0,
      theoryQuestionsToAnswer: 0,
      theoryMarksEach: 0,
      passMark: 50,
    },
    isPublished: true,
  });

  /* ------------------------------------------------------------------ manual */

  const manual = await readJson('manual.json');
  if (!manual) {
    logger.error('data/part2/manual.json is missing. Run `npm run ingest` from the repository root first.');
    process.exitCode = 1;
    await disconnectDatabase();
    return;
  }
  await loadManual({ manual, examDoc: part2 });
  await buildScriptureIndex({ examDoc: part2 });

  if (SKIP_QUESTIONS) {
    logger.info('Skipping questions (--manual-only).');
    await summarise();
    await disconnectDatabase();
    return;
  }

  /* --------------------------------------------------------------- questions */

  for (const file of ['questions.manual.json', 'questions.pastpapers.json', 'questions.demo.json']) {
    const rows = await readJson(file);
    if (!rows?.length) {
      logger.debug(`No ${file} found; skipping.`);
      continue;
    }
    const result = await importQuestions({
      rows,
      defaultStatus: file === 'questions.demo.json' ? CONTENT_STATUS.PUBLISHED : CONTENT_STATUS.PUBLISHED,
    });
    logger.info(
      `${file}: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped` +
        (result.errors.length ? ` (${result.errors.length} rows had problems)` : ''),
    );
    for (const error of result.errors.slice(0, 5)) {
      logger.warn(`  line ${error.line}: ${error.problems.join(' ')}`);
    }
  }

  /* -------------------------------------------------------------- flashcards */

  const cards = await readJson('flashcards.json');
  if (cards?.length) {
    let written = 0;
    for (const card of cards) {
      const subject = await Subject.findOne({ exam: part2._id, code: String(card.subject).toUpperCase() }).lean();
      if (!subject) continue;
      const topic = card.topic
        ? await Topic.findOne({ subject: subject._id, $or: [{ title: card.topic }, { slug: slugify(card.topic) }] }).lean()
        : null;

      await Flashcard.findOneAndUpdate(
        { cardId: card.cardId },
        {
          cardId: card.cardId,
          exam: part2._id,
          subject: subject._id,
          chapter: topic?.chapter || null,
          topic: topic?._id || null,
          front: card.front,
          back: card.back,
          kind: card.kind || 'fact',
          scriptureReferences: card.scriptureReferences || [],
          manualReference: {
            subjectName: subject.name,
            topicTitle: topic?.title || '',
            citation: topic?.citation || '',
            anchor: topic?.sourceAnchor ?? null,
            excerpt: card.excerpt || '',
          },
          tags: card.tags || [],
          sourceKind: card.sourceKind || SOURCE_KIND.MANUAL_DERIVED,
          status: CONTENT_STATUS.PUBLISHED,
          order: card.order || 0,
        },
        { upsert: true, setDefaultsOnInsert: true },
      );
      written += 1;
    }
    await refreshFlashcardCounts();
    logger.info(`Flashcards: ${written} loaded`);
  }

  /* -------------------------------------------------------------- mock exams */

  await createMockExams(part2);

  /* ------------------------------------------------------------------ admin */

  await ensureAdmin(part2);

  await summarise();
  await disconnectDatabase();
  logger.info('Seed complete.');
}

/**
 * One mock per paper, mirroring the real format found in the past papers:
 * Section A is objective and compulsory, Section B offers five theory
 * questions of which three are answered.
 */
async function createMockExams(exam) {
  const subjects = await Subject.find({ exam: exam._id }).sort({ order: 1 }).lean();
  const blueprint = exam.paperBlueprint;

  for (const subject of subjects) {
    const objectiveCount = await Question.countDocuments({
      subject: subject._id,
      status: CONTENT_STATUS.PUBLISHED,
      type: { $ne: QUESTION_TYPES.THEORY },
    });
    const theoryCount = await Question.countDocuments({
      subject: subject._id,
      status: CONTENT_STATUS.PUBLISHED,
      type: QUESTION_TYPES.THEORY,
    });

    if (objectiveCount < 5) {
      logger.warn(`Skipping mock for ${subject.name}: only ${objectiveCount} published objective questions.`);
      continue;
    }

    // Never build a paper larger than the bank can fill.
    const sectionACount = Math.min(blueprint.objectiveCount, objectiveCount);
    const sections = [
      {
        key: 'A',
        label: 'Section A — Objective',
        instructions: 'Answer all questions. Each question carries one mark.',
        questionTypes: [QUESTION_TYPES.MULTIPLE_CHOICE, QUESTION_TYPES.TRUE_FALSE, QUESTION_TYPES.FILL_BLANK],
        count: sectionACount,
        answerCount: null,
        marksEach: blueprint.objectiveMarksEach,
        sampling: { subject: subject._id, difficultyMix: { easy: 0.3, medium: 0.5, hard: 0.2 } },
      },
    ];

    if (theoryCount >= 2) {
      const offered = Math.min(blueprint.theoryQuestionsOffered, theoryCount);
      const toAnswer = Math.min(blueprint.theoryQuestionsToAnswer, offered);
      sections.push({
        key: 'B',
        label: 'Section B — Theory',
        instructions: `Answer ${numberWord(toAnswer)} questions. Each question carries ${blueprint.theoryMarksEach} marks.`,
        questionTypes: [QUESTION_TYPES.THEORY],
        count: offered,
        answerCount: toAnswer,
        marksEach: blueprint.theoryMarksEach,
        sampling: { subject: subject._id, difficultyMix: { easy: 0.2, medium: 0.6, hard: 0.2 } },
      });
    }

    const totalMarks = sections.reduce((sum, s) => sum + (s.answerCount ?? s.count) * s.marksEach, 0);

    await MockExam.findOneAndUpdate(
      { code: `MOCK-${subject.code}` },
      {
        exam: exam._id,
        subject: subject._id,
        code: `MOCK-${subject.code}`,
        title: `${subject.name} — Mock Examination`,
        description: `A full timed paper in the format of the ${subject.paper || subject.name} examination.`,
        instructions:
          'Answer all questions in Section A.' +
          (sections.length > 1 ? ` Answer ${numberWord(sections[1].answerCount)} questions in Section B.` : '') +
          ' The timer runs from the moment you begin and the paper submits itself when time runs out.',
        kind: 'dynamic',
        durationMinutes: blueprint.durationMinutes,
        totalMarks,
        passMark: blueprint.passMark,
        sections,
        sourceKind: SOURCE_KIND.MANUAL_DERIVED,
        status: CONTENT_STATUS.PUBLISHED,
        order: subject.order,
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }

  logger.info(`Mock examinations ready for ${subjects.length} papers`);
}

function numberWord(n) {
  return ['zero', 'one', 'two', 'three', 'four', 'five', 'six'][n] || String(n);
}

async function ensureAdmin(exam) {
  const email = env.SEED_ADMIN_EMAIL;
  const existing = await User.findOne({ email });
  if (existing) {
    logger.info(`Administrator already exists: ${email}`);
    return;
  }

  const password = env.SEED_ADMIN_PASSWORD;
  if (!password) {
    logger.warn(
      'No SEED_ADMIN_PASSWORD is set, so no administrator was created.\n' +
        '  Create one interactively with: npm run create:admin',
    );
    return;
  }

  const admin = new User({ name: 'Administrator', email, role: 'admin', examStage: exam._id, onboardedAt: new Date() });
  await admin.setPassword(password);
  await admin.save();
  logger.info(`Administrator created: ${email}`);
}

async function refreshFlashcardCounts() {
  const topics = await Topic.find().select('_id').lean();
  for (const topic of topics) {
    await Topic.updateOne(
      { _id: topic._id },
      { 'stats.flashcardCount': await Flashcard.countDocuments({ topic: topic._id, status: CONTENT_STATUS.PUBLISHED }) },
    );
  }
}

async function summarise() {
  const [subjects, chapters, topics, questions, published, flashcards, mocks] = await Promise.all([
    Subject.countDocuments(),
    mongoose.model('Chapter').countDocuments(),
    Topic.countDocuments(),
    Question.countDocuments(),
    Question.countDocuments({ status: CONTENT_STATUS.PUBLISHED }),
    Flashcard.countDocuments(),
    MockExam.countDocuments(),
  ]);
  logger.info(
    `Database now holds: ${subjects} subjects · ${chapters} chapters · ${topics} topics · ` +
      `${questions} questions (${published} published) · ${flashcards} flashcards · ${mocks} mock exams`,
  );
}

seed().catch(async (err) => {
  logger.error('Seeding failed', err);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
