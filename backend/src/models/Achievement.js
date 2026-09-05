import mongoose from 'mongoose';
import { ACHIEVEMENT_CODES } from '../../../shared/constants.js';

const { Schema } = mongoose;

/**
 * The catalogue of achievements. Kept deliberately restrained: milestones that
 * mark real study progress, not points for their own sake.
 */
export const ACHIEVEMENT_CATALOGUE = [
  {
    code: ACHIEVEMENT_CODES.FIRST_QUIZ,
    title: 'First Steps',
    description: 'Completed your first practice quiz.',
    icon: 'sprout',
    points: 10,
  },
  {
    code: ACHIEVEMENT_CODES.HUNDRED_QUESTIONS,
    title: 'One Hundred Questions',
    description: 'Answered 100 questions.',
    icon: 'stack',
    points: 25,
  },
  {
    code: ACHIEVEMENT_CODES.STREAK_7,
    title: 'Seven Days Faithful',
    description: 'Studied on seven consecutive days.',
    icon: 'flame',
    points: 30,
  },
  {
    code: ACHIEVEMENT_CODES.STREAK_30,
    title: 'A Month of Diligence',
    description: 'Studied on thirty consecutive days.',
    icon: 'flame',
    points: 80,
  },
  {
    code: ACHIEVEMENT_CODES.CHAPTER_MASTERED,
    title: 'Chapter Mastered',
    description: 'Reached 80% mastery across every topic in a chapter.',
    icon: 'bookmark-check',
    points: 40,
  },
  {
    code: ACHIEVEMENT_CODES.SUBJECT_COMPLETE,
    title: 'Paper Covered',
    description: 'Marked every topic in a paper as completed.',
    icon: 'book',
    points: 60,
  },
  {
    code: ACHIEVEMENT_CODES.MOCK_COMPLETED,
    title: 'Sat the Mock',
    description: 'Completed a full mock examination under timed conditions.',
    icon: 'clock',
    points: 35,
  },
  {
    code: ACHIEVEMENT_CODES.THEORY_FIRST,
    title: 'Essay Attempted',
    description: 'Submitted your first theory answer for marking.',
    icon: 'pen',
    points: 20,
  },
  {
    code: ACHIEVEMENT_CODES.ACCURACY_80,
    title: 'Eighty Percent',
    description: 'Held 80% accuracy over your last 50 questions.',
    icon: 'target',
    points: 50,
  },
  {
    code: ACHIEVEMENT_CODES.EXAM_READY,
    title: 'Exam Ready',
    description: 'Reached the Exam Ready readiness band.',
    icon: 'award',
    points: 100,
  },
];

const achievementSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    exam: { type: Schema.Types.ObjectId, ref: 'Exam', default: null },
    code: { type: String, enum: Object.values(ACHIEVEMENT_CODES), required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    icon: { type: String, default: 'award' },
    points: { type: Number, default: 0 },
    /** Extra detail, e.g. which chapter was mastered. */
    context: { type: String, default: '' },
    earnedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

achievementSchema.index({ user: 1, code: 1, context: 1 }, { unique: true });

export const Achievement = mongoose.model('Achievement', achievementSchema);
export default Achievement;
