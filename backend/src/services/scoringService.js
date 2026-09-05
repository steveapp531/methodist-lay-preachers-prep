import { QUESTION_TYPES } from '../../../shared/constants.js';
import { canonical, looselyEqual } from '../utils/text.js';

/**
 * Objective marking.
 *
 * Every type returns the same shape so callers never branch on question type:
 *   { isCorrect, score (0..1), marksAwarded, marksAvailable, detail }
 *
 * Partial credit is given for multiple-response questions using a
 * "right answers minus wrong answers" rule, floored at zero, which is the
 * convention used in most written examinations.
 */
export function gradeObjective(question, response = {}) {
  const marksAvailable = question.totalMarks ?? question.marks ?? 1;
  const empty = { isCorrect: false, score: 0, marksAwarded: 0, marksAvailable, detail: { reason: 'no_answer' } };

  switch (question.type) {
    case QUESTION_TYPES.MULTIPLE_CHOICE:
    case QUESTION_TYPES.TRUE_FALSE: {
      const selected = firstKey(response.selectedOptionKeys);
      if (!selected) return empty;
      const correct = correctKeys(question);
      const isCorrect = correct.includes(selected);
      return {
        isCorrect,
        score: isCorrect ? 1 : 0,
        marksAwarded: isCorrect ? marksAvailable : 0,
        marksAvailable,
        detail: { selected: [selected], correct },
      };
    }

    case QUESTION_TYPES.MULTIPLE_RESPONSE: {
      const selected = uniqueKeys(response.selectedOptionKeys);
      if (!selected.length) return empty;
      const correct = correctKeys(question);
      if (!correct.length) return { ...empty, detail: { reason: 'no_key_recorded' } };

      const hits = selected.filter((k) => correct.includes(k)).length;
      const misses = selected.filter((k) => !correct.includes(k)).length;
      const raw = Math.max(0, hits - misses) / correct.length;
      const isCorrect = hits === correct.length && misses === 0;
      return {
        isCorrect,
        score: raw,
        marksAwarded: round2(raw * marksAvailable),
        marksAvailable,
        detail: { selected, correct, hits, misses },
      };
    }

    case QUESTION_TYPES.FILL_BLANK: {
      const given = String(response.textAnswer || '').trim();
      if (!given) return empty;
      const accepted = question.acceptedAnswers || [];
      const isCorrect = accepted.some((candidate) => looselyEqual(given, candidate));
      return {
        isCorrect,
        score: isCorrect ? 1 : 0,
        marksAwarded: isCorrect ? marksAvailable : 0,
        marksAvailable,
        detail: { given, accepted, matchedOn: isCorrect ? accepted.find((c) => looselyEqual(given, c)) : null },
      };
    }

    case QUESTION_TYPES.MATCHING: {
      const pairs = question.matchPairs || [];
      if (!pairs.length) return { ...empty, detail: { reason: 'no_pairs_recorded' } };
      const answer = toPlainMap(response.matchAnswer);
      if (!Object.keys(answer).length) return empty;

      let hits = 0;
      const perPair = pairs.map((pair) => {
        const given = answer[pair.left];
        const correct = given != null && canonical(given) === canonical(pair.right);
        if (correct) hits += 1;
        return { left: pair.left, given: given ?? null, expected: pair.right, correct };
      });
      const raw = hits / pairs.length;
      return {
        isCorrect: hits === pairs.length,
        score: raw,
        marksAwarded: round2(raw * marksAvailable),
        marksAvailable,
        detail: { pairs: perPair, hits, total: pairs.length },
      };
    }

    default:
      throw new Error(`gradeObjective cannot mark question type "${question.type}"`);
  }
}

function correctKeys(question) {
  if (question.correctOptionKeys?.length) return [...question.correctOptionKeys];
  return (question.options || []).filter((o) => o.isCorrect).map((o) => o.key);
}

function firstKey(value) {
  if (Array.isArray(value)) return value[0] ? String(value[0]).trim().toUpperCase() : null;
  return value ? String(value).trim().toUpperCase() : null;
}

function uniqueKeys(value) {
  const arr = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(arr.map((v) => String(v).trim().toUpperCase()).filter(Boolean))];
}

function toPlainMap(value) {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value);
  return { ...value };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/** True when this question can be marked without human or AI judgement. */
export function isAutoMarkable(question) {
  return question.type !== QUESTION_TYPES.THEORY;
}
