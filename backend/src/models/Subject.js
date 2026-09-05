import mongoose from 'mongoose';

const { Schema } = mongoose;

const subjectSchema = new Schema(
  {
    exam: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    shortName: { type: String, trim: true, default: '' },
    /** The paper title as printed on the examination question paper. */
    paper: { type: String, trim: true, default: '' },
    description: { type: String, default: '' },
    order: { type: Number, default: 0, index: true },
    colour: { type: String, default: 'brand' },
    icon: { type: String, default: 'book' },
    isPublished: { type: Boolean, default: true, index: true },

    stats: {
      chapterCount: { type: Number, default: 0 },
      topicCount: { type: Number, default: 0 },
      questionCount: { type: Number, default: 0 },
      wordCount: { type: Number, default: 0 },
    },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

subjectSchema.index({ exam: 1, slug: 1 }, { unique: true });
subjectSchema.index({ exam: 1, code: 1 }, { unique: true });

subjectSchema.virtual('chapters', {
  ref: 'Chapter',
  localField: '_id',
  foreignField: 'subject',
});

export const Subject = mongoose.model('Subject', subjectSchema);
export default Subject;
