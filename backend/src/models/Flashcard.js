import mongoose from 'mongoose';
import { CONTENT_STATUS, SOURCE_KIND } from '../../../shared/constants.js';
import { scriptureRefSchema } from './Topic.js';

const { Schema } = mongoose;

const flashcardSchema = new Schema(
  {
    cardId: { type: String, required: true, unique: true, index: true },
    exam: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    chapter: { type: Schema.Types.ObjectId, ref: 'Chapter', default: null, index: true },
    topic: { type: Schema.Types.ObjectId, ref: 'Topic', default: null, index: true },

    front: { type: String, required: true, trim: true },
    back: { type: String, required: true, trim: true },
    /** term | fact | scripture | definition | person | event */
    kind: { type: String, default: 'fact', index: true },

    scriptureReferences: { type: [scriptureRefSchema], default: [] },
    manualReference: {
      subjectName: String,
      chapterTitle: String,
      topicTitle: String,
      anchor: Number,
      pageNumber: Number,
      citation: String,
      excerpt: String,
    },

    tags: { type: [String], default: [] },
    sourceKind: { type: String, enum: Object.values(SOURCE_KIND), default: SOURCE_KIND.MANUAL_DERIVED },
    status: { type: String, enum: Object.values(CONTENT_STATUS), default: CONTENT_STATUS.PUBLISHED, index: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

flashcardSchema.index({ topic: 1, status: 1 });
flashcardSchema.index({ front: 'text', back: 'text' });

export const Flashcard = mongoose.model('Flashcard', flashcardSchema);

/** Per-user review state for a card, mirroring the question Leitner scheme. */
const flashcardStateSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    flashcard: { type: Schema.Types.ObjectId, ref: 'Flashcard', required: true, index: true },
    topic: { type: Schema.Types.ObjectId, ref: 'Topic', default: null, index: true },
    reviews: { type: Number, default: 0 },
    known: { type: Number, default: 0 },
    needsRevision: { type: Number, default: 0 },
    box: { type: Number, default: 0 },
    dueAt: { type: Date, default: () => new Date(), index: true },
    lastReviewedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

flashcardStateSchema.index({ user: 1, flashcard: 1 }, { unique: true });

export const FlashcardState = mongoose.model('FlashcardState', flashcardStateSchema);
export default Flashcard;
