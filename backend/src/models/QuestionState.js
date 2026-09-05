import mongoose from 'mongoose';
import { LEITNER_INTERVALS } from '../../../shared/constants.js';

const { Schema } = mongoose;

/**
 * Per-user, per-question memory state driving spaced revision.
 *
 * A Leitner box scheme: a correct answer promotes the question one box and
 * pushes its next due date further out; an incorrect answer demotes it to box 0
 * so it comes back tomorrow. `revisionPriority` blends recency, error rate and
 * lateness into a single number the scheduler sorts by.
 */
const questionStateSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    question: { type: Schema.Types.ObjectId, ref: 'Question', required: true, index: true },
    exam: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    topic: { type: Schema.Types.ObjectId, ref: 'Topic', default: null, index: true },

    attempts: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    incorrect: { type: Number, default: 0 },
    consecutiveCorrect: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 },
    averageSeconds: { type: Number, default: 0 },

    box: { type: Number, default: 0, min: 0, max: LEITNER_INTERVALS.length - 1 },
    dueAt: { type: Date, default: () => new Date(), index: true },
    lastAttemptedAt: { type: Date, default: null },
    lastCorrectAt: { type: Date, default: null },

    /** Higher means "show this sooner". Recomputed on every attempt. */
    revisionPriority: { type: Number, default: 0, index: true },
    /** Self-reported confidence from flashcard review, -1 unset. */
    confidence: { type: Number, default: -1, min: -1, max: 5 },
    isMastered: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

questionStateSchema.index({ user: 1, question: 1 }, { unique: true });
questionStateSchema.index({ user: 1, dueAt: 1 });
questionStateSchema.index({ user: 1, revisionPriority: -1 });

export const QuestionState = mongoose.model('QuestionState', questionStateSchema);
export default QuestionState;
