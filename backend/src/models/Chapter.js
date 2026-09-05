import mongoose from 'mongoose';

const { Schema } = mongoose;

const chapterSchema = new Schema(
  {
    exam: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    /** As printed in the syllabus: "IV", "UNIT TWO", or null for front matter. */
    number: { type: String, default: null, trim: true },
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true, index: true },
    summary: { type: String, default: '' },
    order: { type: Number, default: 0, index: true },

    /** Paragraph index in the source syllabus, used to build citations. */
    sourceAnchor: { type: Number, default: null },
    /** Printed page number, when the source document provides one. */
    pageNumber: { type: Number, default: null },

    isPublished: { type: Boolean, default: true, index: true },
    stats: {
      topicCount: { type: Number, default: 0 },
      questionCount: { type: Number, default: 0 },
      wordCount: { type: Number, default: 0 },
    },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

chapterSchema.index({ subject: 1, slug: 1 }, { unique: true });

chapterSchema.virtual('topics', {
  ref: 'Topic',
  localField: '_id',
  foreignField: 'chapter',
});

export const Chapter = mongoose.model('Chapter', chapterSchema);
export default Chapter;
