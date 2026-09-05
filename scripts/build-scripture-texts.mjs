#!/usr/bin/env node
/**
 * Resolves every scripture reference the syllabus makes to its actual verse
 * text, and writes `data/part2/scripture-texts.json` for the seed to load.
 *
 *   npm install kjv --no-save        # 5MB, only needed to regenerate
 *   node scripts/build-scripture-texts.mjs
 *
 * ── On the translation ──────────────────────────────────────────────────────
 *
 * The Authorised (King James) Version is used because it is free of copyright
 * and is the version the syllabus itself quotes from throughout. The source is
 * the `kjv` npm package (the 1769 Blayney text), released into the public
 * domain under the Unlicense.
 *
 * One honest caveat, recorded here rather than buried: in the United Kingdom
 * the KJV is still subject to perpetual Crown letters patent held by the King's
 * Printer. Everywhere else, including Ghana, it is in the public domain. Since
 * this is a Ghanaian church study aid the position is clean, but the
 * translation is a configurable field precisely so it can be swapped.
 *
 * Only the passages the syllabus actually cites are written out — roughly a
 * thousand references, a few hundred kilobytes — so the repository carries no
 * whole-Bible payload and the application needs no runtime dependency.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'data', 'part2');

let VERSES;
try {
  VERSES = require('kjv/json/verses-1769.json');
} catch {
  console.error(
    'The `kjv` package is not installed. It is only needed to regenerate this file:\n' +
      '  npm install kjv --no-save\n' +
      'The generated data/part2/scripture-texts.json is committed, so this step is optional.',
  );
  process.exit(1);
}

/** Names the syllabus spells differently from this KJV edition. */
const BOOK_ALIASES = {
  'Song of Songs': "Solomon's Song",
  'Song of Solomon': "Solomon's Song",
  Psalm: 'Psalms',
};

/**
 * Books with a single chapter. "Jude 3" means verse 3, not chapter 3 — a
 * distinction that otherwise loses every citation to these five books.
 */
const SINGLE_CHAPTER_BOOKS = new Set(['Obadiah', 'Philemon', '2 John', '3 John', 'Jude']);

/** A whole-chapter citation is useful but must not become a wall of text. */
const MAX_CHAPTER_VERSES = 40;
const MAX_TEXT_CHARS = 6000;

/** "2-4,13" → [2,3,4,13]. Tolerates stray spaces and reversed ranges. */
function parseVerseSpec(spec) {
  const wanted = [];
  for (const part of String(spec).split(',')) {
    const piece = part.trim();
    if (!piece) continue;
    const range = piece.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (range) {
      let [, from, to] = range.map(Number);
      if (from > to) [from, to] = [to, from];
      // Guard against an OCR slip producing an absurd span.
      if (to - from > 200) continue;
      for (let v = from; v <= to; v += 1) wanted.push(v);
      continue;
    }
    const single = piece.match(/^(\d+)$/);
    if (single) wanted.push(Number(single[1]));
  }
  return [...new Set(wanted)].sort((a, b) => a - b);
}

function chapterVerseNumbers(book, chapter) {
  const numbers = [];
  for (let v = 1; v <= 200; v += 1) {
    if (VERSES[`${book} ${chapter}:${v}`] === undefined) break;
    numbers.push(v);
  }
  return numbers;
}

function resolve(ref) {
  const book = BOOK_ALIASES[ref.book] || ref.book;

  // In a one-chapter book the number after the name is a verse.
  let chapter = ref.chapter;
  let verseSpec = ref.verses;
  if (SINGLE_CHAPTER_BOOKS.has(book) && !verseSpec) {
    verseSpec = String(chapter);
    chapter = 1;
  }

  const available = chapterVerseNumbers(book, chapter);
  if (!available.length) return { ok: false, reason: `no such chapter: ${book} ${chapter}` };

  let wanted = verseSpec ? parseVerseSpec(verseSpec) : available;
  let wholeChapter = !verseSpec;
  let truncated = false;

  // Drop verse numbers the chapter does not contain rather than inventing them.
  const missing = wanted.filter((v) => !available.includes(v));
  wanted = wanted.filter((v) => available.includes(v));
  if (!wanted.length) return { ok: false, reason: `no matching verses in ${book} ${chapter}` };

  if (wanted.length > MAX_CHAPTER_VERSES) {
    wanted = wanted.slice(0, MAX_CHAPTER_VERSES);
    truncated = true;
  }

  const verseList = wanted.map((v) => ({ verse: v, text: VERSES[`${book} ${chapter}:${v}`] }));

  let text = verseList.map((v) => `${v.verse}. ${v.text}`).join(' ');
  if (text.length > MAX_TEXT_CHARS) {
    let running = '';
    const kept = [];
    for (const v of verseList) {
      const next = `${running}${running ? ' ' : ''}${v.verse}. ${v.text}`;
      if (next.length > MAX_TEXT_CHARS) break;
      running = next;
      kept.push(v);
    }
    verseList.length = 0;
    verseList.push(...kept);
    text = running;
    truncated = true;
  }

  return { ok: true, text, verseList, wholeChapter, truncated, missing, resolvedBook: book, resolvedChapter: chapter };
}

