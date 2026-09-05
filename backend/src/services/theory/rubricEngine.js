import { canonical, normaliseWhitespace, stem, stemSet, tokens } from '../../utils/text.js';

/**
 * Deterministic marking of a theory answer against its stored rubric.
 *
 * The engine does not judge theology. It judges *coverage*: for each criterion
 * the examiner defined, did the candidate's answer contain the ideas that
 * criterion asks for? Every criterion carries keywords and optional groups of
 * synonyms, so a candidate who writes "atoning death" scores the same as one
 * who writes "expiatory sacrifice" if the rubric lists both.
 *
 * Scoring per criterion:
 *   covered  → full marks   (enough distinct required ideas present)
 *   partial  → half marks   (some present)
 *   missing  → zero
 *
 * This runs with no API key and no network, so the platform always marks
 * theory answers even when AI grading is unavailable.
 */

const COVER_THRESHOLD = 0.6;
const PARTIAL_THRESHOLD = 0.25;

export function evaluateWithRubric(question, answerText) {
  const answer = normaliseWhitespace(answerText);
  const rubric = normaliseRubric(question);
  const marksAvailable = rubric.reduce((sum, c) => sum + c.marks, 0) || question.marks || 0;

  if (!answer) {
    return emptyResult(rubric, marksAvailable, 'No answer was submitted.');
  }

  const answerStems = stemSet(answer);
  const answerCanon = canonical(answer);
  const answerWords = tokens(answer);

  const criteria = rubric.map((criterion) => {
    const groups = criterionGroups(criterion);
    if (!groups.length) {
      // A criterion with no keywords cannot be judged mechanically.
      return {
        id: criterion.id,
        label: criterion.label,
        marksAvailable: criterion.marks,
        marksAwarded: 0,
        verdict: 'missing',
        evidence: '',
        guidance: criterion.description || `The rubric expects: ${criterion.label}.`,
        unscorable: true,
      };
    }

    let matched = 0;
    let evidence = '';
    for (const group of groups) {
      const hit = group.find((phrase) => phraseAppears(phrase, { answerCanon, answerStems }));
      if (hit) {
        matched += 1;
        if (!evidence) evidence = quoteAround(answer, hit) || '';
      }
    }

    const ratio = matched / groups.length;
    const verdict = ratio >= COVER_THRESHOLD ? 'covered' : ratio >= PARTIAL_THRESHOLD ? 'partial' : 'missing';
    const marksAwarded =
      verdict === 'covered' ? criterion.marks : verdict === 'partial' ? round1(criterion.marks / 2) : 0;

    return {
      id: criterion.id,
      label: criterion.label,
      marksAvailable: criterion.marks,
      marksAwarded,
      verdict,
      evidence,
      guidance:
        verdict === 'covered'
          ? ''
          : criterion.description || `Bring in ${describeGroups(groups)} to earn the marks for "${criterion.label}".`,
    };
  });

  // Length sanity: a two-line answer to a 25-mark essay cannot be complete,
  // regardless of keyword hits, so cap it rather than over-reward keyword bingo.
  const scorable = criteria.filter((c) => !c.unscorable);
  const rawWordCount = answer.split(/\s+/).filter(Boolean).length;
  let marksAwarded = round1(criteria.reduce((sum, c) => sum + c.marksAwarded, 0));
  const lengthCap = lengthAllowance(rawWordCount, marksAvailable);
  let engineNotes = '';
  if (marksAwarded > lengthCap) {
    engineNotes = `Answer length (${rawWordCount} words) limits the mark for a ${marksAvailable}-mark question. A fuller answer would earn more.`;
    marksAwarded = round1(lengthCap);
  }

  const covered = criteria.filter((c) => c.verdict === 'covered').map((c) => c.label);
  const partial = criteria.filter((c) => c.verdict === 'partial').map((c) => c.label);
  const missing = criteria.filter((c) => c.verdict === 'missing').map((c) => c.label);

  return {
    engine: 'rubric',
    marksAwarded,
    marksAvailable,
    percentage: marksAvailable ? Math.round((marksAwarded / marksAvailable) * 100) : 0,
    criteria: criteria.map(({ unscorable, ...rest }) => rest),
    covered,
    partial,
    missing,
    feedback: buildFeedback(covered, partial, missing, marksAwarded, marksAvailable),
    confidence: scorable.length >= 3 ? 'medium' : scorable.length ? 'low' : 'inconclusive',
    engineNotes,
    wordCount: answer.split(/\s+/).filter(Boolean).length,
  };
}

