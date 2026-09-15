#!/usr/bin/env node
/**
 * Import historical past-paper text as review-only question records.
 * Answer keys are deliberately omitted because the papers contain no keys.
 *
 *   node scripts/ingest/pastpaper-review.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourceDir = path.join(root, 'data', 'part2', 'pastpapers');
const genDir = path.join(root, 'data', 'part2', 'gen');

const SUBJECTS = new Set(['CS', 'DOC', 'LIT', 'MS', 'NT', 'OT']);
const YEARS = new Set(['2009', '2010', '2011', '2012', '2013', '2014']);
const HEADER = /^(?:New Testament|Old Testament|Doctrine|Liturgics|Methodist Studies|Church(?: and| &) Society)/i;
const OPTION = /^\s*([A-H])(?:[.)]|\s+-)\s*(.*)$/i;
const QUESTION = /^\s*(\d{1,3})[.)]\s+(.*)$/;

const readJson = (file) => {
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (Array.isArray(payload)) return payload;
  return ['objective', 'theory', 'questions', 'items']
    .flatMap((key) => (Array.isArray(payload?.[key]) ? payload[key] : []));
};
const clean = (value) => value.replace(/[\u0000\u001f]/g, '').replace(/\s+/g, ' ').trim();
const files = fs.readdirSync(genDir).filter((file) => file.startsWith('questions.') && file.endsWith('.json'));
const existingIds = new Set();
for (const file of files.filter((name) => !name.includes('-past-review'))) {
  for (const row of readJson(path.join(genDir, file))) existingIds.add(row.questionId);
}

function paperKey(file) {
  const match = file.match(/^(CS|DOC|LIT|MS|NT|OT)-(\d{4})-([a-z]+)-/i);
  return match ? `${match[1].toUpperCase()}|${match[2]}|${match[3].toLowerCase()}` : null;
}

function parsePaper(text) {
  const rows = [];
  let section = 'Section A';
  let current = null;
  let option = null;

  const flush = () => {
    if (!current) return;
    current.question = clean(current.question);
    current.options = current.options
      .map((item) => ({ text: clean(item.text) }))
      .filter((item) => item.text)
      .slice(0, 4)
      .map((item, index) => ({ key: String.fromCharCode(65 + index), text: item.text }));
    if (current.question) rows.push(current);
    current = null;
    option = null;
  };

  for (const rawLine of text
    .split(/\r?\n/)
    .flatMap((line) => line.replace(/\s+(?=\d{1,3}[.)]\s+)/g, '\n').split('\n'))) {
    const line = rawLine.trim();
    if (!line) continue;
    const sectionMatch = line.match(/^SECTION\s+([A-Z])/i);
    if (sectionMatch) {
      flush();
      section = `Section ${sectionMatch[1].toUpperCase()}`;
      continue;
    }
    if (HEADER.test(line) || /^Page \d+ of/i.test(line) || /^NAME[: ]/i.test(line) || /^DIOCESE/i.test(line)) continue;

    const questionMatch = line.match(QUESTION);
    if (questionMatch) {
      flush();
      current = { number: questionMatch[1], question: questionMatch[2], options: [], section };
      continue;
    }
    const optionMatch = line.match(OPTION);
    if (optionMatch && current) {
      const markers = [...line.matchAll(/(?:^|\s)([A-H])(?:[.)])\s*/gi)];
      if (markers.length > 1) {
        option = null;
        for (let index = 0; index < markers.length; index += 1) {
          const textStart = markers[index].index + markers[index][0].length;
          const textEnd = index + 1 < markers.length ? markers[index + 1].index : line.length;
          current.options.push({ key: markers[index][1].toUpperCase(), text: line.slice(textStart, textEnd) });
        }
      } else {
        option = { key: optionMatch[1].toUpperCase(), text: optionMatch[2] };
        current.options.push(option);
      }
      continue;
    }
    if (current) {
      if (option) option.text += ` ${line}`;
      else current.question += ` ${line}`;
    }
  }
  flush();
  return rows;
}

function normaliseSection(rows) {
  const counters = { 'Section A': 0, 'Section B': 0, 'Section C': 0, 'Section D': 0 };
  return rows.map((row) => {
    const section = row.section.replace(/\s+/g, ' ');
    const key = counters[section] === undefined ? 'Section A' : section;
    counters[key] += 1;
    const questionNumber = String(counters[key]).padStart(2, '0');
    const isObjective = key === 'Section A' && row.options.length >= 2;
    const isTrueFalse = row.options.length === 2 && row.options.every((item) => /^(true|false)$/i.test(item.text));
    return {
      ...row,
      questionNumber,
      questionType: isObjective ? (isTrueFalse ? 'true_false' : 'multiple_choice') : 'theory',
      sectionLabel: key,
    };
  });
}

const grouped = new Map();
for (const file of fs.readdirSync(sourceDir).filter((name) => name.endsWith('.txt'))) {
  const key = paperKey(file);
  if (!key) continue;
  const [subject, year, sitting] = key.split('|');
  if (!SUBJECTS.has(subject) || !YEARS.has(year)) continue;
  const bucket = grouped.get(key) || [];
  bucket.push(path.join(sourceDir, file));
  grouped.set(key, bucket);
}

const generated = new Map();
for (const [key, paperFiles] of grouped) {
  const [subject, year, sitting] = key.split('|');
  const sourceRows = normaliseSection(parsePaper(paperFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n')));
  const rows = [];
  for (const row of sourceRows) {
    const id = `${subject}-P-${year}${sitting[0].toUpperCase()}-${row.sectionLabel === 'Section A' ? 'A' : 'T'}${row.questionNumber}`;
    if (existingIds.has(id)) continue;
    const theory = row.questionType === 'theory';
    rows.push({
      questionId: id,
      examStage: 'PART2',
      subject,
      questionType: row.questionType,
      question: row.question,
      ...(theory ? { marks: 25, idealAnswer: '', keyPoints: [], markingRubric: [] } : { options: row.options }),
      explanation: '',
      manualReference: { excerpt: '', citation: '' },
      scriptureReferences: [],
      difficulty: 'medium',
      tags: ['past-paper', 'historical', 'needs-review'],
      sourceKind: 'past_paper',
      source: {
        label: `${subject} Part II - ${sitting[0].toUpperCase() + sitting.slice(1)} ${year}`,
        paperCode: subject,
        year: Number(year),
        sitting: sitting[0].toUpperCase() + sitting.slice(1),
        sectionLabel: row.sectionLabel,
        questionNumber: row.number,
      },
      answerConfidence: 'unverified',
      status: 'needs_review',
      reviewNotes: 'Transcribed from the supplied past paper; the paper contains no answer key and the syllabus has not yet been checked for a defensible answer.',
    });
    existingIds.add(id);
  }
  if (rows.length) generated.set(key, rows);
}

const bySubject = new Map();
for (const [key, rows] of generated) {
  const subject = key.split('|')[0];
  bySubject.set(subject, [...(bySubject.get(subject) || []), ...rows]);
}

for (const [subject, rows] of bySubject) {
  const file = path.join(genDir, `questions.${subject}-past-review.json`);
  fs.writeFileSync(file, `${JSON.stringify(rows, null, 1)}\n`);
  console.log(`${subject}: added ${rows.length} review rows`);
}

console.log(`Generated ${[...generated.values()].reduce((sum, rows) => sum + rows.length, 0)} review rows.`);