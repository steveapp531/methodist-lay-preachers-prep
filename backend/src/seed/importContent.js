import fs from 'node:fs/promises';
import path from 'node:path';
import { CONTENT_STATUS } from '../../../shared/constants.js';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { logger } from '../config/logger.js';
import { importQuestions } from '../services/importService.js';

/**
 * Imports a question file from the command line.
 *
 *   node src/seed/importContent.js ../data/part2/questions.mine.json
 *   node src/seed/importContent.js my-questions.csv --dry-run
 *   node src/seed/importContent.js my-questions.json --publish
 *
 * CSV is accepted for convenience: pipe-separate list columns such as options
 * and tags, and use dotted headers (source.year) for nested fields.
 */
async function main() {
  const file = process.argv[2];
  if (!file) {
    logger.error('Usage: node src/seed/importContent.js <file.json|file.csv> [--dry-run] [--publish]');
    process.exit(1);
  }

  const dryRun = process.argv.includes('--dry-run');
  const defaultStatus = process.argv.includes('--publish') ? CONTENT_STATUS.PUBLISHED : CONTENT_STATUS.DRAFT;

  const absolute = path.resolve(process.cwd(), file);
  const raw = await fs.readFile(absolute, 'utf8');
  const rows = absolute.endsWith('.csv') ? parseCsv(raw) : JSON.parse(raw);

  if (!Array.isArray(rows)) {
    logger.error('The file must contain an array of question records.');
    process.exit(1);
  }

  await connectDatabase();
  logger.info(`Importing ${rows.length} rows from ${path.basename(absolute)}${dryRun ? ' (dry run)' : ''}…`);

  const result = await importQuestions({ rows, dryRun, defaultStatus });

  logger.info(`Total ${result.total} · created ${result.created} · updated ${result.updated} · skipped ${result.skipped}`);
  if (result.warnings.length) {
    logger.warn(`${result.warnings.length} rows imported with warnings:`);
    result.warnings.slice(0, 10).forEach((w) => logger.warn(`  line ${w.line}: ${w.warnings.join(' ')}`));
  }
  if (result.errors.length) {
    logger.error(`${result.errors.length} rows were rejected:`);
    result.errors.slice(0, 20).forEach((e) => logger.error(`  line ${e.line}: ${e.problems.join(' ')}`));
    if (result.errors.length > 20) logger.error(`  …and ${result.errors.length - 20} more`);
  }

  await disconnectDatabase();
  process.exit(result.errors.length && !result.created && !result.updated ? 1 : 0);
}

/** Small CSV reader: quoted fields, embedded commas and newlines, dotted headers. */
function parseCsv(text) {
  const rows = [];
  let field = '';
  let record = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      record.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      record.push(field);
      rows.push(record);
      record = [];
      field = '';
    } else field += ch;
  }
  if (field || record.length) {
    record.push(field);
    rows.push(record);
  }

  const [header, ...body] = rows.filter((r) => r.some((c) => String(c).trim()));
  if (!header) return [];

  return body.map((cells) => {
    const out = {};
    header.forEach((column, i) => {
      const key = column.trim();
      const value = (cells[i] ?? '').trim();
      if (!key || value === '') return;
      // Dotted headers build nested objects: "source.year" → { source: { year } }
      const parts = key.split('.');
      let target = out;
      parts.forEach((part, index) => {
        if (index === parts.length - 1) target[part] = value;
        else {
          target[part] = target[part] || {};
          target = target[part];
        }
      });
    });
    return out;
  });
}

main().catch(async (err) => {
  logger.error('Import failed', err);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
