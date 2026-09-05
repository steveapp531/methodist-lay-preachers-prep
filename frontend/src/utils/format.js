/** Display helpers shared across screens. */

export function percent(value, { fromFraction = true, decimals = 0 } = {}) {
  if (value == null || Number.isNaN(value)) return '—';
  const n = fromFraction ? value * 100 : value;
  return `${n.toFixed(decimals)}%`;
}

export function plural(count, singular, pluralForm) {
  return `${count} ${count === 1 ? singular : pluralForm || `${singular}s`}`;
}

export function minutesLabel(minutes) {
  if (!minutes) return '0 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function relativeTime(value) {
  if (!value) return '';
  const then = new Date(value).getTime();
  const diff = Date.now() - then;
  const minutes = Math.round(diff / 60000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDate(value);
}

export function formatDate(value, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-GB', options).format(new Date(value));
}

export function formatDateTime(value) {
  return formatDate(value, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Presentation tone for an accuracy or mastery figure, 0..1. */
export function accuracyTone(fraction) {
  if (fraction == null) return 'neutral';
  if (fraction >= 0.8) return 'success';
  if (fraction >= 0.6) return 'warning';
  return 'danger';
}

export function masteryTone(masteryOutOf100) {
  return accuracyTone((masteryOutOf100 ?? 0) / 100);
}

export const PROGRESS_STATUS_LABELS = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  needs_revision: 'Needs revision',
};

export const PROGRESS_STATUS_TONES = {
  not_started: 'neutral',
  in_progress: 'brand',
  completed: 'success',
  needs_revision: 'warning',
};

export const QUESTION_TYPE_LABELS = {
  multiple_choice: 'Multiple choice',
  true_false: 'True or false',
  multiple_response: 'Multiple response',
  fill_blank: 'Fill in the blank',
  matching: 'Matching',
  theory: 'Theory',
};

export const DIFFICULTY_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
export const DIFFICULTY_TONES = { easy: 'success', medium: 'warning', hard: 'danger' };

/** Turns a manual reference object into one readable line. */
export function citationLine(reference) {
  if (!reference) return '';
  const parts = [];
  if (reference.subjectName) parts.push(reference.subjectName);
  if (reference.chapterTitle) parts.push(reference.chapterTitle);
  if (reference.topicTitle) parts.push(reference.topicTitle);
  const base = parts.join(' — ');
  if (reference.pageNumber) return `${base} (page ${reference.pageNumber})`;
  return base || reference.citation || '';
}

export function initials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}
