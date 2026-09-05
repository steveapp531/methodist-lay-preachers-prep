import { z } from 'zod';
import {
  ANSWER_CONFIDENCE,
  CONTENT_STATUS,
  DIFFICULTIES,
  PROGRESS_STATUS,
  QUESTION_TYPES,
  SESSION_MODES,
  SOURCE_KIND,
} from '../../../shared/constants.js';

export const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'That identifier is not valid');
const optionalId = objectId.optional().nullable();

const intFromQuery = (min, max, fallback) =>
  z.coerce.number().int().min(min).max(max).optional().default(fallback);

const boolFromQuery = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === true || v === 'true' || v === '1'));

/* ------------------------------------------------------------------ auth --- */

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your full name').max(120),
  email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Use at least 8 characters')
    .max(200)
    .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), 'Include at least one letter and one number'),
  examStage: optionalId,
  diocese: z.string().trim().max(120).optional().default(''),
  circuit: z.string().trim().max(120).optional().default(''),
  society: z.string().trim().max(120).optional().default(''),
  timezone: z.string().trim().max(60).optional().default('Africa/Accra'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
  password: z.string().min(1, 'Please enter your password'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20, 'That reset link is not valid'),
  password: z
    .string()
    .min(8, 'Use at least 8 characters')
    .max(200)
    .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), 'Include at least one letter and one number'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Please enter your current password'),
  newPassword: z
    .string()
    .min(8, 'Use at least 8 characters')
    .max(200)
    .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), 'Include at least one letter and one number'),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  examStage: optionalId,
  examDate: z.union([z.coerce.date(), z.null()]).optional(),
  diocese: z.string().trim().max(120).optional(),
  circuit: z.string().trim().max(120).optional(),
  society: z.string().trim().max(120).optional(),
  timezone: z.string().trim().max(60).optional(),
  preferences: z
    .object({
      dailyQuestionGoal: z.coerce.number().int().min(5).max(200).optional(),
      dailyStudyMinutesGoal: z.coerce.number().int().min(5).max(480).optional(),
      voiceAnswersEnabled: z.boolean().optional(),
      soundEffectsEnabled: z.boolean().optional(),
      reducedMotion: z.boolean().optional(),
      preferredBibleTranslation: z.string().trim().max(60).optional(),
    })
    .optional(),
});

/* --------------------------------------------------------------- content --- */

export const listContentQuery = z.object({
  exam: optionalId,
  subject: optionalId,
  chapter: optionalId,
  topic: optionalId,
  page: intFromQuery(1, 10000, 1),
  limit: intFromQuery(1, 100, 20),
  search: z.string().trim().max(200).optional(),
  status: z.nativeEnum(CONTENT_STATUS).optional(),
  type: z.nativeEnum(QUESTION_TYPES).optional(),
  difficulty: z.nativeEnum(DIFFICULTIES).optional(),
  sourceKind: z.nativeEnum(SOURCE_KIND).optional(),
  answerConfidence: z.nativeEnum(ANSWER_CONFIDENCE).optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  sort: z.string().trim().max(60).optional(),
});

export const idParam = z.object({ id: objectId });

/* ----------------------------------------------------------------- study --- */

export const topicProgressSchema = z.object({
  status: z.nativeEnum(PROGRESS_STATUS).optional(),
  studySeconds: z.coerce.number().int().min(0).max(3600).optional(),
});

/* ------------------------------------------------------------------ quiz --- */

const answerPayload = z.object({
  selectedOptionKeys: z.array(z.string().trim().max(10)).max(12).optional().default([]),
  textAnswer: z.string().max(20000).optional().default(''),
  matchAnswer: z.record(z.string(), z.string().max(500)).optional(),
  viaVoice: z.boolean().optional().default(false),
  timeSpentSeconds: z.coerce.number().int().min(0).max(7200).optional().default(0),
});

export const createQuizSchema = z.object({
  mode: z.nativeEnum(SESSION_MODES).optional().default(SESSION_MODES.PRACTICE),
  subject: optionalId,
  chapter: optionalId,
  topic: optionalId,
  difficulty: z.nativeEnum(DIFFICULTIES).optional().nullable(),
  size: z.coerce.number().int().min(1).max(100).optional().default(10),
  includeTheory: z.boolean().optional().default(false),
  questionTypes: z.array(z.nativeEnum(QUESTION_TYPES)).max(6).optional(),
});

export const answerQuestionSchema = answerPayload.extend({
  quiz: optionalId,
  mode: z.nativeEnum(SESSION_MODES).optional().default(SESSION_MODES.PRACTICE),
});

/* ------------------------------------------------------------- mock exam --- */

export const startMockSchema = z.object({ mockExam: objectId });

