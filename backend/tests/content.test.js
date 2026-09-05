import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { measureBlocks } from '../src/models/Topic.js';

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'part2');
const read = (name) => JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));

const manual = read('manual.json');
const questions = read('questions.manual.json');
const bible = read('scripture-texts.json');

const allTopics = manual.subjects.flatMap((s) => s.chapters.flatMap((c) => c.topics));

/* ------------------------------------------------------- reading estimates */

test('reading time is computed from the blocks, not left at zero', () => {
  // The bug this guards: the model hook was gated on dirty state that an upsert
  // never sets, so every topic in Study reported no reading time at all.
  const { wordCount, estimatedMinutes } = measureBlocks([
    { text: 'one two three four five six seven eight nine ten' },
    { text: 'eleven twelve' },
  ]);
  assert.equal(wordCount, 12);
  assert.equal(estimatedMinutes, 1, 'a short topic still reads as at least a minute');
});

test('an empty topic reports no reading time rather than one minute', () => {
  assert.deepEqual(measureBlocks([]), { wordCount: 0, estimatedMinutes: 0 });
});

test('reading time scales with length', () => {
  const long = measureBlocks([{ text: 'word '.repeat(1800) }]);
  assert.equal(long.wordCount, 1800);
  assert.equal(long.estimatedMinutes, 10, '1800 words at 180 wpm is ten minutes');
});

test('whitespace runs do not inflate the word count', () => {
  assert.equal(measureBlocks([{ text: '  alpha \n\n beta \t gamma  ' }]).wordCount, 3);
});

test('every substantive topic in the syllabus gets a non-zero reading time', () => {
  const substantive = allTopics.filter((t) => (t.blocks || []).length > 0);
  assert.ok(substantive.length > 250, `expected the syllabus to have many topics, found ${substantive.length}`);

  const zeroes = substantive.filter((t) => measureBlocks(t.blocks).estimatedMinutes === 0);
  assert.equal(zeroes.length, 0, `${zeroes.length} topics would show as taking no time to read`);
});

/* ------------------------------------------------------- answer positions */

test('correct answers are spread across the options, not banked on A', () => {
  const mc = questions.filter((q) => (q.questionType || q.type) === 'multiple_choice');
  const counts = {};
  for (const q of mc) {
    const correct = (q.options || []).find((o) => o.isCorrect);
    if (correct) counts[correct.key] = (counts[correct.key] || 0) + 1;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  assert.ok(total > 500, 'expected a substantial multiple-choice bank');

  // Nothing should be near the 98%-on-A that the generated questions started at.
  for (const key of ['A', 'B', 'C', 'D']) {
    const share = (counts[key] || 0) / total;
    assert.ok(share > 0.12, `only ${(share * 100).toFixed(0)}% of answers sit at ${key}`);
    assert.ok(share < 0.4, `${(share * 100).toFixed(0)}% of answers sit at ${key} — too predictable`);
  }
});

test('option keys are unique and sequential within each question', () => {
  const objective = questions.filter((q) => ['multiple_choice', 'multiple_response'].includes(q.questionType || q.type));
  const expected = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  for (const q of objective) {
    const keys = (q.options || []).map((o) => o.key);
    assert.equal(new Set(keys).size, keys.length, `${q.questionId} has duplicate option keys`);
    assert.deepEqual(keys, expected.slice(0, keys.length), `${q.questionId} has non-sequential keys`);
  }
});

test('shuffling preserved exactly one correct option per multiple-choice question', () => {
  const mc = questions.filter(
    (q) => (q.questionType || q.type) === 'multiple_choice' && q.answerConfidence !== 'unverified',
  );
  for (const q of mc) {
    const correct = (q.options || []).filter((o) => o.isCorrect);
    assert.equal(correct.length, 1, `${q.questionId} has ${correct.length} correct options`);
    assert.deepEqual(
      q.correctOptionKeys,
      correct.map((o) => o.key),
      `${q.questionId}: correctOptionKeys is out of step with the option flags`,
    );
  }
});

test('past-paper option order was left alone', () => {
  // Real papers already distribute answers evenly; reordering them would
  // misrepresent the source, so their spread should look nothing like a
  // deliberate shuffle of a fully A-weighted set.
  const past = questions.filter((q) => q.sourceKind === 'past_paper' && (q.questionType || q.type) === 'multiple_choice');
  assert.ok(past.length > 300, 'expected a large past-paper set');
  const counts = {};
  for (const q of past) {
    const correct = (q.options || []).find((o) => o.isCorrect);
    if (correct) counts[correct.key] = (counts[correct.key] || 0) + 1;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  assert.ok((counts.A || 0) / total < 0.35, 'past papers should not be A-heavy');
});

/* --------------------------------------------------------------- scripture */

test('the scripture bank carries a named, licence-clear translation', () => {
  assert.ok(bible.translation, 'the translation must be recorded so the interface can name it');
  assert.match(bible.licence, /public domain/i);
  assert.ok(bible.count > 900, `expected most references resolved, got ${bible.count}`);
});

test('the syllabus scripture references resolve to real verse text', () => {
  const cited = new Set();
  for (const topic of allTopics) {
    for (const ref of topic.scriptureReferences || []) cited.add(ref.reference);
  }
  assert.ok(cited.size > 900, `expected a large scripture index, found ${cited.size}`);

  const resolved = [...cited].filter((r) => bible.passages[r]?.verseList?.length);
  const ratio = resolved.length / cited.size;
  assert.ok(ratio > 0.97, `only ${(ratio * 100).toFixed(1)}% of references resolved to text`);
});

test('every stored passage has verse numbers and non-empty text', () => {
  for (const [reference, passage] of Object.entries(bible.passages)) {
    assert.ok(passage.verseList.length, `${reference} has no verses`);
    for (const verse of passage.verseList) {
      assert.ok(Number.isInteger(verse.verse) && verse.verse > 0, `${reference} has a bad verse number`);
      assert.ok(verse.text && verse.text.trim().length > 0, `${reference}:${verse.verse} has no text`);
    }
  }
});

test('a known verse resolves to the expected words', () => {
  // A spot check that the mapping is not simply shifted by one somewhere.
  const john = bible.passages['John 3:16'] || bible.passages['John 3:16-17'];
  if (john) {
    assert.match(john.verseList[0].text, /God so loved the world/i);
  }
  const amos = Object.entries(bible.passages).find(([r]) => r.startsWith('Amos 5:24'));
  if (amos) {
    assert.match(amos[1].verseList.map((v) => v.text).join(' '), /judgment|righteousness/i);
  }
});

test('whole-chapter citations are capped rather than dumping the chapter', () => {
  for (const [reference, passage] of Object.entries(bible.passages)) {
    // Two caps apply: at most forty verses, and a character budget that can bite
    // first on a chapter of long verses. Either one sets `truncated`, so the
    // only safe invariants are the verse ceiling and that something was kept.
    assert.ok(passage.verseList.length <= 40, `${reference} stored ${passage.verseList.length} verses`);
    if (passage.truncated) {
      assert.ok(passage.verseList.length > 0, `${reference} was truncated to nothing`);
      assert.ok(passage.wholeChapter || passage.verses, `${reference} truncated without a source range`);
    }
  }
});
