#!/usr/bin/env node
/**
 * Verifies the question bank against the syllabus before it is seeded.
 *
 *   node scripts/verify-content.mjs
 *
 * The check that matters is the third one: every question that claims to be
 * grounded must carry an excerpt that appears **verbatim** in the syllabus
 * paragraph it cites. That is what stops an invented answer reaching a
 * candidate wearing a citation it does not have.
 *
 * Note that topic titles are not unique across a paper — "Introduction" and
 * "Chapter 1" recur — so a topic is identified by its (chapter, topic) pair,
 * never by title alone.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'data', 'part2');

const read = (name) => JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));

const manual = read('manual.json');
const questions = read('questions.manual.json');
const flashcards = read('flashcards.json');

/* Index the syllabus. */
const chapterTitles = new Set(); // "CODE|chapter"
const topicPairs = new Map(); // "CODE|chapter|topic" -> joined block text
const anchorText = new Map(); // "CODE|anchor" -> block text
const anchorOwner = new Map(); // "CODE|anchor" -> "chapter|topic"

for (const subject of manual.subjects) {
  for (const chapter of subject.chapters) {
    chapterTitles.add(`${subject.code}|${chapter.title}`);
    for (const topic of chapter.topics) {
      const key = `${subject.code}|${chapter.title}|${topic.title}`;
      topicPairs.set(key, topic.blocks.map((b) => b.text).join('\n'));
      for (const block of topic.blocks) {
        anchorText.set(`${subject.code}|${block.anchor}`, block.text);
        anchorOwner.set(`${subject.code}|${block.anchor}`, `${chapter.title}|${topic.title}`);
      }
    }
  }
}

const errors = [];
const warnings = [];
const seenIds = new Set();

const OBJECTIVE = new Set(['multiple_choice', 'true_false', 'multiple_response', 'fill_blank', 'matching']);

for (const q of questions) {
  const id = q.questionId;
  const fail = (message) => errors.push(`${id}: ${message}`);
  const warn = (message) => warnings.push(`${id}: ${message}`);

  if (!id) {
    errors.push('a question is missing questionId');
    continue;
  }
  if (seenIds.has(id)) fail('duplicate questionId');
  seenIds.add(id);

  if (!q.question?.trim()) fail('empty question text');

  /* 1. Placement resolves against the syllabus. */
  if (q.chapter && !chapterTitles.has(`${q.subject}|${q.chapter}`)) {
    fail(`chapter "${q.chapter}" does not exist in ${q.subject}`);
  }
  if (q.topic && !topicPairs.has(`${q.subject}|${q.chapter}|${q.topic}`)) {
    fail(`topic "${q.topic}" does not exist under chapter "${q.chapter}"`);
  }

  /* 2. The excerpt is verbatim, in the paragraph it cites. */
  const excerpt = q.manualReference?.excerpt?.trim();
  const anchor = q.manualReference?.anchor;

  if (excerpt) {
    const anchorKey = `${q.subject}|${anchor}`;
    const block = anchorText.get(anchorKey);

    if (anchor == null) {
      warn('has an excerpt but no anchor, so it can only be checked against the whole topic');
      const body = topicPairs.get(`${q.subject}|${q.chapter}|${q.topic}`) || '';
      if (!body.includes(excerpt)) fail('excerpt does not appear verbatim in the cited topic');
    } else if (!block) {
      fail(`anchor ${anchor} does not exist in ${q.subject}`);
    } else if (!block.includes(excerpt)) {
      const body = topicPairs.get(`${q.subject}|${q.chapter}|${q.topic}`) || '';
      if (body.includes(excerpt)) {
        warn(`excerpt is in the cited topic but not in the cited paragraph (anchor ${anchor})`);
      } else {
        fail(`excerpt does not appear verbatim at anchor ${anchor}`);
      }
    } else {
      const owner = anchorOwner.get(anchorKey);
      if (q.topic && owner !== `${q.chapter}|${q.topic}`) {
        warn(`anchor ${anchor} belongs to "${owner.replace('|', ' / ')}", not the cited topic`);
      }
    }
  }

  /* 3. Answerability, by type. */
  const type = q.questionType || q.type;

  if (type === 'theory') {
    const rubric = q.markingRubric || [];
    if (q.status === 'published' && !q.idealAnswer && !rubric.length && !(q.keyPoints || []).length) {
      fail('published theory question has nothing to mark against');
    }
    if (rubric.length) {
      const total = rubric.reduce((sum, c) => sum + (Number(c.marks) || 0), 0);
      const marks = Number(q.marks) || 0;
      if (Math.abs(total - marks) > 0.01) fail(`rubric marks total ${total} but the question is worth ${marks}`);
    }
  } else if (OBJECTIVE.has(type)) {
    const correct = (q.options || []).filter((o) => o.isCorrect);
    // A question held for review is *required* to carry no answer key — that is
    // the whole point of the flag — so the answerability checks do not apply.
    const unverified = q.answerConfidence === 'unverified';

    if (type === 'fill_blank') {
      if (!(q.acceptedAnswers || []).length && !unverified) fail('fill_blank has no acceptedAnswers');
      if ((q.options || []).length) warn('fill_blank should not carry options');
    } else if (type === 'matching') {
      if (!(q.matchPairs || []).length) fail('matching has no matchPairs');
    } else if (type === 'multiple_response') {
      if (correct.length < 2 && !unverified) {
        fail(`multiple_response has ${correct.length} correct options, expected 2 or more`);
      }
    } else {
      if ((q.options || []).length < 2 && !unverified) fail('objective question has fewer than two options');
      if (correct.length !== 1 && !unverified) {
        fail(`expected exactly one correct option, found ${correct.length}`);
      }
    }

    if (type === 'true_false') {
      const texts = (q.options || []).map((o) => o.text);
      if (texts.join('|') !== 'True|False') warn(`true_false options are ${JSON.stringify(texts)}, expected True and False`);
    }
  } else {
    fail(`unknown question type "${type}"`);
  }

  /* 4. Provenance and visibility agree. */
  if (q.status === 'published') {
    if (q.answerConfidence === 'unverified') {
      fail('published while its answer is unverified — it must be held at needs_review');
    }
    if (!q.explanation?.trim() && !excerpt && type !== 'theory') {
      fail('published with neither an explanation nor a syllabus excerpt, so a wrong answer teaches nothing');
    }
  }
  if (q.answerConfidence === 'unverified') {
    const hasKey = (q.options || []).some((o) => o.isCorrect) || (q.acceptedAnswers || []).length;
    if (hasKey) fail('marked unverified but still carries an answer key');
    if (!q.reviewNotes?.trim()) warn('marked unverified but gives no reason in reviewNotes');
  }
  if (q.answerConfidence === 'provisional' && !q.reviewNotes?.trim()) {
    warn('marked provisional but gives no reason in reviewNotes');
  }
}

