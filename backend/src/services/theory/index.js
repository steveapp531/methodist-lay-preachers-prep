import { aiEnabled } from '../../config/env.js';
import { TheoryEvaluation } from '../../models/TheoryEvaluation.js';
import { Topic } from '../../models/Topic.js';
import { evaluateWithRubric } from './rubricEngine.js';
import { gradeWithAI } from './aiGrader.js';

/**
 * Marks one theory answer and persists the evaluation.
 *
 * Order of preference:
 *   1. AI grading, if configured AND it returns a confident, evidence-backed result.
 *   2. The deterministic rubric engine, always available.
 *
 * When AI grading returns something inconclusive, the rubric result is used and
 * the fact is recorded, so a candidate is never shown a mark that nothing stands
 * behind.
 */
export async function evaluateTheoryAnswer({
  question,
  answerText,
  user,
  examAttempt = null,
  quiz = null,
  viaVoice = false,
  persist = true,
}) {
  const rubricResult = evaluateWithRubric(question, answerText);

  let chosen = rubricResult;
  let engine = 'rubric';

  if (aiEnabled() && String(answerText || '').trim()) {
    const aiResult = await gradeWithAI(question, answerText);
    if (aiResult && aiResult.confidence !== 'inconclusive') {
      chosen = aiResult;
      engine = 'ai';
    } else if (aiResult) {
      chosen = { ...rubricResult, engineNotes: [rubricResult.engineNotes, 'AI marking was inconclusive; the rubric engine marked this answer.'].filter(Boolean).join(' ') };
      engine = 'ai_with_rubric_fallback';
    }
  }

  const suggestedRevisionTopics = await suggestRevision(question, chosen);

  const payload = {
    user: user._id ?? user,
    question: question._id,
    examAttempt,
    quiz,
    answerText: String(answerText || ''),
    viaVoice,
    wordCount: chosen.wordCount ?? 0,
    marksAwarded: chosen.marksAwarded,
    marksAvailable: chosen.marksAvailable,
    percentage: chosen.percentage,
    criteria: chosen.criteria,
    covered: chosen.covered,
    partial: chosen.partial,
    missing: chosen.missing,
    feedback: chosen.feedback,
    suggestedRevisionTopics,
    engine,
    confidence: chosen.confidence,
    engineNotes: chosen.engineNotes || '',
    gradedAt: new Date(),
  };

  if (!persist) return { evaluation: payload, document: null };

  const document = await TheoryEvaluation.create(payload);
  return { evaluation: document.toObject(), document };
}

/** Points the candidate back at the exact topic the question came from. */
async function suggestRevision(question, result) {
  if (!question.topic) return [];
  if (!result.missing?.length && !result.partial?.length) return [];
  const topic = await Topic.findById(question.topic).select('_id').lean();
  return topic ? [topic._id] : [];
}

export { evaluateWithRubric } from './rubricEngine.js';
export { gradeWithAI } from './aiGrader.js';
