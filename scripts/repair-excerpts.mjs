#!/usr/bin/env node
/**
 * Repairs citation excerpts that are correct in substance but not byte-exact.
 *
 *   node scripts/repair-excerpts.mjs [--write]
 *
 * The syllabus wraps sentences with hard line breaks mid-clause, so an author
 * transcribing a quotation naturally collapses "God directed \nhim" to
 * "God directed him". The text is right; the bytes are not. Since the platform
 * checks excerpts verbatim before publishing, those citations fail.
 *
 * This finds each failing excerpt by comparing whitespace-normalised text,
 * recovers the exact original span from the syllabus, and rewrites the stored
 * excerpt and anchor to match the paragraph it actually came from.
 *
 * An excerpt that cannot be located even after normalisation is not repaired
 * and not left standing: the question is downgraded to `unverified` /
 * `needs_review` with its answer key removed, because a citation that does not
 * check out is exactly what this platform must never show a candidate.
 *
 * Runs as a dry run unless --write is passed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const genDir = path.join(root, 'data', 'part2', 'gen');
const WRITE = process.argv.includes('--write');

const manual = JSON.parse(fs.readFileSync(path.join(root, 'data', 'part2', 'manual.json'), 'utf8'));

/** Collapse every run of whitespace to one space, for comparison only. */
const flat = (s) => String(s).replace(/\s+/g, ' ').trim();

/**
 * For each paper, build the concatenated text plus an index that maps a
 * position in the normalised string back to the original characters, so the
 * exact source span can be recovered once a match is found.
 */
const papers = new Map();
for (const subject of manual.subjects) {
  const blocks = [];
  for (const chapter of subject.chapters) {
    for (const topic of chapter.topics) {
      for (const block of topic.blocks) {
        blocks.push({ anchor: block.anchor, text: block.text, chapter: chapter.title, topic: topic.title });
      }
    }
  }

  // One normalised haystack per block; matching within a block keeps the
  // recovered span inside a single paragraph, which is what an anchor means.
  const indexed = blocks.map((b) => {
    const map = []; // normalised index -> original index
    let norm = '';
    let pendingSpace = false;
    for (let i = 0; i < b.text.length; i += 1) {
      const ch = b.text[i];
      if (/\s/.test(ch)) {
        pendingSpace = norm.length > 0;
        continue;
      }
      if (pendingSpace) {
        map.push(i);
        norm += ' ';
        pendingSpace = false;
      }
      map.push(i);
      norm += ch;
    }
    return { ...b, norm, map };
  });

  papers.set(subject.code, { blocks: indexed, name: subject.name });
}

/** Find the excerpt in the paper and return the exact original span. */
function locate(subjectCode, excerpt) {
  const paper = papers.get(subjectCode);
  if (!paper) return null;
  const needle = flat(excerpt);
  if (needle.length < 12) return null;

  for (const block of paper.blocks) {
    const at = block.norm.indexOf(needle);
    if (at === -1) continue;
    const start = block.map[at];
    const end = block.map[at + needle.length - 1];
    return {
      exact: block.text.slice(start, end + 1),
      anchor: block.anchor,
      chapter: block.chapter,
      topic: block.topic,
      paperName: paper.name,
    };
  }
  return null;
}

const files = fs.readdirSync(genDir).filter((f) => f.startsWith('questions.') && f.endsWith('.json'));

let checked = 0;
let alreadyExact = 0;
let repaired = 0;
let reanchored = 0;
let downgraded = 0;
const casualties = [];

for (const file of files) {
  const full = path.join(genDir, file);
  const payload = JSON.parse(fs.readFileSync(full, 'utf8'));
  const rows = Array.isArray(payload) ? payload : [...(payload.objective || []), ...(payload.theory || [])];
  let touched = false;

  for (const q of rows) {
    const ref = q.manualReference;
    const excerpt = ref?.excerpt?.trim();
    if (!excerpt) continue;
    checked += 1;

    const paper = papers.get(q.subject);
    const blockAtAnchor = paper?.blocks.find((b) => b.anchor === ref.anchor);

    if (blockAtAnchor?.text.includes(excerpt)) {
      alreadyExact += 1;
      continue;
    }

    const found = locate(q.subject, excerpt);

    if (!found) {
      // No match even normalised. Strip the claim rather than publish it.
      downgraded += 1;
      casualties.push(`${q.questionId} — excerpt not found in ${q.subject}`);
      touched = true;
      ref.excerpt = '';
      q.explanation = '';
      q.answerConfidence = 'unverified';
      q.status = 'needs_review';
      q.reviewNotes = [
        q.reviewNotes,
        'The stored excerpt could not be located in the syllabus, so the answer key was removed pending review.',
      ]
        .filter(Boolean)
        .join(' ');
      if (Array.isArray(q.options)) q.options.forEach((o) => { o.isCorrect = false; });
      if (Array.isArray(q.acceptedAnswers)) q.acceptedAnswers = [];
      continue;
    }

    touched = true;
    if (found.exact !== excerpt) repaired += 1;
    if (found.anchor !== ref.anchor) reanchored += 1;

    ref.excerpt = found.exact;
    ref.anchor = found.anchor;
    ref.chapterTitle = found.chapter;
    ref.topicTitle = found.topic;
    ref.citation = `${found.paperName} — ${found.chapter} — ${found.topic}`;
    // Keep the question's own placement in step with where the proof actually is.
    q.chapter = found.chapter;
    q.topic = found.topic;
  }

  if (touched && WRITE) {
    const out = Array.isArray(payload) ? rows : payload;
    fs.writeFileSync(full, `${JSON.stringify(out, null, 1)}\n`);
  }
}

console.log(`Excerpts checked         : ${checked}`);
console.log(`  already byte-exact     : ${alreadyExact}`);
console.log(`  text repaired          : ${repaired}`);
console.log(`  re-anchored            : ${reanchored}`);
console.log(`  downgraded to review   : ${downgraded}`);
if (casualties.length) {
  console.log('\nDowngraded:');
  casualties.slice(0, 20).forEach((c) => console.log(`  · ${c}`));
  if (casualties.length > 20) console.log(`  … and ${casualties.length - 20} more`);
}
console.log(WRITE ? '\nFiles rewritten. Re-run scripts/merge-content.mjs.' : '\nDry run. Pass --write to apply.');
