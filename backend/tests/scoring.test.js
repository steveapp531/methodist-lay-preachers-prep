import test from 'node:test';
import assert from 'node:assert/strict';
import { gradeObjective, isAutoMarkable } from '../src/services/scoringService.js';
import { QUESTION_TYPES } from '../../shared/constants.js';

/** Minimal question stand-in; the scorer only reads these fields. */
function question(overrides = {}) {
  return {
    type: QUESTION_TYPES.MULTIPLE_CHOICE,
    marks: 1,
    totalMarks: 1,
    options: [
      { key: 'A', text: 'Nabi', isCorrect: true },
      { key: 'B', text: 'Roeh', isCorrect: false },
      { key: 'C', text: 'Hozeh', isCorrect: false },
      { key: 'D', text: 'Torah', isCorrect: false },
    ],
    correctOptionKeys: ['A'],
    ...overrides,
  };
}

test('multiple choice: the right option scores full marks', () => {
  const result = gradeObjective(question(), { selectedOptionKeys: ['A'] });
  assert.equal(result.isCorrect, true);
  assert.equal(result.score, 1);
  assert.equal(result.marksAwarded, 1);
});

test('multiple choice: a wrong option scores nothing but still reports the key', () => {
  const result = gradeObjective(question(), { selectedOptionKeys: ['C'] });
  assert.equal(result.isCorrect, false);
  assert.equal(result.marksAwarded, 0);
  assert.deepEqual(result.detail.correct, ['A']);
});

test('multiple choice: no answer is marked as unanswered, not as wrong guessing', () => {
  const result = gradeObjective(question(), {});
  assert.equal(result.isCorrect, false);
  assert.equal(result.detail.reason, 'no_answer');
});

test('multiple choice: option keys are compared case-insensitively', () => {
  const result = gradeObjective(question(), { selectedOptionKeys: ['a'] });
  assert.equal(result.isCorrect, true);
});

test('multiple choice: falls back to the isCorrect flags when no key array is stored', () => {
  const q = question({ correctOptionKeys: [] });
  assert.equal(gradeObjective(q, { selectedOptionKeys: ['A'] }).isCorrect, true);
  assert.equal(gradeObjective(q, { selectedOptionKeys: ['B'] }).isCorrect, false);
});

test('true or false marks like a two-option multiple choice', () => {
  const q = question({
    type: QUESTION_TYPES.TRUE_FALSE,
    options: [
      { key: 'A', text: 'True', isCorrect: false },
      { key: 'B', text: 'False', isCorrect: true },
    ],
    correctOptionKeys: ['B'],
  });
  assert.equal(gradeObjective(q, { selectedOptionKeys: ['B'] }).isCorrect, true);
  assert.equal(gradeObjective(q, { selectedOptionKeys: ['A'] }).isCorrect, false);
});

test('multiple response: all correct and nothing else scores full marks', () => {
  const q = question({
    type: QUESTION_TYPES.MULTIPLE_RESPONSE,
    marks: 2,
    totalMarks: 2,
    correctOptionKeys: ['A', 'C'],
  });
  const result = gradeObjective(q, { selectedOptionKeys: ['A', 'C'] });
  assert.equal(result.isCorrect, true);
  assert.equal(result.score, 1);
  assert.equal(result.marksAwarded, 2);
});

test('multiple response: one of two correct earns half, not none', () => {
  const q = question({ type: QUESTION_TYPES.MULTIPLE_RESPONSE, marks: 2, totalMarks: 2, correctOptionKeys: ['A', 'C'] });
  const result = gradeObjective(q, { selectedOptionKeys: ['A'] });
  assert.equal(result.isCorrect, false);
  assert.equal(result.score, 0.5);
  assert.equal(result.marksAwarded, 1);
});

test('multiple response: a wrong selection cancels out a right one', () => {
  const q = question({ type: QUESTION_TYPES.MULTIPLE_RESPONSE, marks: 2, totalMarks: 2, correctOptionKeys: ['A', 'C'] });
  const result = gradeObjective(q, { selectedOptionKeys: ['A', 'B'] });
  assert.equal(result.score, 0, 'one hit minus one miss leaves nothing');
});

test('multiple response: selecting everything scores zero rather than full marks', () => {
  const q = question({ type: QUESTION_TYPES.MULTIPLE_RESPONSE, marks: 2, totalMarks: 2, correctOptionKeys: ['A', 'C'] });
  const result = gradeObjective(q, { selectedOptionKeys: ['A', 'B', 'C', 'D'] });
  assert.equal(result.score, 0, 'shotgunning the paper must not be rewarded');
});

