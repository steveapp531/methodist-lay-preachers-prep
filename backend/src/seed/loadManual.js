import fs from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT } from '../config/env.js';
import { logger } from '../config/logger.js';
import { Chapter } from '../models/Chapter.js';
import { Exam } from '../models/Exam.js';
import { ScriptureReference } from '../models/ScriptureReference.js';
import { Subject } from '../models/Subject.js';
import { Topic, measureBlocks } from '../models/Topic.js';
import { slugify } from '../utils/text.js';

export const DATA_DIR = path.join(REPO_ROOT, 'data', 'part2');

/** Canonical Bible order, used so scripture lists read in the expected sequence. */
const BOOK_ORDER = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah',
  'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Songs', 'Isaiah', 'Jeremiah',
  'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah',
  'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians',
  'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
  '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter',
  '1 John', '2 John', '3 John', 'Jude', 'Revelation',
];
const OT_COUNT = 39;

export async function readJson(name) {
  const file = path.join(DATA_DIR, name);
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw new Error(`Could not read ${name}: ${err.message}`);
  }
}

/**
 * Loads the parsed syllabus into Exam → Subject → Chapter → Topic.
 *
 * Idempotent: running it again updates existing documents rather than
 * duplicating them, so content can be re-imported after a correction upstream
 * without losing anybody's progress, which references topics by id.
 */
