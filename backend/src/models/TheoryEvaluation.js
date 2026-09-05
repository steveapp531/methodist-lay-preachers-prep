import mongoose from 'mongoose';

const { Schema } = mongoose;

const criterionResultSchema = new Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    marksAvailable: { type: Number, required: true },
    marksAwarded: { type: Number, required: true },
    /** covered | partial | missing */
    verdict: { type: String, enum: ['covered', 'partial', 'missing'], required: true },
    /** Evidence quoted from the candidate's own answer. */
    evidence: { type: String, default: '' },
    guidance: { type: String, default: '' },
  },
  { _id: false },
);

/**
 * The result of marking one theory answer.
 *
 * Marking is always anchored to the question's stored rubric and ideal answer.
 * When an AI grader is configured it is asked to judge coverage of those same
 * criteria; it is never asked to decide Methodist doctrine, and if it cannot
 * ground a judgement the evaluation is returned as inconclusive rather than
 * guessed.
 */
const theoryEvaluationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    question: { type: Schema.Types.ObjectId, ref: 'Question', required: true, index: true },
    examAttempt: { type: Schema.Types.ObjectId, ref: 'ExamAttempt', default: null, index: true },
    quiz: { type: Schema.Types.ObjectId, ref: 'Quiz', default: null, index: true },

    answerText: { type: String, required: true },
    viaVoice: { type: Boolean, default: false },
    wordCount: { type: Number, default: 0 },

    marksAwarded: { type: Number, default: 0 },
    marksAvailable: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },

    criteria: { type: [criterionResultSchema], default: [] },
    covered: { type: [String], default: [] },
    partial: { type: [String], default: [] },
    missing: { type: [String], default: [] },

    feedback: { type: String, default: '' },
    suggestedRevisionTopics: [{ type: Schema.Types.ObjectId, ref: 'Topic' }],

    /** rubric | ai | ai_with_rubric_fallback */
    engine: { type: String, default: 'rubric' },
    /** low | medium | high — how much to trust this mark. */
    confidence: { type: String, enum: ['low', 'medium', 'high', 'inconclusive'], default: 'medium' },
    engineNotes: { type: String, default: '' },
    gradedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

theoryEvaluationSchema.index({ user: 1, createdAt: -1 });

export const TheoryEvaluation = mongoose.model('TheoryEvaluation', theoryEvaluationSchema);
export default TheoryEvaluation;
