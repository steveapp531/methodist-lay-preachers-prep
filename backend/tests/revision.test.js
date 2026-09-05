import test from 'node:test';
import assert from 'node:assert/strict';
import { computePriority } from '../src/services/spacedRepetition.js';
import { nextDifficulty } from '../src/services/adaptiveService.js';
import { advanceStreak, daysBetween, addDays, localDateKey, lastNDateKeys } from '../src/utils/dates.js';
import { readinessBand, LEITNER_INTERVALS } from '../../shared/constants.js';
import { canonical, looselyEqual, slugify, stem, truncate } from '../src/utils/text.js';

const DAY = 86400000;
const NOW = Date.UTC(2026, 8, 1, 12, 0, 0);

function state(overrides = {}) {
  return {
    attempts: 5,
    correct: 3,
    incorrect: 2,
    consecutiveCorrect: 0,
    isMastered: false,
    dueAt: new Date(NOW),
    lastAttemptedAt: new Date(NOW - 3 * DAY),
    ...overrides,
  };
}

/* ------------------------------------------------- spaced revision priority */

test('a question never attempted is due immediately', () => {
  assert.equal(computePriority({ attempts: 0 }, NOW), 1);
});

test('a question missed more often ranks above one missed less often', () => {
  const oftenWrong = computePriority(state({ correct: 1, incorrect: 4 }), NOW);
  const rarelyWrong = computePriority(state({ correct: 4, incorrect: 1 }), NOW);
  assert.ok(oftenWrong > rarelyWrong);
});

test('the longer a question is overdue the higher it rises', () => {
  const justDue = computePriority(state({ dueAt: new Date(NOW) }), NOW);
  const longOverdue = computePriority(state({ dueAt: new Date(NOW - 20 * DAY) }), NOW);
  assert.ok(longOverdue > justDue);
});

test('a question answered minutes ago is pushed down so it does not repeat', () => {
  const justAnswered = computePriority(state({ lastAttemptedAt: new Date(NOW - 30 * 60 * 1000) }), NOW);
  const answeredLastWeek = computePriority(state({ lastAttemptedAt: new Date(NOW - 7 * DAY) }), NOW);
  assert.ok(justAnswered < answeredLastWeek);
});

test('a mastered question sinks below an unmastered one with the same record', () => {
  const mastered = computePriority(state({ isMastered: true }), NOW);
  const notMastered = computePriority(state({ isMastered: false }), NOW);
  assert.ok(mastered < notMastered);
});

test('a run of correct answers lowers priority further with each one', () => {
  const one = computePriority(state({ consecutiveCorrect: 1 }), NOW);
  const three = computePriority(state({ consecutiveCorrect: 3 }), NOW);
  assert.ok(three < one);
});

test('priority is never negative', () => {
  const priority = computePriority(
    state({ correct: 20, incorrect: 0, attempts: 20, consecutiveCorrect: 20, isMastered: true, lastAttemptedAt: new Date(NOW) }),
    NOW,
  );
  assert.ok(priority >= 0);
});

test('the Leitner intervals grow, so a well-known question returns less often', () => {
  for (let i = 1; i < LEITNER_INTERVALS.length; i += 1) {
    assert.ok(LEITNER_INTERVALS[i] > LEITNER_INTERVALS[i - 1], `box ${i} must wait longer than box ${i - 1}`);
  }
});

/* --------------------------------------------------------- adaptive difficulty */

test('difficulty holds steady until there is enough evidence', () => {
  assert.equal(nextDifficulty([1, 1], 'medium'), 'medium');
});

test('sustained success raises the difficulty one step at a time', () => {
  assert.equal(nextDifficulty([1, 1, 1, 1, 1], 'easy'), 'medium');
  assert.equal(nextDifficulty([1, 1, 1, 1, 1], 'medium'), 'hard');
  assert.equal(nextDifficulty([1, 1, 1, 1, 1], 'hard'), 'hard');
});

test('a run of failures eases off rather than punishing', () => {
  assert.equal(nextDifficulty([0, 0, 0, 0, 0], 'hard'), 'medium');
  assert.equal(nextDifficulty([0, 0, 0, 0, 0], 'medium'), 'easy');
  assert.equal(nextDifficulty([0, 0, 0, 0, 0], 'easy'), 'easy');
});

