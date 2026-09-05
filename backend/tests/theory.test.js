import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateWithRubric } from '../src/services/theory/rubricEngine.js';

const AMOS_QUESTION = {
  type: 'theory',
  prompt: 'Describe the socio-economic situation in Israel during the ministry of Amos.',
  marks: 20,
  idealAnswer: 'Israel enjoyed great prosperity under Jeroboam II…',
  markingRubric: [
    {
      id: 'c1',
      label: 'Prosperity under Jeroboam II',
      description: 'Explains the material prosperity of the northern kingdom.',
      marks: 5,
      keywords: ['prosperity', 'Jeroboam'],
      synonyms: [['prosperity', 'affluence', 'wealth', 'riches'], ['Jeroboam II', 'Jeroboam']],
    },
    {
      id: 'c2',
      label: 'Oppression of the poor',
      description: 'Notes that the poor were exploited by the rich.',
      marks: 5,
      keywords: ['poor', 'oppression'],
      synonyms: [['oppression', 'exploited', 'trampled', 'crushed'], ['poor', 'needy', 'destitute']],
    },
    {
      id: 'c3',
      label: 'Corrupt courts',
      description: 'Notes bribery and the perversion of justice in the gate.',
      marks: 5,
      keywords: ['justice', 'bribe'],
      synonyms: [['bribe', 'bribery', 'bribes'], ['justice', 'courts', 'judgement']],
    },
    {
      id: 'c4',
      label: 'Luxury of the wealthy',
      description: 'Mentions the ivory houses, couches and feasting.',
      marks: 5,
      keywords: ['ivory', 'luxury'],
      synonyms: [['ivory houses', 'ivory'], ['luxury', 'feasting', 'couches', 'indulgence']],
    },
  ],
};

/** Long enough that the length allowance never masks what is being tested. */
function padded(core) {
  return `${core} ${'The prophet spoke plainly to the nation about these matters at some length. '.repeat(8)}`;
}

test('an empty answer scores nothing and every criterion is reported missing', () => {
  const result = evaluateWithRubric(AMOS_QUESTION, '');
  assert.equal(result.marksAwarded, 0);
  assert.equal(result.missing.length, 4);
  assert.equal(result.covered.length, 0);
});

test('an answer covering every criterion scores full marks', () => {
  const answer = padded(
    'Under Jeroboam II Israel enjoyed great prosperity and wealth. Yet the poor were oppressed and exploited by the rich. ' +
      'Justice was perverted in the courts and judges took bribes. The wealthy lived in ivory houses in great luxury, feasting on their couches.',
  );
  const result = evaluateWithRubric(AMOS_QUESTION, answer);
  assert.equal(result.marksAwarded, 20);
  assert.equal(result.covered.length, 4);
  assert.equal(result.missing.length, 0);
});

test('marking rewards the idea, not the exact word: synonyms score the same', () => {
  const withKeyword = padded(
    'Under Jeroboam II there was prosperity. The poor suffered oppression. Judges took bribes and justice failed. The rich had ivory houses and luxury.',
  );
  const withSynonyms = padded(
    'Under Jeroboam there was great affluence. The needy were trampled. Bribery corrupted the courts. The rich had ivory and feasting.',
  );
  const a = evaluateWithRubric(AMOS_QUESTION, withKeyword);
  const b = evaluateWithRubric(AMOS_QUESTION, withSynonyms);
  assert.equal(a.marksAwarded, b.marksAwarded, 'a candidate should not be penalised for their vocabulary');
});

test('an answer covering half the criteria scores about half', () => {
  const answer = padded(
    'Under Jeroboam II Israel enjoyed great prosperity and wealth. The poor were oppressed and exploited throughout the land.',
  );
  const result = evaluateWithRubric(AMOS_QUESTION, answer);
  assert.ok(result.marksAwarded >= 8 && result.marksAwarded <= 12, `expected roughly half, got ${result.marksAwarded}`);
  assert.equal(result.covered.length, 2);
  assert.equal(result.missing.length, 2);
});

test('a criterion whose ideas are only partly present earns partial credit', () => {
  // "prosperity" without "Jeroboam" meets one of the criterion's two idea groups.
  const answer = padded('There was great prosperity in the land at this time, and much trade.');
  const result = evaluateWithRubric(AMOS_QUESTION, answer);
  const criterion = result.criteria.find((c) => c.id === 'c1');
  assert.equal(criterion.verdict, 'partial');
  assert.equal(criterion.marksAwarded, 2.5);
});