test('multiple response: duplicate selections are collapsed', () => {
  const q = question({ type: QUESTION_TYPES.MULTIPLE_RESPONSE, marks: 2, totalMarks: 2, correctOptionKeys: ['A', 'C'] });
  const result = gradeObjective(q, { selectedOptionKeys: ['A', 'A', 'C'] });
  assert.equal(result.isCorrect, true);
});

test('fill in the blank: an exact match is correct', () => {
  const q = question({ type: QUESTION_TYPES.FILL_BLANK, acceptedAnswers: ['Wesleyan Quadrilateral'], options: [] });
  assert.equal(gradeObjective(q, { textAnswer: 'Wesleyan Quadrilateral' }).isCorrect, true);
});

test('fill in the blank: case, punctuation and articles are forgiven', () => {
  const q = question({ type: QUESTION_TYPES.FILL_BLANK, acceptedAnswers: ['Wesleyan Quadrilateral'], options: [] });
  assert.equal(gradeObjective(q, { textAnswer: 'the wesleyan quadrilateral.' }).isCorrect, true);
});

test('fill in the blank: a small typing slip is forgiven', () => {
  const q = question({ type: QUESTION_TYPES.FILL_BLANK, acceptedAnswers: ['prevenient grace'], options: [] });
  assert.equal(gradeObjective(q, { textAnswer: 'prevenent grace' }).isCorrect, true);
});

test('fill in the blank: a different answer is still wrong', () => {
  const q = question({ type: QUESTION_TYPES.FILL_BLANK, acceptedAnswers: ['prevenient grace'], options: [] });
  assert.equal(gradeObjective(q, { textAnswer: 'justifying grace' }).isCorrect, false);
});

test('fill in the blank: any listed alternative is accepted', () => {
  const q = question({ type: QUESTION_TYPES.FILL_BLANK, acceptedAnswers: ['Nabi', 'Navi'], options: [] });
  assert.equal(gradeObjective(q, { textAnswer: 'Navi' }).isCorrect, true);
});

test('matching: every pair right is full marks, some right is partial', () => {
  const q = question({
    type: QUESTION_TYPES.MATCHING,
    marks: 4,
    totalMarks: 4,
    options: [],
    matchPairs: [
      { left: 'Nabi', right: 'One who is called' },
      { left: 'Roeh', right: 'Seer' },
      { left: 'Hozeh', right: 'Visionary' },
      { left: 'Torah', right: 'Law' },
    ],
  });

  const all = gradeObjective(q, {
    matchAnswer: { Nabi: 'One who is called', Roeh: 'Seer', Hozeh: 'Visionary', Torah: 'Law' },
  });
  assert.equal(all.isCorrect, true);
  assert.equal(all.marksAwarded, 4);

  const half = gradeObjective(q, { matchAnswer: { Nabi: 'One who is called', Roeh: 'Seer' } });
  assert.equal(half.isCorrect, false);
  assert.equal(half.score, 0.5);
  assert.equal(half.marksAwarded, 2);
});

test('matching: a Map is accepted as well as a plain object', () => {
  const q = question({
    type: QUESTION_TYPES.MATCHING,
    marks: 2,
    totalMarks: 2,
    options: [],
    matchPairs: [
      { left: 'Amos', right: 'Herdsman of Tekoa' },
      { left: 'Malachi', right: 'My messenger' },
    ],
  });
  const result = gradeObjective(q, {
    matchAnswer: new Map([
      ['Amos', 'Herdsman of Tekoa'],
      ['Malachi', 'My messenger'],
    ]),
  });
  assert.equal(result.isCorrect, true);
});

test('theory questions are not auto-markable and the scorer refuses them', () => {
  assert.equal(isAutoMarkable({ type: QUESTION_TYPES.THEORY }), false);
  assert.equal(isAutoMarkable({ type: QUESTION_TYPES.MULTIPLE_CHOICE }), true);
  assert.throws(() => gradeObjective({ type: QUESTION_TYPES.THEORY }, { textAnswer: 'x' }), /cannot mark/);
});

test('every result carries the same shape whatever the question type', () => {
  const cases = [
    [question(), { selectedOptionKeys: ['A'] }],
    [question({ type: QUESTION_TYPES.MULTIPLE_RESPONSE, correctOptionKeys: ['A', 'B'] }), { selectedOptionKeys: ['A'] }],
    [question({ type: QUESTION_TYPES.FILL_BLANK, acceptedAnswers: ['x'], options: [] }), { textAnswer: 'x' }],
  ];
  for (const [q, response] of cases) {
    const result = gradeObjective(q, response);
    for (const key of ['isCorrect', 'score', 'marksAwarded', 'marksAvailable', 'detail']) {
      assert.ok(key in result, `missing ${key}`);
    }
    assert.ok(result.score >= 0 && result.score <= 1, 'score must be a fraction');
  }
});
