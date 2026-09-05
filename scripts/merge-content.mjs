#!/usr/bin/env node
/**
 * Merges the per-subject question and flashcard files in `data/part2/gen/`
 * into the two files the seed script reads:
 *
 *   data/part2/questions.manual.json
 *   data/part2/flashcards.json
 *
 * Run after adding or regenerating any per-subject file:
 *   node scripts/merge-content.mjs
 *
 * It refuses to write on a duplicate id, because a duplicate would silently
 * overwrite an existing question on the next import.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const genDir = path.join(root, 'data', 'part2', 'gen');
const outDir = path.join(root, 'data', 'part2');

/** Accepts either a bare array or an envelope such as { objective, theory } / { cards }. */
function flatten(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const rows = [];
  for (const key of ['objective', 'theory', 'questions', 'cards', 'flashcards', 'items']) {
    if (Array.isArray(payload[key])) rows.push(...payload[key]);
  }
  return rows;
}

function collect(prefix, idField) {
  if (!fs.existsSync(genDir)) return { rows: [], report: [] };
  const files = fs
    .readdirSync(genDir)
    .filter((f) => f.startsWith(`${prefix}.`) && f.endsWith('.json'))
    .sort();

  const rows = [];
  const report = [];
  const seen = new Map();

  for (const file of files) {
    const payload = JSON.parse(fs.readFileSync(path.join(genDir, file), 'utf8'));
    const items = flatten(payload);
    for (const item of items) {
      const id = item[idField];
      if (!id) throw new Error(`${file}: a record is missing ${idField}`);
      if (seen.has(id)) throw new Error(`Duplicate ${idField} "${id}" in ${file} (already in ${seen.get(id)})`);
      seen.set(id, file);
      rows.push(item);
    }
    report.push({ file, count: items.length });
  }
  return { rows, report };
}

const questions = collect('questions', 'questionId');
const flashcards = collect('flashcards', 'cardId');

fs.writeFileSync(path.join(outDir, 'questions.manual.json'), `${JSON.stringify(questions.rows, null, 1)}\n`);
fs.writeFileSync(path.join(outDir, 'flashcards.json'), `${JSON.stringify(flashcards.rows, null, 1)}\n`);

const byType = questions.rows.reduce((acc, q) => {
  const key = q.questionType || q.type || 'unknown';
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});
const bySubject = questions.rows.reduce((acc, q) => {
  acc[q.subject] = (acc[q.subject] || 0) + 1;
  return acc;
}, {});

console.log('Questions');
questions.report.forEach((r) => console.log(`  ${r.file.padEnd(24)} ${String(r.count).padStart(4)}`));
console.log(`  ${'TOTAL'.padEnd(24)} ${String(questions.rows.length).padStart(4)}`);
console.log('  by subject:', bySubject);
console.log('  by type   :', byType);
console.log('\nFlashcards');
flashcards.report.forEach((r) => console.log(`  ${r.file.padEnd(24)} ${String(r.count).padStart(4)}`));
console.log(`  ${'TOTAL'.padEnd(24)} ${String(flashcards.rows.length).padStart(4)}`);
console.log('\nWrote data/part2/questions.manual.json and data/part2/flashcards.json');