export const saveMockProgressSchema = z.object({
  updates: z
    .array(
      z.object({
        questionId: objectId,
        selectedOptionKeys: z.array(z.string().trim().max(10)).max(12).optional(),
        textAnswer: z.string().max(20000).optional(),
        matchAnswer: z.record(z.string(), z.string().max(500)).optional(),
        flagged: z.boolean().optional(),
        viaVoice: z.boolean().optional(),
        timeSpentSeconds: z.coerce.number().int().min(0).max(7200).optional(),
      }),
    )
    .max(200),
});

/* --------------------------------------------------------------- library --- */

export const createBookmarkSchema = z
  .object({
    targetType: z.enum(['question', 'topic', 'flashcard', 'scripture']),
    question: optionalId,
    topic: optionalId,
    flashcard: optionalId,
    scriptureReference: z.string().trim().max(120).optional().nullable(),
    label: z.string().trim().max(200).optional().default(''),
  })
  .refine((v) => Boolean(v[v.targetType === 'scripture' ? 'scriptureReference' : v.targetType]), {
    message: 'A bookmark needs something to point at',
  });

export const createNoteSchema = z.object({
  targetType: z.enum(['topic', 'question', 'chapter', 'flashcard', 'general']),
  topic: optionalId,
  chapter: optionalId,
  question: optionalId,
  flashcard: optionalId,
  title: z.string().trim().max(200).optional().default(''),
  body: z.string().trim().min(1, 'A note needs some text').max(20000),
  tags: z.array(z.string().trim().max(40)).max(12).optional().default([]),
  colour: z.string().trim().max(20).optional().default(''),
  pinned: z.boolean().optional().default(false),
});

export const updateNoteSchema = createNoteSchema.partial().extend({
  body: z.string().trim().min(1).max(20000).optional(),
});

export const reviewFlashcardSchema = z.object({
  outcome: z.enum(['known', 'needs_revision']),
});

/* ---------------------------------------------------------------- search --- */

export const searchQuery = z.object({
  q: z.string().trim().min(2, 'Type at least two characters').max(200),
  types: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v === undefined ? undefined : (Array.isArray(v) ? v : v.split(',')).map((s) => s.trim()))),
  limit: intFromQuery(1, 20, 5),
});

/* ----------------------------------------------------------------- admin --- */

const rubricCriterion = z.object({
  id: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1).max(200),
  description: z.string().max(1000).optional().default(''),
  marks: z.coerce.number().min(0).max(100),
  keywords: z.array(z.string().trim().max(80)).max(40).optional().default([]),
  synonyms: z.array(z.array(z.string().trim().max(80)).max(12)).max(40).optional().default([]),
  required: z.boolean().optional().default(false),
});

const scriptureRef = z.object({
  book: z.string().trim().min(1).max(40),
  chapter: z.coerce.number().int().min(1).max(200),
  verses: z.string().trim().max(40).optional().nullable(),
  reference: z.string().trim().min(1).max(120),
  note: z.string().max(500).optional().default(''),
});

export const adminQuestionSchema = z.object({
  questionId: z.string().trim().max(80).optional(),
  exam: objectId,
  subject: objectId,
  chapter: optionalId,
  topic: optionalId,
  type: z.nativeEnum(QUESTION_TYPES),
  prompt: z.string().trim().min(3).max(4000),
  context: z.string().max(4000).optional().default(''),
  options: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(6),
        text: z.string().trim().min(1).max(1000),
        isCorrect: z.boolean().optional().default(false),
        rationale: z.string().max(1000).optional().default(''),
      }),
    )
    .max(12)
    .optional()
    .default([]),
  correctOptionKeys: z.array(z.string().trim().max(6)).max(12).optional().default([]),
  acceptedAnswers: z.array(z.string().trim().max(300)).max(20).optional().default([]),
  matchPairs: z.array(z.object({ left: z.string().max(300), right: z.string().max(300) })).max(20).optional().default([]),
  idealAnswer: z.string().max(20000).optional().default(''),
  keyPoints: z.array(z.string().trim().max(500)).max(30).optional().default([]),
  markingRubric: z.array(rubricCriterion).max(20).optional().default([]),
  marks: z.coerce.number().min(0).max(200).optional().default(1),
  suggestedMinutes: z.coerce.number().min(0).max(180).optional().nullable(),
  explanation: z.string().max(8000).optional().default(''),
  manualReference: z
    .object({
      subjectName: z.string().max(200).optional().default(''),
      chapterTitle: z.string().max(300).optional().default(''),
      topicTitle: z.string().max(300).optional().default(''),
      anchor: z.coerce.number().int().optional().nullable(),
      pageNumber: z.coerce.number().int().optional().nullable(),
      excerpt: z.string().max(4000).optional().default(''),
      citation: z.string().max(500).optional().default(''),
    })
    .optional(),
  scriptureReferences: z.array(scriptureRef).max(20).optional().default([]),
  difficulty: z.nativeEnum(DIFFICULTIES).optional().default(DIFFICULTIES.MEDIUM),
  tags: z.array(z.string().trim().max(60)).max(20).optional().default([]),
  sourceKind: z.nativeEnum(SOURCE_KIND),
  source: z
    .object({
      label: z.string().max(300).optional().default(''),
      paperCode: z.string().max(60).optional().default(''),
      year: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
      sitting: z.string().max(60).optional().default(''),
      sectionLabel: z.string().max(60).optional().default(''),
      questionNumber: z.string().max(20).optional().default(''),
    })
    .optional(),
  answerConfidence: z.nativeEnum(ANSWER_CONFIDENCE).optional(),
  reviewNotes: z.string().max(2000).optional().default(''),
  status: z.nativeEnum(CONTENT_STATUS).optional().default(CONTENT_STATUS.DRAFT),
});

