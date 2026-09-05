import mongoose from 'mongoose';
import { SESSION_MODES } from '../../../shared/constants.js';

const { Schema } = mongoose;

/**
 * An immutable record of one answer. Everything analytical — accuracy, weak
 * topics, mistake lists, difficulty calibration — is derived from this log, so
 * attempts are never mutated or deleted by normal application flow.
 */
const questionAttemptSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    question: { type: Schema.Types.ObjectId, ref: 'Question', required: true, index: true },
    exam: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    chapter: { type: Schema.Types.ObjectId, ref: 'Chapter', default: null, index: true },
    topic: { type: Schema.Types.ObjectId, ref: 'Topic', default: null, index: true },

    mode: { type: String, enum: Object.values(SESSION_MODES), default: SESSION_MODES.PRACTICE, index: true },
    quiz: { type: Schema.Types.ObjectId, ref: 'Quiz', default: null, index: true },
    examAttempt: { type: Schema.Types.ObjectId, ref: 'ExamAttempt', default: null, index: true },

    questionType: { type: String, required: true },

    /** Raw response, shape depends on question type. */
    selectedOptionKeys: { type: [String], default: [] },
    textAnswer: { type: String, default: '' },
    matchAnswer: { type: Map, of: String, default: undefined },
    /** True when the answer was dictated rather than typed. */
    viaVoice: { type: Boolean, default: false },

    isCorrect: { type: Boolean, default: false, index: true },
    /** Fractional credit, 0..1. Theory answers are usually between the two. */
    score: { type: Number, default: 0 },
    marksAwarded: { type: Number, default: 0 },
    marksAvailable: { type: Number, default: 1 },

    theoryEvaluation: { type: Schema.Types.ObjectId, ref: 'TheoryEvaluation', default: null },

    timeSpentSeconds: { type: Number, default: 0 },
    answeredAt: { type: Date, default: Date.now, index: true },
    /** Local calendar day (YYYY-MM-DD) used for streaks and daily charts. */
    localDate: { type: String, index: true },
  },
  { timestamps: true },
);

questionAttemptSchema.index({ user: 1, answeredAt: -1 });
questionAttemptSchema.index({ user: 1, topic: 1, answeredAt: -1 });
questionAttemptSchema.index({ user: 1, isCorrect: 1, answeredAt: -1 });

export const QuestionAttempt = mongoose.model('QuestionAttempt', questionAttemptSchema);
export default QuestionAttempt;
