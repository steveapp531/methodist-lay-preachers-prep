import mongoose from 'mongoose';

const { Schema } = mongoose;

const bookmarkSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    /** Exactly one target is set. */
    targetType: { type: String, enum: ['question', 'topic', 'flashcard', 'scripture'], required: true, index: true },
    question: { type: Schema.Types.ObjectId, ref: 'Question', default: null },
    topic: { type: Schema.Types.ObjectId, ref: 'Topic', default: null },
    flashcard: { type: Schema.Types.ObjectId, ref: 'Flashcard', default: null },
    scriptureReference: { type: String, default: null },

    label: { type: String, default: '' },
    colour: { type: String, default: '' },
  },
  { timestamps: true },
);

bookmarkSchema.index({ user: 1, targetType: 1, createdAt: -1 });
bookmarkSchema.index({ user: 1, question: 1 }, { unique: true, partialFilterExpression: { question: { $type: 'objectId' } } });
bookmarkSchema.index({ user: 1, topic: 1 }, { unique: true, partialFilterExpression: { topic: { $type: 'objectId' } } });
bookmarkSchema.index({ user: 1, flashcard: 1 }, { unique: true, partialFilterExpression: { flashcard: { $type: 'objectId' } } });

export const Bookmark = mongoose.model('Bookmark', bookmarkSchema);
export default Bookmark;