export const adminQuestionUpdateSchema = adminQuestionSchema.partial().omit({ exam: true });

export const adminStatusSchema = z.object({ status: z.nativeEnum(CONTENT_STATUS) });

export const adminSubjectSchema = z.object({
  exam: objectId,
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(2).max(200),
  shortName: z.string().trim().max(80).optional().default(''),
  paper: z.string().trim().max(200).optional().default(''),
  description: z.string().max(2000).optional().default(''),
  order: z.coerce.number().int().min(0).max(999).optional().default(0),
  colour: z.string().trim().max(30).optional().default('brand'),
  isPublished: z.boolean().optional().default(true),
});

export const adminTopicSchema = z.object({
  exam: objectId,
  subject: objectId,
  chapter: objectId,
  number: z.string().trim().max(20).optional().nullable(),
  title: z.string().trim().min(2).max(300),
  summary: z.string().max(8000).optional().default(''),
  keyPoints: z.array(z.string().trim().max(500)).max(40).optional().default([]),
  keyTerms: z
    .array(z.object({ term: z.string().trim().max(200), definition: z.string().trim().max(2000) }))
    .max(60)
    .optional()
    .default([]),
  examFocus: z.array(z.string().trim().max(300)).max(20).optional().default([]),
  blocks: z
    .array(z.object({ anchor: z.coerce.number().int(), text: z.string().max(20000), kind: z.string().max(20).optional() }))
    .max(500)
    .optional(),
  scriptureReferences: z.array(scriptureRef).max(80).optional(),
  order: z.coerce.number().int().min(0).max(9999).optional().default(0),
  isPublished: z.boolean().optional().default(true),
});

export const adminMockExamSchema = z.object({
  exam: objectId,
  subject: optionalId,
  code: z.string().trim().min(2).max(60),
  title: z.string().trim().min(2).max(200),
  description: z.string().max(2000).optional().default(''),
  instructions: z.string().max(4000).optional().default(''),
  kind: z.enum(['fixed', 'dynamic']).optional().default('dynamic'),
  durationMinutes: z.coerce.number().int().min(5).max(360),
  passMark: z.coerce.number().min(0).max(100).optional().default(50),
  sections: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(10),
        label: z.string().trim().min(1).max(200),
        instructions: z.string().max(2000).optional().default(''),
        questionTypes: z.array(z.nativeEnum(QUESTION_TYPES)).max(6).optional().default([]),
        count: z.coerce.number().int().min(1).max(200),
        answerCount: z.coerce.number().int().min(1).max(200).optional().nullable(),
        marksEach: z.coerce.number().min(0).max(100).optional().default(1),
        questions: z.array(objectId).max(200).optional().default([]),
        sampling: z
          .object({
            subject: optionalId,
            chapters: z.array(objectId).max(60).optional().default([]),
            topics: z.array(objectId).max(200).optional().default([]),
            difficultyMix: z
              .object({
                easy: z.coerce.number().min(0).max(1).optional().default(0.3),
                medium: z.coerce.number().min(0).max(1).optional().default(0.5),
                hard: z.coerce.number().min(0).max(1).optional().default(0.2),
              })
              .optional(),
          })
          .optional(),
      }),
    )
    .min(1)
    .max(10),
  status: z.nativeEnum(CONTENT_STATUS).optional().default(CONTENT_STATUS.PUBLISHED),
  order: z.coerce.number().int().min(0).max(999).optional().default(0),
});

export const adminUserQuery = z.object({
  page: intFromQuery(1, 10000, 1),
  limit: intFromQuery(1, 100, 20),
  search: z.string().trim().max(200).optional(),
  exam: optionalId,
  role: z.enum(['student', 'admin']).optional(),
  active: boolFromQuery,
});

export const importSchema = z.object({
  dryRun: z.boolean().optional().default(false),
  defaultStatus: z.nativeEnum(CONTENT_STATUS).optional().default(CONTENT_STATUS.DRAFT),
  questions: z.array(z.record(z.string(), z.any())).max(5000),
});
