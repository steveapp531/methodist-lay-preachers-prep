import mongoose from 'mongoose';

const { Schema } = mongoose;

const answerSchema = new Schema(
  {
    question: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
    sectionKey: { type: String, required: true },
    order: { type: Number, required: true },

    selectedOptionKeys: { type: [String], default: [] },
    textAnswer: { type: String, default: '' },
    matchAnswer: { type: Map, of: String, default: undefined },
    viaVoice: { type: Boolean, default: false },

    flagged: { type: Boolean, default: false },
    answered: { type: Boolean, default: false },
    timeSpentSeconds: { type: Number, default: 0 },

    isCorrect: { type: Boolean, default: null },
    score: { type: Number, default: 0 },
    marksAwarded: { type: Number, default: 0 },
    marksAvailable: { type: Number, default: 0 },
    theoryEvaluation: { type: Schema.Types.ObjectId, ref: 'TheoryEvaluation', default: null },
    /** Theory answers a candidate chose not to attempt are excluded from marks. */
    counted: { type: Boolean, default: true },
  },
  { _id: false },
);

const topicBreakdownSchema = new Schema(
  {
    topic: { type: Schema.Types.ObjectId, ref: 'Topic' },
    topicTitle: String,
    subjectName: String,
    attempted: Number,
    correct: Number,
    accuracy: Number,
  },
  { _id: false },
);

const examAttemptSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    exam: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    mockExam: { type: Schema.Types.ObjectId, ref: 'MockExam', required: true, index: true },
    subject: { type: Schema.Types.ObjectId, ref: 'Subject', default: null, index: true },

    title: { type: String, default: '' },
    durationMinutes: { type: Number, required: true },
    startedAt: { type: Date, default: Date.now, index: true },
    /** Hard deadline computed at start; the server, not the client, decides. */
    expiresAt: { type: Date, required: true },
    submittedAt: { type: Date, default: null },
    autoSubmitted: { type: Boolean, default: false },

    status: { type: String, enum: ['in_progress', 'submitted', 'marked', 'expired'], default: 'in_progress', index: true },

    answers: { type: [answerSchema], default: [] },

    objectiveMarks: { type: Number, default: 0 },
    objectiveAvailable: { type: Number, default: 0 },
    theoryMarks: { type: Number, default: 0 },
    theoryAvailable: { type: Number, default: 0 },
    totalMarks: { type: Number, default: 0 },
    totalAvailable: { type: Number, default: 0 },
    percentage: { type: Number, default: 0, index: true },
    passed: { type: Boolean, default: false },

    questionsAttempted: { type: Number, default: 0 },
    questionsCorrect: { type: Number, default: 0 },
    questionsIncorrect: { type: Number, default: 0 },
    timeTakenSeconds: { type: Number, default: 0 },

    topicBreakdown: { type: [topicBreakdownSchema], default: [] },
    strongTopics: { type: [String], default: [] },
    weakTopics: { type: [String], default: [] },

    readinessScore: { type: Number, default: 0 },
    readinessBand: { type: String, default: '' },
    /** True while theory answers are still being marked. */
    theoryPending: { type: Boolean, default: false },
  },
  { timestamps: true },
);

examAttemptSchema.index({ user: 1, createdAt: -1 });
examAttemptSchema.index({ user: 1, status: 1 });

export const ExamAttempt = mongoose.model('ExamAttempt', examAttemptSchema);
export default ExamAttempt;
