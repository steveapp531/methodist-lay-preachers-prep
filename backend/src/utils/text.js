/** Text helpers shared by the scorer, the rubric engine and search. */

const SMART_QUOTES = /[‘’‚‛′‵]/g;
const SMART_DQUOTES = /[“”„‟″‶]/g;

export function normaliseWhitespace(value) {
  return String(value ?? '')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normaliseQuotes(value) {
  return String(value ?? '').replace(SMART_QUOTES, "'").replace(SMART_DQUOTES, '"');
}

/** Aggressive form used to compare short free-text answers. */
export function canonical(value) {
  return normaliseQuotes(normaliseWhitespace(value))
    .toLowerCase()
    .replace(/[.,;:!?'"()\[\]{}]/g, '')
    .replace(/\b(the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP_WORDS = new Set(
  ('a an the and or but if then than that this these those of in on at to for from by with without into over under ' +
    'is are was were be been being am do does did doing have has had having it its as not no nor so such can could ' +
    'shall should will would may might must also very more most other some any each which who whom whose what when ' +
    'where why how all both few many own same too only just up down out about again further once he she they we you i')
    .split(' '),
);

export function tokens(value) {
  return canonical(value)
    .split(' ')
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

/** Crude but effective English stemmer for rubric keyword matching. */
export function stem(word) {
  let w = word;
  if (w.length > 5 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 5 && (w.endsWith('ing') || w.endsWith('ion'))) w = w.slice(0, -3);
  else if (w.length > 4 && (w.endsWith('ed') || w.endsWith('es') || w.endsWith('ly'))) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  return w;
}

export function stemSet(value) {
  return new Set(tokens(value).map(stem));
}

/** Levenshtein distance, bounded for speed. */
export function editDistance(a, b, max = 3) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let last = prev[0];
    prev[0] = i;
    let rowMin = prev[0];
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = tmp;
      rowMin = Math.min(rowMin, prev[j]);
    }
    if (rowMin > max) return max + 1;
  }
  return prev[b.length];
}

/** True when two short answers are the same allowing for small typos. */
export function looselyEqual(a, b) {
  const x = canonical(a);
  const y = canonical(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const tolerance = y.length > 12 ? 2 : y.length > 6 ? 1 : 0;
  return tolerance > 0 && editDistance(x, y, tolerance) <= tolerance;
}

export function slugify(value, maxLength = 80) {
  return normaliseQuotes(String(value ?? ''))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}

export function truncate(value, length = 240) {
  const text = normaliseWhitespace(value);
  return text.length <= length ? text : `${text.slice(0, length - 1).trimEnd()}…`;
}

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
