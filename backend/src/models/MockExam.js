import mongoose from 'mongoose';
import { CONTENT_STATUS, SOURCE_KIND } from '../../../shared/constants.js';

const { Schema } = mongoose;

/**
 * A mock examination blueprint.
 *
 * Two flavours:
 *  - `fixed`   — an explicit list of questions, used to reproduce a real past
 *                paper exactly as it was sat.
 *  - `dynamic` — a specification the engine samples against at start time, so
 *                the same mock can be retaken with fresh questions.
 */
const sectionSchema = new Schema(
  {
    key: { type: String, required: true }, // "A", "B"
    label: { type: String, required: true }, // "Section A — Objective"
    instructions: { type: String, default: '' },
    questionTypes: { type: [String], default: [] },
    /** How many questions the section presents. */
    count: { type: Number, required: true, min: 1 },
    /** How many the candidate must answer (theory sections offer a choice). */
    answerCount: { type: Number, default: null },
    marksEach: { type: Number, default: 1 },
    /** Fixed sections carry their questions here. */
    questions: [{ type: Schema.Types.ObjectId, ref: 'Question' }],
    /** Dynamic sections sample within these bounds. */
    sampling: {
      subject: { type: Schema.Types.ObjectId, ref: 'Subject', default: null },
      chapters: [{ type: Schema.Types.ObjectId, ref: 'Chapter' }],
      topics: [{ type: Schema.Types.ObjectId, ref: 'Topic' }],
      difficultyMix: {
        easy: { type: Number, default: 0.3 },
        medium: { type: Number, default: 0.5 },
        hard: { type: Number, default: 0.2 },
      },
    },
  },
  { _id: false },
);

const mockExamSchema = new Schema(
  {
    exam: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    subject: { type: Schema.Types.ObjectId, ref: 'Subject', default: null, index: true },

    code: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    instructions: { type: String, default: '' },

    kind: { type: String, enum: ['fixed', 'dynamic'], default: 'dynamic', index: true },
    durationMinutes: { type: Number, required: true, min: 5 },
    totalMarks: { type: Number, default: 0 },
    passMark: { type: Number, default: 50 },

    sections: { type: [sectionSchema], default: [] },

    sourceKind: { type: String, enum: Object.values(SOURCE_KIND), default: SOURCE_KIND.MANUAL_DERIVED },
    source: {
      label: { type: String, default: '' },
      year: { type: Number, default: null },
      sitting: { type: String, default: '' },
    },

    status: { type: String, enum: Object.values(CONTENT_STATUS), default: CONTENT_STATUS.PUBLISHED, index: true },
    order: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

mockExamSchema.index({ exam: 1, status: 1, order: 1 });

export const MockExam = mongoose.model('MockExam', mockExamSchema);
export default MockExam;
