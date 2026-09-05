#!/usr/bin/env node
/**
 * Redistributes correct answers across the option positions.
 *
 *   node scripts/shuffle-options.mjs [--write]
 *
 * Questions written from the syllabus put the correct answer at option A about
 * 98% of the time, because that is the order an author naturally writes them
 * in. A candidate practising against that learns "choose A", which is worse
 * than useless in the examination hall.
 *
 * What is NOT shuffled, and why:
 *
 *  - **Past-paper questions.** Their option order is part of the historical
 *    record; the real papers already distribute answers evenly (A 20%, B 28%,
 *    C 28%, D 19%), so there is nothing to fix and reordering them would
 *    misrepresent the source.
 *  - **True/false.** Two options whose order carries meaning.
 *  - **Positional options** — "All of the above", "None of the above",
 *    "Both A and B" — which only make sense in a fixed place. A question
 *    containing one keeps that option pinned to the end, and any option that
 *    names another option's letter freezes the whole question.
 *
 * The shuffle is seeded from the question id, so it is deterministic: running
 * this twice produces the same arrangement, and the result can be reviewed in a
 * diff rather than changing on every run.
 *
 * Runs as a dry run unless --write is passed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const genDir = path.join(root, 'data', 'part2', 'gen');
const WRITE = process.argv.includes('--write');

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/** Options that only make sense in a fixed position. */
const POSITIONAL = /^\s*(all|none|any|both|neither)\s+of\s+the\s+(above|following)|^\s*all\s+of\s+these|^\s*none\s+of\s+these|^\s*(both|either|neither)\s+[a-d]\s*(and|or|nor)\s*[a-d]\b/i;

/** An option that refers to another option by letter freezes the question. */
const REFERS_TO_LETTER = /\b(option|options|answers?)\s+[a-d]\b|\b[a-d]\s+(and|or)\s+[a-d]\s+(only|above)\b/i;

/** Deterministic PRNG seeded from a string, so runs are reproducible. */
function seeded(seedString) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedString.length; i += 1) {
    h ^= seedString.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return () => {
    h ^= h << 13;
    h >>>= 0;
    h ^= h >> 17;
    h ^= h << 5;
    h >>>= 0;
    return h / 4294967296;
  };
}

function shuffleInPlace(items, rand) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

const files = fs.readdirSync(genDir).filter((f) => f.startsWith('questions.') && f.endsWith('.json'));

const before = {};
const after = {};
let considered = 0;
let shuffled = 0;
let frozen = 0;
let skippedPastPaper = 0;
let keysNormalised = 0;
let keysSynced = 0;

const tally = (bucket, q) => {
  const correct = (q.options || []).find((o) => o.isCorrect);
  if (!correct) return;
  const key = String(correct.key).toUpperCase();
  bucket[key] = (bucket[key] || 0) + 1;
};

for (const file of files) {
  const full = path.join(genDir, file);
  const payload = JSON.parse(fs.readFileSync(full, 'utf8'));
  const rows = Array.isArray(payload) ? payload : [...(payload.objective || []), ...(payload.theory || [])];
  let touched = false;

  for (const q of rows) {
    const type = q.questionType || q.type;
    if (type !== 'multiple_choice' && type !== 'multiple_response') continue;
    if (!Array.isArray(q.options) || q.options.length < 3) continue;

    tally(before, q);

    // Normalise stray lowercase keys regardless of whether we reorder.
    const hadLowercase = q.options.some((o) => o.key !== String(o.key).toUpperCase());
    if (hadLowercase) {
      q.options.forEach((o) => { o.key = String(o.key).toUpperCase(); });
      if (Array.isArray(q.correctOptionKeys)) {
        q.correctOptionKeys = q.correctOptionKeys.map((k) => String(k).toUpperCase());
      }
      keysNormalised += 1;
      touched = true;
    }

    // Keep the answer key and the option flags in step. The past-paper
    // transcriptions set only the flags; both the importer and the scorer cope
    // with that, but a uniform shape keeps exports and the admin editor honest.
    const flagged = q.options.filter((o) => o.isCorrect).map((o) => o.key);
    if (flagged.length && JSON.stringify(flagged) !== JSON.stringify(q.correctOptionKeys || [])) {
      q.correctOptionKeys = flagged;
      keysSynced += 1;
      touched = true;
    }

    if (q.sourceKind === 'past_paper') {
      skippedPastPaper += 1;
      tally(after, q);
      continue;
    }

    considered += 1;

    const anyReferences = q.options.some((o) => REFERS_TO_LETTER.test(o.text)) || REFERS_TO_LETTER.test(q.question || '');
    if (anyReferences) {
      frozen += 1;
      tally(after, q);
      continue;
    }

    const movable = q.options.filter((o) => !POSITIONAL.test(o.text));
    const pinned = q.options.filter((o) => POSITIONAL.test(o.text));
    if (movable.length < 2) {
      frozen += 1;
      tally(after, q);
      continue;
    }

    // Shuffle from a canonical starting order, not from whatever order the
    // options happen to be in now. Without this the script is not idempotent:
    // a second run reshuffles the first run's output and the distribution
    // drifts back towards being lopsided.
    movable.sort((a, b) => a.text.localeCompare(b.text));
    const rand = seeded(q.questionId || q.question || file);
    shuffleInPlace(movable, rand);

    // Positional options always sit at the end, in their original order.
    const reordered = [...movable, ...pinned];
    reordered.forEach((option, index) => {
      option.key = LETTERS[index];
    });

    q.options = reordered;
    q.correctOptionKeys = reordered.filter((o) => o.isCorrect).map((o) => o.key);

    shuffled += 1;
    touched = true;
    tally(after, q);
  }

  if (touched && WRITE) {
    const out = Array.isArray(payload) ? rows : payload;
    fs.writeFileSync(full, `${JSON.stringify(out, null, 1)}\n`);
  }
}

const pct = (bucket) => {
  const total = Object.values(bucket).reduce((a, b) => a + b, 0) || 1;
  return LETTERS.slice(0, 4)
    .map((k) => `${k} ${((100 * (bucket[k] || 0)) / total).toFixed(0)}%`)
    .join('  ');
};

console.log(`Objective questions seen : ${Object.values(before).reduce((a, b) => a + b, 0)}`);
console.log(`  past-paper, left as-is : ${skippedPastPaper}`);
console.log(`  eligible to shuffle    : ${considered}`);
console.log(`    reordered            : ${shuffled}`);
console.log(`    frozen (positional)  : ${frozen}`);
console.log(`  keys normalised        : ${keysNormalised}`);
console.log(`  answer keys synced     : ${keysSynced}`);
console.log();
console.log(`Correct answer position, before : ${pct(before)}`);
console.log(`Correct answer position, after  : ${pct(after)}`);
console.log(WRITE ? '\nFiles rewritten. Re-run scripts/merge-content.mjs.' : '\nDry run. Pass --write to apply.');
