import mongoose from 'mongoose';
import {
  ANSWER_CONFIDENCE,
  CONTENT_STATUS,
  DIFFICULTIES,
  OBJECTIVE_TYPES,
  QUESTION_TYPES,
  SOURCE_KIND,
} from '../../../shared/constants.js';
import { scriptureRefSchema } from './Topic.js';

const { Schema } = mongoose;

const optionSchema = new Schema(
  {
    key: { type: String, required: true, trim: true }, // "A", "B", "C", "D"
    text: { type: String, required: true, trim: true },
    isCorrect: { type: Boolean, default: false },
    rationale: { type: String, default: '' }, // Why this distractor is wrong
  },
  { _id: false },
);

const matchPairSchema = new Schema(
  { left: { type: String, required: true }, right: { type: String, required: true } },
  { _id: false },
);

/**
 * Where the answer comes from. Every question carries one, and the interface
 * always shows it, so a candidate can check the platform against the syllabus.
 */
const manualReferenceSchema = new Schema(
  {
    subjectName: { type: String, default: '' },
    chapterTitle: { type: String, default: '' },
    topicTitle: { type: String, default: '' },
    /** Paragraph index in the source document. */
    anchor: { type: Number, default: null },
    pageNumber: { type: Number, default: null },
    /** A short verbatim excerpt from the syllabus that supports the answer. */
    excerpt: { type: String, default: '' },
    citation: { type: String, default: '' },
  },
  { _id: false },
);

/** Marking criteria for a theory question. */
const rubricCriterionSchema = new Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true }, // e.g. "Definition"
    description: { type: String, default: '' },
    marks: { type: Number, required: true, min: 0 },
    /** Terms or ideas a marker looks for. Used by the deterministic scorer. */
    keywords: { type: [String], default: [] },
    /** Any one of these alternative phrasings satisfies the criterion. */
    synonyms: { type: [[String]], default: [] },
    required: { type: Boolean, default: false },
  },
  { _id: false },
);

