import mongoose from 'mongoose';
import { PROGRESS_STATUS } from '../../../shared/constants.js';

const { Schema } = mongoose;

/**
 * Topic-level progress: the candidate's own status marker plus the measured
 * mastery derived from their answers. The two are kept separate on purpose —
 * "I have read this" is not the same claim as "I can answer questions on it".
 */
const studyProgressSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    exam: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    chapter: { type: Schema.Types.ObjectId, ref: 'Chapter', required: true, index: true },
    topic: { type: Schema.Types.ObjectId, ref: 'Topic', required: true, index: true },

    status: { type: String, enum: Object.values(PROGRESS_STATUS), default: PROGRESS_STATUS.NOT_STARTED, index: true },

    attempts: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 },
    /** 0..100. Blends accuracy with how much of the topic has been attempted. */
    mastery: { type: Number, default: 0, index: true },
    revisionPriority: { type: Number, default: 0, index: true },

    studySeconds: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    lastStudiedAt: { type: Date, default: null },
    lastAttemptedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

studyProgressSchema.index({ user: 1, topic: 1 }, { unique: true });
studyProgressSchema.index({ user: 1, subject: 1, mastery: 1 });

export const StudyProgress = mongoose.model('StudyProgress', studyProgressSchema);
export default StudyProgress;