export async function loadManual({ manual, examDoc }) {
  const counts = { subjects: 0, chapters: 0, topics: 0 };

  for (const subjectSpec of manual.subjects) {
    const subject = await Subject.findOneAndUpdate(
      { exam: examDoc._id, code: subjectSpec.code },
      {
        exam: examDoc._id,
        code: subjectSpec.code,
        slug: subjectSpec.slug || slugify(subjectSpec.name),
        name: subjectSpec.name,
        shortName: subjectSpec.shortName || '',
        paper: subjectSpec.paper || '',
        description: subjectSpec.description || '',
        order: subjectSpec.order || 0,
        colour: subjectSpec.colour || 'brand',
        isPublished: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    counts.subjects += 1;

    let topicCount = 0;
    let wordCount = 0;

    for (const chapterSpec of subjectSpec.chapters) {
      const chapter = await Chapter.findOneAndUpdate(
        { subject: subject._id, slug: chapterSpec.slug },
        {
          exam: examDoc._id,
          subject: subject._id,
          number: chapterSpec.number || null,
          title: chapterSpec.title,
          slug: chapterSpec.slug,
          order: chapterSpec.order || 0,
          sourceAnchor: chapterSpec.anchor ?? null,
          isPublished: true,
          'stats.topicCount': chapterSpec.topics.length,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      counts.chapters += 1;

      let chapterWords = 0;
      for (const topicSpec of chapterSpec.topics) {
        const blocks = (topicSpec.blocks || []).map((b) => ({
          anchor: b.anchor,
          text: b.text,
          kind: b.kind || 'paragraph',
        }));
        // Written explicitly rather than left to the model hook: an upsert does
        // not mark the document dirty, so a hook gated on that would never run
        // and every topic would report zero reading time.
        const { wordCount: topicWords, estimatedMinutes } = measureBlocks(blocks);

        await Topic.findOneAndUpdate(
          { chapter: chapter._id, slug: topicSpec.slug },
          {
            exam: examDoc._id,
            subject: subject._id,
            chapter: chapter._id,
            number: topicSpec.number || null,
            title: topicSpec.title,
            slug: topicSpec.slug,
            order: topicSpec.order || 0,
            blocks,
            summary: topicSpec.summary || '',
            keyPoints: topicSpec.keyPoints || [],
            keyTerms: topicSpec.keyTerms || [],
            examFocus: topicSpec.examFocus || [],
            scriptureReferences: topicSpec.scriptureReferences || [],
            sourceAnchor: topicSpec.anchor ?? null,
            citation: topicSpec.reference?.citation || '',
            wordCount: topicWords,
            estimatedMinutes,
            isPublished: true,
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );

        counts.topics += 1;
        topicCount += 1;
        chapterWords += topicWords;
      }

      await Chapter.updateOne({ _id: chapter._id }, { 'stats.wordCount': chapterWords, 'stats.topicCount': chapterSpec.topics.length });
      wordCount += chapterWords;
    }

    await Subject.updateOne(
      { _id: subject._id },
      {
        'stats.chapterCount': subjectSpec.chapters.length,
        'stats.topicCount': topicCount,
        'stats.wordCount': wordCount,
      },
    );
  }

  logger.info(`Manual loaded: ${counts.subjects} subjects, ${counts.chapters} chapters, ${counts.topics} topics`);
  return counts;
}

/**
 * Builds the scripture index from every reference the syllabus makes, and
 * attaches the passage text where `scripture-texts.json` supplies it.
 *
 * That file holds the Authorised (King James) Version, which is out of
 * copyright, for the passages the syllabus cites. A handful of references
 * cannot be resolved because the syllabus itself mis-cites them (it asks for
 * Malachi 5, and Malachi has four chapters); those keep their index entry and
 * simply carry no text, rather than being quietly dropped or invented.
 */
export async function buildScriptureIndex({ examDoc }) {
  const bible = (await readJson('scripture-texts.json')) || { passages: {}, translation: '' };
  const passages = bible.passages || {};
  const translationLabel = bible.translation
    ? `${bible.translation}${bible.edition ? ` (${bible.edition})` : ''}`
    : '';

  const topics = await Topic.find({ exam: examDoc._id })
    .select('title slug subject chapter scriptureReferences citation')
    .populate('subject', 'name shortName')
    .lean();

  const index = new Map();
  for (const topic of topics) {
    for (const ref of topic.scriptureReferences || []) {
      const key = ref.reference;
      if (!index.has(key)) {
        const bookOrder = BOOK_ORDER.indexOf(ref.book);
        index.set(key, {
          exam: examDoc._id,
          reference: key,
          book: ref.book,
          bookOrder: bookOrder === -1 ? 999 : bookOrder,
          testament: bookOrder !== -1 && bookOrder < OT_COUNT ? 'OT' : 'NT',
          chapter: ref.chapter,
          verses: ref.verses || null,
          citedIn: [],
        });
      }
      index.get(key).citedIn.push({
        subject: topic.subject?._id,
        chapter: topic.chapter,
        topic: topic._id,
        subjectName: topic.subject?.shortName || topic.subject?.name || '',
        topicTitle: topic.title,
        citation: topic.citation || '',
      });
    }
  }

  let written = 0;
  let withText = 0;
  for (const entry of index.values()) {
    const passage = passages[entry.reference];
    const verseList = passage?.verseList || [];
    // The running text is rebuilt here rather than duplicated on disk.
    const text = verseList.map((v) => `${v.verse}. ${v.text}`).join(' ');
    if (text) withText += 1;

    await ScriptureReference.findOneAndUpdate(
      { exam: examDoc._id, reference: entry.reference },
      {
        ...entry,
        citationCount: entry.citedIn.length,
        text,
        verseList,
        wholeChapter: Boolean(passage?.wholeChapter),
        truncated: Boolean(passage?.truncated),
        translation: text ? translationLabel : '',
        translationSource: text ? bible.source || '' : '',
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
    written += 1;
  }

  logger.info(
    `Scripture index built: ${written} distinct references, ${withText} with ${translationLabel || 'no'} text` +
      (written - withText ? ` (${written - withText} the syllabus mis-cites)` : ''),
  );
  return written;
}

export async function ensureExam(spec) {
  return Exam.findOneAndUpdate({ code: spec.code }, spec, { upsert: true, new: true, setDefaultsOnInsert: true });
}
