import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * A candidate's private note. Notes are private by default; only an
 * administrator can publish a note as shared study material, and doing so
 * requires the explicit `visibility: 'shared'` flag.
 */
const noteSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    exam: { type: Schema.Types.ObjectId, ref: 'Exam', default: null, index: true },

    targetType: { type: String, enum: ['topic', 'question', 'chapter', 'flashcard', 'general'], required: true, index: true },
    topic: { type: Schema.Types.ObjectId, ref: 'Topic', default: null, index: true },
    chapter: { type: Schema.Types.ObjectId, ref: 'Chapter', default: null },
    question: { type: Schema.Types.ObjectId, ref: 'Question', default: null, index: true },
    flashcard: { type: Schema.Types.ObjectId, ref: 'Flashcard', default: null },

    title: { type: String, default: '', trim: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 20000 },
    tags: { type: [String], default: [] },
    colour: { type: String, default: '' },
    pinned: { type: Boolean, default: false },

    visibility: { type: String, enum: ['private', 'shared'], default: 'private', index: true },
    publishedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

noteSchema.index({ user: 1, updatedAt: -1 });
noteSchema.index({ title: 'text', body: 'text' });

export const Note = mongoose.model('Note', noteSchema);
export default Note;