/* Gather every reference the syllabus and the question bank cite. */
const manual = JSON.parse(fs.readFileSync(path.join(dataDir, 'manual.json'), 'utf8'));
const questions = JSON.parse(fs.readFileSync(path.join(dataDir, 'questions.manual.json'), 'utf8'));

const refs = new Map();
const remember = (ref) => {
  if (!ref?.book || !ref?.chapter) return;
  const key = ref.reference || `${ref.book} ${ref.chapter}${ref.verses ? `:${ref.verses}` : ''}`;
  if (!refs.has(key)) refs.set(key, { reference: key, book: ref.book, chapter: Number(ref.chapter), verses: ref.verses || null });
};

for (const subject of manual.subjects) {
  for (const chapter of subject.chapters) {
    for (const topic of chapter.topics) {
      (topic.scriptureReferences || []).forEach(remember);
    }
  }
}
for (const q of questions) {
  for (const ref of q.scriptureReferences || []) {
    if (typeof ref === 'string') {
      const m = ref.match(/^\s*((?:[1-3]\s*)?[A-Za-z][A-Za-z'\s]*?)\s+(\d{1,3})(?::([\d\-,\s]+))?\s*$/);
      if (m) remember({ book: m[1].trim(), chapter: Number(m[2]), verses: m[3]?.replace(/\s/g, '') || null, reference: ref.trim() });
    } else remember(ref);
  }
}

const out = {};
const failures = [];
let truncatedCount = 0;

for (const ref of refs.values()) {
  const result = resolve(ref);
  if (!result.ok) {
    failures.push({ reference: ref.reference, reason: result.reason });
    continue;
  }
  if (result.truncated) truncatedCount += 1;
  // Only the structured verse list is stored; the running text is rebuilt on
  // load, which keeps this file roughly half the size.
  out[ref.reference] = {
    reference: ref.reference,
    book: result.resolvedBook,
    chapter: result.resolvedChapter,
    verses: ref.verses,
    verseList: result.verseList,
    ...(result.wholeChapter ? { wholeChapter: true } : {}),
    ...(result.truncated ? { truncated: true } : {}),
    ...(result.missing?.length ? { versesNotFound: result.missing } : {}),
  };
}

const payload = {
  translation: 'King James Version',
  translationAbbreviation: 'KJV',
  edition: '1769 Blayney text',
  source: 'https://www.npmjs.com/package/kjv',
  licence: 'Public domain (Unlicense). See scripts/build-scripture-texts.mjs for the UK Crown patent caveat.',
  generatedAt: new Date().toISOString().slice(0, 10),
  count: Object.keys(out).length,
  passages: out,
};

const outPath = path.join(dataDir, 'scripture-texts.json');
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 1)}\n`);

const bytes = fs.statSync(outPath).size;
console.log(`References found   : ${refs.size}`);
console.log(`Resolved to text   : ${Object.keys(out).length}`);
console.log(`  truncated (long) : ${truncatedCount}`);
console.log(`Unresolved         : ${failures.length}`);
failures.slice(0, 15).forEach((f) => console.log(`  · ${f.reference} — ${f.reason}`));
if (failures.length > 15) console.log(`  … and ${failures.length - 15} more`);
console.log(`\nWrote ${path.relative(root, outPath)} (${(bytes / 1024).toFixed(0)} KB)`);