const questionSchema = new Schema(
  {
    /** Stable public identifier, safe to reference from imports and exports. */
    questionId: { type: String, required: true, unique: true, index: true },

    exam: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    chapter: { type: Schema.Types.ObjectId, ref: 'Chapter', default: null, index: true },
    topic: { type: Schema.Types.ObjectId, ref: 'Topic', default: null, index: true },

    type: { type: String, enum: Object.values(QUESTION_TYPES), required: true, index: true },
    prompt: { type: String, required: true, trim: true },
    /** Extra context printed above the question, e.g. a passage or a stem. */
    context: { type: String, default: '' },

    // ---- Objective ----
    options: { type: [optionSchema], default: [] },
    /** Option keys. One entry for single-answer types, several for multiple response. */
    correctOptionKeys: { type: [String], default: [] },
    /** Accepted strings for fill-in-the-blank, compared case- and punctuation-insensitively. */
    acceptedAnswers: { type: [String], default: [] },
    matchPairs: { type: [matchPairSchema], default: [] },

    // ---- Theory ----
    idealAnswer: { type: String, default: '' },
    keyPoints: { type: [String], default: [] },
    markingRubric: { type: [rubricCriterionSchema], default: [] },
    marks: { type: Number, default: 1, min: 0 },
    suggestedMinutes: { type: Number, default: null },

    // ---- Teaching ----
    explanation: { type: String, default: '' },
    manualReference: { type: manualReferenceSchema, default: () => ({}) },
    scriptureReferences: { type: [scriptureRefSchema], default: [] },

    // ---- Classification ----
    difficulty: { type: String, enum: Object.values(DIFFICULTIES), default: DIFFICULTIES.MEDIUM, index: true },
    tags: { type: [String], default: [], index: true },

    // ---- Provenance ----
    sourceKind: { type: String, enum: Object.values(SOURCE_KIND), required: true, index: true },
    source: {
      label: { type: String, default: '' }, // "Doctrine Part II — September 2025"
      paperCode: { type: String, default: '' },
      year: { type: Number, default: null, index: true },
      sitting: { type: String, default: '' },
      sectionLabel: { type: String, default: '' }, // "Section A", "Section B"
      questionNumber: { type: String, default: '' },
    },
    /**
     * How well the stored answer is supported. Questions that could not be
     * grounded in the syllabus are surfaced to administrators rather than
     * being presented to candidates as fact.
     */
    answerConfidence: {
      type: String,
      enum: Object.values(ANSWER_CONFIDENCE),
      default: ANSWER_CONFIDENCE.UNVERIFIED,
      index: true,
    },
    reviewNotes: { type: String, default: '' },

    status: { type: String, enum: Object.values(CONTENT_STATUS), default: CONTENT_STATUS.DRAFT, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    /** Aggregate difficulty observed in practice, refreshed as attempts arrive. */
    stats: {
      attempts: { type: Number, default: 0 },
      correct: { type: Number, default: 0 },
      accuracy: { type: Number, default: 0 },
      averageSeconds: { type: Number, default: 0 },
      lastAttemptedAt: { type: Date, default: null },
    },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

questionSchema.index({ exam: 1, subject: 1, status: 1, type: 1 });
questionSchema.index({ topic: 1, status: 1 });
questionSchema.index({ prompt: 'text', explanation: 'text', tags: 'text' });

questionSchema.virtual('isObjective').get(function isObjective() {
  return OBJECTIVE_TYPES.includes(this.type);
});

questionSchema.virtual('totalMarks').get(function totalMarks() {
  if (this.type !== QUESTION_TYPES.THEORY) return this.marks || 1;
  if (this.markingRubric?.length) {
    return this.markingRubric.reduce((sum, c) => sum + c.marks, 0);
  }
  return this.marks || 0;
});

/**
 * The candidate-facing shape. Correct answers, rationales and rubrics are
 * stripped so they can never leak to the client before submission.
 */
questionSchema.methods.toCandidateJSON = function toCandidateJSON() {
  return {
    id: String(this._id),
    questionId: this.questionId,
    type: this.type,
    prompt: this.prompt,
    context: this.context,
    options: (this.options || []).map((o) => ({ key: o.key, text: o.text })),
    matchPairs: (this.matchPairs || []).map((p) => ({ left: p.left })),
    matchOptions: shuffleStable((this.matchPairs || []).map((p) => p.right), this.questionId),
    marks: this.totalMarks,
    suggestedMinutes: this.suggestedMinutes,
    difficulty: this.difficulty,
    tags: this.tags,
    sourceKind: this.sourceKind,
    source: this.source,
    subject: this.subject,
    chapter: this.chapter,
    topic: this.topic,
    // Rubric criteria labels are safe to show as "what a good answer covers"
    // only after marking, so they are omitted here.
  };
};

/** The full teaching payload, returned only after an answer is submitted. */
questionSchema.methods.toReviewJSON = function toReviewJSON() {
  return {
    id: String(this._id),
    questionId: this.questionId,
    type: this.type,
    prompt: this.prompt,
    context: this.context,
    options: this.options,
    correctOptionKeys: this.correctOptionKeys,
    acceptedAnswers: this.acceptedAnswers,
    matchPairs: this.matchPairs,
    idealAnswer: this.idealAnswer,
    keyPoints: this.keyPoints,
    markingRubric: this.markingRubric,
    marks: this.totalMarks,
    explanation: this.explanation,
    manualReference: this.manualReference,
    scriptureReferences: this.scriptureReferences,
    difficulty: this.difficulty,
    tags: this.tags,
    sourceKind: this.sourceKind,
    source: this.source,
    answerConfidence: this.answerConfidence,
    subject: this.subject,
    chapter: this.chapter,
    topic: this.topic,
  };
};

/** Deterministic shuffle so matching options are stable across renders. */
function shuffleStable(items, seedString) {
  const arr = [...items];
  let seed = 0;
  for (let i = 0; i < String(seedString).length; i += 1) {
    seed = (seed * 31 + String(seedString).charCodeAt(i)) >>> 0;
  }
  for (let i = arr.length - 1; i > 0; i -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const Question = mongoose.model('Question', questionSchema);
export default Question;
