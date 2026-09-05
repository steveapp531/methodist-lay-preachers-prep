import mongoose from 'mongoose';
import { SESSION_MODES } from '../../../shared/constants.js';

const { Schema } = mongoose;

/**
 * A practice session: a generated set of questions plus the running result.
 * Distinct from ExamAttempt, which is timed and formally scored.
 */
const quizSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    exam: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    mode: { type: String, enum: Object.values(SESSION_MODES), default: SESSION_MODES.PRACTICE, index: true },

    filters: {
      subject: { type: Schema.Types.ObjectId, ref: 'Subject', default: null },
      chapter: { type: Schema.Types.ObjectId, ref: 'Chapter', default: null },
      topic: { type: Schema.Types.ObjectId, ref: 'Topic', default: null },
      difficulty: { type: String, default: null },
      questionTypes: { type: [String], default: [] },
      includeTheory: { type: Boolean, default: false },
    },

    questions: [{ type: Schema.Types.ObjectId, ref: 'Question' }],
    /** Index of the next unanswered question. */
    cursor: { type: Number, default: 0 },

    answeredCount: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    marksAwarded: { type: Number, default: 0 },
    marksAvailable: { type: Number, default: 0 },

    status: { type: String, enum: ['in_progress', 'completed', 'abandoned'], default: 'in_progress', index: true },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    timeSpentSeconds: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

quizSchema.index({ user: 1, createdAt: -1 });

quizSchema.virtual('accuracy').get(function accuracy() {
  return this.answeredCount ? this.correctCount / this.answeredCount : 0;
});

export const Quiz = mongoose.model('Quiz', quizSchema);
export default Quiz;