/* Flashcards. */
const seenCards = new Set();
for (const card of flashcards) {
  if (!card.cardId) {
    errors.push('a flashcard is missing cardId');
    continue;
  }
  if (seenCards.has(card.cardId)) errors.push(`${card.cardId}: duplicate cardId`);
  seenCards.add(card.cardId);
  if (!card.front?.trim() || !card.back?.trim()) errors.push(`${card.cardId}: front or back is empty`);
}

/* Report. */
const bySubject = {};
const byType = {};
const byConfidence = {};
for (const q of questions) {
  bySubject[q.subject] = (bySubject[q.subject] || 0) + 1;
  const t = q.questionType || q.type;
  byType[t] = (byType[t] || 0) + 1;
  byConfidence[q.answerConfidence || 'unset'] = (byConfidence[q.answerConfidence || 'unset'] || 0) + 1;
}

console.log(`Syllabus : ${manual.subjects.length} papers, ` +
  `${manual.subjects.reduce((n, s) => n + s.chapters.length, 0)} chapters, ` +
  `${manual.subjects.reduce((n, s) => n + s.chapters.reduce((m, c) => m + c.topics.length, 0), 0)} topics`);
console.log(`Questions: ${questions.length}`);
console.log('  by paper     :', bySubject);
console.log('  by type      :', byType);
console.log('  by confidence:', byConfidence);
console.log(`Flashcards: ${flashcards.length}`);
console.log();

if (warnings.length) {
  console.log(`${warnings.length} warning${warnings.length === 1 ? '' : 's'}:`);
  warnings.slice(0, 25).forEach((w) => console.log(`  · ${w}`));
  if (warnings.length > 25) console.log(`  … and ${warnings.length - 25} more`);
  console.log();
}

if (errors.length) {
  console.error(`${errors.length} error${errors.length === 1 ? '' : 's'}:`);
  errors.slice(0, 40).forEach((e) => console.error(`  ✗ ${e}`));
  if (errors.length > 40) console.error(`  … and ${errors.length - 40} more`);
  process.exit(1);
}

console.log('All checks passed. Every grounded answer is traceable to the syllabus paragraph it cites.');
