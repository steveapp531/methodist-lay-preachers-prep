/** Calendar helpers. Streaks and daily goals follow the user's own timezone. */

export function localDateKey(date = new Date(), timeZone = 'Africa/Accra') {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  }
}

export function addDays(dateKey, days) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function daysBetween(fromKey, toKey) {
  const a = Date.parse(`${fromKey}T00:00:00Z`);
  const b = Date.parse(`${toKey}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

export function lastNDateKeys(n, timeZone = 'Africa/Accra', endDate = new Date()) {
  const end = localDateKey(endDate, timeZone);
  return Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)));
}

export function daysUntil(target, timeZone = 'Africa/Accra') {
  if (!target) return null;
  const today = localDateKey(new Date(), timeZone);
  const then = localDateKey(new Date(target), timeZone);
  return daysBetween(today, then);
}

/**
 * Advance a streak given the previous study date.
 * Studying again on the same day leaves the streak unchanged.
 */
export function advanceStreak(streak, todayKey) {
  const current = streak?.current || 0;
  const longest = streak?.longest || 0;
  const last = streak?.lastStudyDate || null;

  if (last === todayKey) return { current, longest, lastStudyDate: last };

  const next = last && daysBetween(last, todayKey) === 1 ? current + 1 : 1;
  return { current: next, longest: Math.max(longest, next), lastStudyDate: todayKey };
}