/** A rubric is required; if the question lacks one, derive it from key points. */
function normaliseRubric(question) {
  if (question.markingRubric?.length) {
    return question.markingRubric.map((c, i) => ({
      id: c.id || `c${i + 1}`,
      label: c.label,
      description: c.description || '',
      marks: c.marks ?? 1,
      keywords: c.keywords || [],
      synonyms: c.synonyms || [],
    }));
  }
  const points = question.keyPoints || [];
  if (!points.length) return [];
  const total = question.marks || points.length;
  const each = round1(total / points.length);
  return points.map((point, i) => ({
    id: `kp${i + 1}`,
    label: point.length > 70 ? `${point.slice(0, 67)}…` : point,
    description: `Cover this point: ${point}`,
    marks: each,
    keywords: tokens(point).slice(0, 6),
    synonyms: [],
  }));
}

/**
 * Each criterion becomes a list of "idea groups". A group is satisfied if any
 * of its phrasings appears; the criterion score is the fraction of groups met.
 */
function criterionGroups(criterion) {
  const groups = [];
  for (const set of criterion.synonyms || []) {
    const cleaned = (Array.isArray(set) ? set : [set]).map((s) => String(s).trim()).filter(Boolean);
    if (cleaned.length) groups.push(cleaned);
  }
  for (const keyword of criterion.keywords || []) {
    const word = String(keyword).trim();
    if (!word) continue;
    const alreadyCovered = groups.some((g) => g.some((p) => canonical(p) === canonical(word)));
    if (!alreadyCovered) groups.push([word]);
  }
  return groups;
}

function phraseAppears(phrase, { answerCanon, answerStems }) {
  const target = canonical(phrase);
  if (!target) return false;
  if (target.includes(' ')) {
    if (answerCanon.includes(target)) return true;
    // Multi-word phrase: accept if every significant word is present.
    const parts = tokens(phrase).map(stem);
    return parts.length > 0 && parts.every((p) => answerStems.has(p));
  }
  return answerStems.has(stem(target)) || answerCanon.includes(target);
}

function quoteAround(answer, phrase) {
  const canonPhrase = canonical(phrase).split(' ')[0];
  if (!canonPhrase) return '';
  const idx = answer.toLowerCase().indexOf(canonPhrase);
  if (idx === -1) return '';
  const start = Math.max(0, idx - 45);
  const end = Math.min(answer.length, idx + canonPhrase.length + 65);
  return `${start > 0 ? '…' : ''}${answer.slice(start, end).trim()}${end < answer.length ? '…' : ''}`;
}

function describeGroups(groups) {
  const labels = groups.slice(0, 3).map((g) => `"${g[0]}"`);
  return labels.join(', ') + (groups.length > 3 ? ' and related points' : '');
}

/**
 * A sanity ceiling, not a word count requirement.
 *
 * Six words per mark is well below what a candidate would actually write, so a
 * genuinely complete answer never meets this cap — it exists only to stop a
 * one-line answer that happens to contain every rubric keyword from scoring as
 * though it were a full essay. Below the threshold the allowance scales
 * linearly, with a small floor so a terse but correct answer still earns
 * something.
 */
function lengthAllowance(wordCount, marksAvailable) {
  if (!marksAvailable) return 0;
  const wordsForFullMarks = marksAvailable * 6;
  if (wordCount >= wordsForFullMarks) return marksAvailable;
  const proportion = wordCount / wordsForFullMarks;
  return Math.max(marksAvailable * 0.15, marksAvailable * proportion);
}

function buildFeedback(covered, partial, missing, awarded, available) {
  const parts = [];
  parts.push(`You scored ${awarded} out of ${available}.`);
  if (covered.length) parts.push(`Covered well: ${covered.join(', ')}.`);
  if (partial.length) parts.push(`Touched on but not developed: ${partial.join(', ')}.`);
  if (missing.length) parts.push(`Not addressed: ${missing.join(', ')}.`);
  if (!covered.length && !partial.length) {
    parts.push('Work through the ideal answer below and try the question again.');
  }
  return parts.join(' ');
}

function emptyResult(rubric, marksAvailable, note) {
  return {
    engine: 'rubric',
    marksAwarded: 0,
    marksAvailable,
    percentage: 0,
    criteria: rubric.map((c) => ({
      id: c.id,
      label: c.label,
      marksAvailable: c.marks,
      marksAwarded: 0,
      verdict: 'missing',
      evidence: '',
      guidance: c.description || '',
    })),
    covered: [],
    partial: [],
    missing: rubric.map((c) => c.label),
    feedback: note,
    confidence: 'high',
    engineNotes: note,
    wordCount: 0,
  };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}
