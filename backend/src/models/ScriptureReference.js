import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * An index of every scripture citation found in the syllabus, with the passage
 * itself and links back to the places that cite it.
 *
 * The bundled text is the Authorised (King James) Version, which is free of
 * copyright and is the version the syllabus quotes from. Only the passages the
 * syllabus actually cites are stored. `translation` records which version the
 * text belongs to, so a different one can be loaded without the interface
 * having to guess what it is showing.
 */
const scriptureReferenceSchema = new Schema(
  {
    exam: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    reference: { type: String, required: true, trim: true, index: true }, // "Amos 5:24"
    book: { type: String, required: true, trim: true, index: true },
    /** Canonical order, so references sort as they appear in the Bible. */
    bookOrder: { type: Number, default: 0, index: true },
    testament: { type: String, enum: ['OT', 'NT'], required: true, index: true },
    chapter: { type: Number, required: true },
    verses: { type: String, default: null },

    /** The passage as running text, ready to display. */
    text: { type: String, default: '' },
    /** The same passage verse by verse, for numbered display. */
    verseList: {
      type: [new Schema({ verse: Number, text: String }, { _id: false })],
      default: [],
    },
    /** True when a whole chapter was cited and the stored text was capped. */
    truncated: { type: Boolean, default: false },
    wholeChapter: { type: Boolean, default: false },

    translation: { type: String, default: '' },
    translationSource: { type: String, default: '' },

    /** Where the syllabus cites this passage. */
    citedIn: [
      new Schema(
        {
          subject: { type: Schema.Types.ObjectId, ref: 'Subject' },
          chapter: { type: Schema.Types.ObjectId, ref: 'Chapter' },
          topic: { type: Schema.Types.ObjectId, ref: 'Topic' },
          subjectName: String,
          topicTitle: String,
          citation: String,
        },
        { _id: false },
      ),
    ],
    questionCount: { type: Number, default: 0 },
    citationCount: { type: Number, default: 0, index: true },
  },
  { timestamps: true },
);

scriptureReferenceSchema.index({ exam: 1, reference: 1 }, { unique: true });
scriptureReferenceSchema.index({ reference: 'text', book: 'text' });

export const ScriptureReference = mongoose.model('ScriptureReference', scriptureReferenceSchema);
export default ScriptureReference;