test('middling performance leaves the difficulty where it is', () => {
  assert.equal(nextDifficulty([1, 0, 1, 0, 1], 'medium'), 'medium');
});

/* --------------------------------------------------------------------- streaks */

test('studying on consecutive days extends the streak', () => {
  const day1 = advanceStreak({ current: 0, longest: 0, lastStudyDate: null }, '2026-09-01');
  assert.equal(day1.current, 1);
  const day2 = advanceStreak(day1, '2026-09-02');
  assert.equal(day2.current, 2);
  assert.equal(day2.longest, 2);
});

test('studying twice in one day does not double-count', () => {
  const first = advanceStreak({ current: 3, longest: 5, lastStudyDate: '2026-09-01' }, '2026-09-01');
  assert.equal(first.current, 3);
});

test('a missed day resets the streak but keeps the record', () => {
  const after = advanceStreak({ current: 9, longest: 9, lastStudyDate: '2026-09-01' }, '2026-09-03');
  assert.equal(after.current, 1);
  assert.equal(after.longest, 9);
});

test('the streak survives a month boundary', () => {
  const after = advanceStreak({ current: 4, longest: 4, lastStudyDate: '2026-08-31' }, '2026-09-01');
  assert.equal(after.current, 5);
});

test('date arithmetic crosses months and years correctly', () => {
  assert.equal(addDays('2026-08-31', 1), '2026-09-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(daysBetween('2026-09-01', '2026-09-30'), 29);
  assert.equal(daysBetween('2026-09-30', '2026-09-01'), -29);
});

test('a date key is produced in the candidate timezone', () => {
  const key = localDateKey(new Date('2026-09-01T23:30:00Z'), 'Africa/Accra');
  assert.match(key, /^\d{4}-\d{2}-\d{2}$/);
});

test('the last N days are returned in order, ending today', () => {
  const keys = lastNDateKeys(7, 'Africa/Accra', new Date('2026-09-07T10:00:00Z'));
  assert.equal(keys.length, 7);
  assert.equal(keys[6], '2026-09-07');
  assert.equal(keys[0], '2026-09-01');
});

/* ------------------------------------------------------------------ readiness */

test('readiness bands rise in the documented order', () => {
  assert.equal(readinessBand(0).key, 'needs_preparation');
  assert.equal(readinessBand(39).key, 'needs_preparation');
  assert.equal(readinessBand(40).key, 'developing');
  assert.equal(readinessBand(59).key, 'developing');
  assert.equal(readinessBand(60).key, 'almost_ready');
  assert.equal(readinessBand(77).key, 'almost_ready');
  assert.equal(readinessBand(78).key, 'exam_ready');
  assert.equal(readinessBand(100).key, 'exam_ready');
});

test('a missing or nonsense readiness score falls back to the lowest band', () => {
  assert.equal(readinessBand(undefined).key, 'needs_preparation');
  assert.equal(readinessBand(NaN).key, 'needs_preparation');
});

/* ---------------------------------------------------------------- text helpers */

test('canonical form ignores case, punctuation and leading articles', () => {
  assert.equal(canonical('The Wesleyan Quadrilateral.'), canonical('wesleyan quadrilateral'));
});

test('loose equality tolerates a typo but not a different answer', () => {
  assert.ok(looselyEqual('prevenient grace', 'prevenent grace'));
  assert.ok(!looselyEqual('prevenient grace', 'justifying grace'));
});

test('loose equality is strict about very short answers', () => {
  assert.ok(!looselyEqual('Amos', 'Hos'), 'a four-letter answer must match closely');
});

test('stemming groups the forms a candidate might write', () => {
  assert.equal(stem('prophecies'), stem('prophecy'));
  assert.equal(stem('oppressed'), stem('oppress'));
});

test('slugs are url-safe and stable', () => {
  assert.equal(slugify('The Book of Amos — 4.3 Socio-Economic Situation'), 'the-book-of-amos-4-3-socio-economic-situation');
  assert.equal(slugify('  Multiple   Spaces  '), 'multiple-spaces');
});

test('truncation adds an ellipsis only when it actually cuts', () => {
  assert.equal(truncate('short', 20), 'short');
  assert.ok(truncate('a'.repeat(300), 50).endsWith('…'));
  assert.ok(truncate('a'.repeat(300), 50).length <= 50);
});