test('keyword stuffing cannot beat the length allowance', () => {
  // Every keyword, but far too short to be a 20-mark answer.
  const stuffed = 'Prosperity Jeroboam poor oppression justice bribe ivory luxury.';
  const result = evaluateWithRubric(AMOS_QUESTION, stuffed);
  assert.ok(result.marksAwarded < 20, 'a one-line answer must not score full marks');
  assert.ok(result.engineNotes.includes('length'), 'the candidate should be told why');
});

test('a long, relevant answer is not capped by the length rule', () => {
  const answer = padded(
    'Under Jeroboam II Israel enjoyed great prosperity and wealth. Yet the poor were oppressed and exploited by the rich. ' +
      'Justice was perverted in the courts and judges took bribes. The wealthy lived in ivory houses in great luxury, feasting on their couches.',
  );
  const result = evaluateWithRubric(AMOS_QUESTION, answer);
  assert.equal(result.engineNotes, '');
});

test('the mark never exceeds the marks available', () => {
  const answer = padded(
    'Prosperity wealth affluence riches Jeroboam II. Poor needy destitute oppression exploited trampled crushed. ' +
      'Bribe bribery bribes justice courts judgement. Ivory houses luxury feasting couches indulgence. '.repeat(20),
  );
  const result = evaluateWithRubric(AMOS_QUESTION, answer);
  assert.ok(result.marksAwarded <= result.marksAvailable);
});

test('feedback names what was covered and what was missed', () => {
  const answer = padded('Under Jeroboam II Israel enjoyed great prosperity and wealth across the northern kingdom.');
  const result = evaluateWithRubric(AMOS_QUESTION, answer);
  assert.match(result.feedback, /Prosperity under Jeroboam II/);
  assert.match(result.feedback, /Corrupt courts/);
});

test('a covered criterion quotes the candidate back to themselves', () => {
  const answer = padded('Under Jeroboam II Israel enjoyed great prosperity and wealth in those days.');
  const result = evaluateWithRubric(AMOS_QUESTION, answer);
  const criterion = result.criteria.find((c) => c.id === 'c1');
  assert.ok(criterion.evidence.length > 0, 'evidence must come from the answer');
  assert.ok(answer.toLowerCase().includes(criterion.evidence.replace(/^…|…$/g, '').trim().toLowerCase().slice(0, 20)));
});

test('a question with only key points still gets a usable rubric', () => {
  const question = {
    type: 'theory',
    marks: 10,
    keyPoints: ['The prophetic call', 'The message of judgement', 'The call to repentance'],
    markingRubric: [],
  };
  const result = evaluateWithRubric(question, padded('Amos received a prophetic call and preached a message of judgement.'));
  assert.equal(result.criteria.length, 3);
  assert.ok(result.marksAwarded > 0);
  assert.ok(result.marksAvailable > 0);
});

test('a question with no rubric and no key points reports itself as unmarkable', () => {
  const result = evaluateWithRubric({ type: 'theory', marks: 25, keyPoints: [], markingRubric: [] }, padded('An answer.'));
  assert.equal(result.confidence, 'inconclusive');
  assert.equal(result.criteria.length, 0);
});

test('rubric marking is deterministic', () => {
  const answer = padded('Under Jeroboam II there was prosperity, and the poor were oppressed by the wealthy.');
  const first = evaluateWithRubric(AMOS_QUESTION, answer);
  const second = evaluateWithRubric(AMOS_QUESTION, answer);
  assert.deepEqual(first.criteria, second.criteria);
  assert.equal(first.marksAwarded, second.marksAwarded);
});

test('a multi-word rubric phrase matches when the words are spread across a sentence', () => {
  const question = {
    type: 'theory',
    marks: 5,
    markingRubric: [
      { id: 'c1', label: 'Wesleyan Quadrilateral', marks: 5, keywords: [], synonyms: [['Wesleyan Quadrilateral']] },
    ],
  };
  const result = evaluateWithRubric(
    question,
    padded('Wesley drew on what is now called the Quadrilateral, a fourfold Wesleyan source of authority.'),
  );
  assert.equal(result.criteria[0].verdict, 'covered');
});
