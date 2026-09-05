/**
 * Vocabulary shared by the API and the web client.
 * Imported by the backend directly and by the frontend through the `@shared` alias.
 */

export const ROLES = Object.freeze({
  STUDENT: 'student',
  ADMIN: 'admin',
});

export const QUESTION_TYPES = Object.freeze({
  MULTIPLE_CHOICE: 'multiple_choice',
  TRUE_FALSE: 'true_false',
  MULTIPLE_RESPONSE: 'multiple_response',
  FILL_BLANK: 'fill_blank',
  MATCHING: 'matching',
  THEORY: 'theory',
});

export const OBJECTIVE_TYPES = Object.freeze([
  QUESTION_TYPES.MULTIPLE_CHOICE,
  QUESTION_TYPES.TRUE_FALSE,
  QUESTION_TYPES.MULTIPLE_RESPONSE,
  QUESTION_TYPES.FILL_BLANK,
  QUESTION_TYPES.MATCHING,
]);

export const DIFFICULTIES = Object.freeze({
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
});

export const DIFFICULTY_ORDER = Object.freeze([DIFFICULTIES.EASY, DIFFICULTIES.MEDIUM, DIFFICULTIES.HARD]);

export const CONTENT_STATUS = Object.freeze({
  DRAFT: 'draft',
  NEEDS_REVIEW: 'needs_review',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
});

/**
 * Provenance. The distinction between official examination material and
 * material authored for practice is deliberately explicit and is surfaced in
 * the interface on every question.
 */
export const SOURCE_KIND = Object.freeze({
  PAST_PAPER: 'past_paper', // Transcribed from an official past examination paper
  MANUAL_DERIVED: 'manual_derived', // Written from the official syllabus, with citation
  DEMO: 'demo', // Illustrative content, never presented as official
});

export const SOURCE_LABELS = Object.freeze({
  [SOURCE_KIND.PAST_PAPER]: 'Official past paper',
  [SOURCE_KIND.MANUAL_DERIVED]: 'From the official syllabus',
  [SOURCE_KIND.DEMO]: 'Demo content',
});

export const ANSWER_CONFIDENCE = Object.freeze({
  VERIFIED: 'verified', // Answer traced to a specific syllabus passage
  PROVISIONAL: 'provisional', // Answer supported but not conclusively located
  UNVERIFIED: 'unverified', // No supporting passage found; needs a human decision
});

export const PROGRESS_STATUS = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  NEEDS_REVISION: 'needs_revision',
});

export const SESSION_MODES = Object.freeze({
  PRACTICE: 'practice',
  TOPIC_QUIZ: 'topic_quiz',
  DAILY_REVISION: 'daily_revision',
  WEAK_AREAS: 'weak_areas',
  MISTAKES: 'mistakes',
  BOOKMARKS: 'bookmarks',
  UNSEEN: 'unseen',
  MOCK_EXAM: 'mock_exam',
});

export const READINESS_BANDS = Object.freeze([
  { key: 'needs_preparation', label: 'Needs Preparation', min: 0, tone: 'danger' },
  { key: 'developing', label: 'Developing', min: 40, tone: 'warning' },
  { key: 'almost_ready', label: 'Almost Ready', min: 60, tone: 'info' },
  { key: 'exam_ready', label: 'Exam Ready', min: 78, tone: 'success' },
]);

/** Mastery thresholds used by progress calculations. */
export const MASTERY = Object.freeze({
  MIN_ATTEMPTS: 4,
  STRONG_ACCURACY: 0.8,
  WEAK_ACCURACY: 0.55,
});

/**
 * Spaced repetition intervals in days, indexed by box. A correct answer moves a
 * question up one box, an incorrect answer sends it back to box 0.
 */
export const LEITNER_INTERVALS = Object.freeze([0, 1, 3, 7, 16, 35]);

export const EXAM_STAGE_CODES = Object.freeze({
  PART1: 'PART1',
  PART2: 'PART2',
});

export const ACHIEVEMENT_CODES = Object.freeze({
  FIRST_QUIZ: 'first_quiz',
  HUNDRED_QUESTIONS: 'hundred_questions',
  STREAK_7: 'streak_7',
  STREAK_30: 'streak_30',
  CHAPTER_MASTERED: 'chapter_mastered',
  MOCK_COMPLETED: 'mock_completed',
  ACCURACY_80: 'accuracy_80',
  EXAM_READY: 'exam_ready',
  THEORY_FIRST: 'theory_first',
  SUBJECT_COMPLETE: 'subject_complete',
});

export const SUBJECT_CODES = Object.freeze(['OT', 'NT', 'DOC', 'LIT', 'MS', 'CS']);

export function readinessBand(score) {
  const value = Number.isFinite(score) ? score : 0;
  let band = READINESS_BANDS[0];
  for (const candidate of READINESS_BANDS) {
    if (value >= candidate.min) band = candidate;
  }
  return band;
}
