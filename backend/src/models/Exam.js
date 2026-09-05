import mongoose from 'mongoose';
import { QUESTION_TYPES } from '../../../shared/constants.js';

const { Schema } = mongoose;

/**
 * An examination stage — for example "Lay Preachers Examination Part 2".
 *
 * The platform is deliberately not built around a single examination. Adding
 * another Methodist Church Ghana examination, or an entirely different training
 * programme, means inserting another Exam document and attaching subjects to
 * it; no application code changes.
 */
const examSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    shortName: { type: String, trim: true, default: '' },
    programme: { type: String, trim: true, default: "Connexional Lay Preachers' Examination" },
    awardingBody: { type: String, trim: true, default: 'The Methodist Church Ghana' },
    description: { type: String, default: '' },
    order: { type: Number, default: 0 },

    /** Which question types this stage examines. Part 1 is objective only. */
    supportedQuestionTypes: {
      type: [{ type: String, enum: Object.values(QUESTION_TYPES) }],
      default: () => Object.values(QUESTION_TYPES),
    },
    hasTheoryPaper: { type: Boolean, default: true },

    /** Default shape of a paper in this stage, used to generate mock exams. */
    paperBlueprint: {
      durationMinutes: { type: Number, default: 120 },
      objectiveCount: { type: Number, default: 25 },
      objectiveMarksEach: { type: Number, default: 1 },
      theoryQuestionsOffered: { type: Number, default: 5 },
      theoryQuestionsToAnswer: { type: Number, default: 3 },
      theoryMarksEach: { type: Number, default: 25 },
      passMark: { type: Number, default: 50 },
    },

    /** Configurable thresholds behind the readiness indicator. */
    readinessWeights: {
      objectiveAccuracy: { type: Number, default: 0.4 },
      syllabusCoverage: { type: Number, default: 0.25 },
      mockPerformance: { type: Number, default: 0.25 },
      consistency: { type: Number, default: 0.1 },
    },

    isPublished: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

examSchema.virtual('subjects', {
  ref: 'Subject',
  localField: '_id',
  foreignField: 'exam',
});

export const Exam = mongoose.model('Exam', examSchema);
export default Exam;
