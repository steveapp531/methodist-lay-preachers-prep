import mongoose from 'mongoose';

const { Schema } = mongoose;

export const scriptureRefSchema = new Schema(
  {
    book: { type: String, required: true, trim: true },
    chapter: { type: Number, required: true },
    verses: { type: String, default: null, trim: true },
    reference: { type: String, required: true, trim: true },
    note: { type: String, default: '' },
  },
  { _id: false },
);

/** A single passage of manual text, kept verbatim with its source anchor. */
const blockSchema = new Schema(
  {
    anchor: { type: Number, required: true },
    text: { type: String, required: true },
    kind: { type: String, enum: ['paragraph', 'list_item', 'quote', 'heading'], default: 'paragraph' },
  },
  { _id: false },
);

const topicSchema = new Schema(
  {
    exam: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    chapter: { type: Schema.Types.ObjectId, ref: 'Chapter', required: true, index: true },

    number: { type: String, default: null, trim: true },
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true, index: true },
    order: { type: Number, default: 0, index: true },

    /** Verbatim syllabus text. This is the source of truth shown in Study mode. */
    blocks: { type: [blockSchema], default: [] },

    /** Study aids. Written from the manual and always carrying a citation. */
    summary: { type: String, default: '' },
    keyPoints: { type: [String], default: [] },
    keyTerms: {
      type: [
        new Schema(
          { term: { type: String, required: true }, definition: { type: String, required: true } },
          { _id: false },
        ),
      ],
      default: [],
    },
    importantFigures: { type: [String], default: [] },
    examFocus: { type: [String], default: [] },

    scriptureReferences: { type: [scriptureRefSchema], default: [] },

    sourceAnchor: { type: Number, default: null },
    pageNumber: { type: Number, default: null },
    citation: { type: String, default: '' },

    wordCount: { type: Number, default: 0 },
    estimatedMinutes: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true, index: true },

    stats: {
      questionCount: { type: Number, default: 0 },
      flashcardCount: { type: Number, default: 0 },
    },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

topicSchema.index({ chapter: 1, slug: 1 }, { unique: true });
topicSchema.index({ title: 'text', summary: 'text' });

/** Words per minute for unhurried study reading, not skimming. */
const READING_SPEED_WPM = 180;

export function measureBlocks(blocks = []) {
  const wordCount = blocks.reduce((sum, b) => sum + String(b.text || '').split(/\s+/).filter(Boolean).length, 0);
  return { wordCount, estimatedMinutes: wordCount ? Math.max(1, Math.round(wordCount / READING_SPEED_WPM)) : 0 };
}

/**
 * Recomputed on every save rather than only when `blocks` is dirty.
 *
 * The narrower version of this guard was a bug: `findOneAndUpdate` returns a
 * document that is neither new nor modified, so a topic loaded that way kept
 * `wordCount: 0` and Study showed every topic as taking no time to read.
 */
topicSchema.pre('save', function setEstimate(next) {
  const { wordCount, estimatedMinutes } = measureBlocks(this.blocks);
  this.wordCount = wordCount;
  this.estimatedMinutes = estimatedMinutes;
  next();
});

export const Topic = mongoose.model('Topic', topicSchema);
export default Topic;
