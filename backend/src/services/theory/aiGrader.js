import { env, aiEnabled } from '../../config/env.js';
import { logger } from '../../config/logger.js';

/**
 * Optional AI marking, strictly bounded.
 *
 * The model is given the question, the examiner's ideal answer, the marking
 * rubric and the syllabus excerpt behind the question, and is asked one thing:
 * decide whether the candidate's answer covers each rubric criterion. It is
 * explicitly forbidden from introducing doctrine of its own, from marking
 * against anything but the supplied rubric, and from guessing — if the supplied
 * material is not enough to judge a criterion it must say so, and the platform
 * falls back to the deterministic engine rather than inventing a mark.
 */

const SYSTEM_PROMPT = `You are marking one answer in a Methodist Church Ghana Lay Preachers' Examination.

You are given: the question, the examiner's ideal answer, the marking rubric, and the excerpt from the official syllabus that the question is based on.

Your ONLY task is to decide, for each rubric criterion, whether the candidate's answer covers it.

Rules you must follow:
1. Mark ONLY against the supplied rubric and ideal answer. Never introduce doctrine, facts, or standards of your own.
2. Never decide what Methodist teaching is. If the candidate writes something the supplied material does not address, that is neither credited nor penalised - note it in "notes".
3. Reward substance, not vocabulary. A criterion is covered if the candidate expresses the idea in their own words.
4. Do not credit a criterion because the candidate used a keyword in an unrelated sentence.
5. For each criterion quote the candidate's own words as evidence. If you cannot quote them, the criterion is not covered.
6. If the supplied material is insufficient to judge a criterion, set its verdict to "inconclusive" rather than guessing.
7. Award only the marks the rubric allows: full for "covered", half (rounded to 1 decimal) for "partial", zero for "missing".

Respond with JSON only, matching exactly this shape:
{
  "criteria": [
    { "id": "...", "verdict": "covered|partial|missing|inconclusive", "marksAwarded": 0, "evidence": "quoted from the candidate", "guidance": "what was missing, addressed to the candidate" }
  ],
  "feedback": "two or three sentences addressed to the candidate",
  "notes": "anything the rubric did not cover, or empty",
  "confidence": "high|medium|low"
}`;

export async function gradeWithAI(question, answerText) {
  if (!aiEnabled()) return null;

  const rubric = (question.markingRubric || []).map((c) => ({
    id: c.id,
    label: c.label,
    description: c.description || '',
    marks: c.marks,
  }));
  if (!rubric.length) return null;

  const payload = {
    question: question.prompt,
    marksAvailable: rubric.reduce((s, c) => s + c.marks, 0),
    idealAnswer: question.idealAnswer || '',
    keyPoints: question.keyPoints || [],
    rubric,
    syllabusExcerpt: question.manualReference?.excerpt || '',
    syllabusCitation: question.manualReference?.citation || '',
    candidateAnswer: answerText,
  };

  try {
    const raw = await callAnthropic(payload);
    return normalise(raw, rubric, answerText);
  } catch (err) {
    logger.warn('AI marking unavailable, falling back to the rubric engine', err);
    return null;
  }
}

async function callAnthropic(payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: env.ANTHROPIC_MODEL,
        max_tokens: 2000,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: JSON.stringify(payload) }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API responded ${response.status}: ${await response.text()}`);
    }
    const body = await response.json();
    const text = (body.content || []).map((part) => part.text || '').join('');
    return parseJson(text);
  } finally {
    clearTimeout(timer);
  }
}

function parseJson(text) {
  const trimmed = String(text).trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('AI response contained no JSON object');
  return JSON.parse(trimmed.slice(start, end + 1));
}

/**
 * Never trust the model's arithmetic or its criterion list. Marks are clamped
 * to the rubric, unknown ids are discarded, and "inconclusive" scores zero
 * while lowering the confidence of the whole evaluation.
 */
function normalise(raw, rubric, answerText) {
  const byId = new Map(rubric.map((c) => [c.id, c]));
  let inconclusive = 0;

  const criteria = rubric.map((criterion) => {
    const given = (raw.criteria || []).find((c) => c.id === criterion.id) || {};
    let verdict = ['covered', 'partial', 'missing', 'inconclusive'].includes(given.verdict) ? given.verdict : 'missing';
    if (verdict === 'inconclusive') inconclusive += 1;

    // Evidence is mandatory for credit: no quote, no marks.
    const evidence = String(given.evidence || '').trim();
    if ((verdict === 'covered' || verdict === 'partial') && !quoteIsPresent(evidence, answerText)) {
      verdict = 'missing';
    }

    const marksAwarded =
      verdict === 'covered'
        ? criterion.marks
        : verdict === 'partial'
          ? Math.round((criterion.marks / 2) * 10) / 10
          : 0;

    return {
      id: criterion.id,
      label: criterion.label,
      marksAvailable: criterion.marks,
      marksAwarded,
      verdict: verdict === 'inconclusive' ? 'missing' : verdict,
      evidence: verdict === 'missing' ? '' : evidence,
      guidance: String(given.guidance || '').trim(),
    };
  });

  const marksAvailable = rubric.reduce((s, c) => s + c.marks, 0);
  const marksAwarded = Math.round(criteria.reduce((s, c) => s + c.marksAwarded, 0) * 10) / 10;

  let confidence = ['high', 'medium', 'low'].includes(raw.confidence) ? raw.confidence : 'medium';
  if (inconclusive > rubric.length / 2) confidence = 'inconclusive';
  else if (inconclusive > 0 && confidence === 'high') confidence = 'medium';

  return {
    engine: 'ai',
    marksAwarded,
    marksAvailable,
    percentage: marksAvailable ? Math.round((marksAwarded / marksAvailable) * 100) : 0,
    criteria,
    covered: criteria.filter((c) => c.verdict === 'covered').map((c) => c.label),
    partial: criteria.filter((c) => c.verdict === 'partial').map((c) => c.label),
    missing: criteria.filter((c) => c.verdict === 'missing').map((c) => c.label),
    feedback: String(raw.feedback || '').trim(),
    confidence,
    engineNotes: String(raw.notes || '').trim(),
    wordCount: String(answerText).split(/\s+/).filter(Boolean).length,
    inconclusiveCount: inconclusive,
  };
}

/** Guards against a model fabricating a quotation the candidate never wrote. */
function quoteIsPresent(evidence, answerText) {
  if (!evidence) return false;
  const needle = evidence.replace(/^…|…$/g, '').trim().toLowerCase();
  if (needle.length < 8) return false;
  const haystack = String(answerText).toLowerCase();
  if (haystack.includes(needle)) return true;
  // Allow for light paraphrase of the quote: require most words to be present.
  const words = needle.split(/\s+/).filter((w) => w.length > 3);
  if (!words.length) return false;
  const present = words.filter((w) => haystack.includes(w)).length;
  return present / words.length >= 0.7;
}
