import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Icon, cx } from '@/components/ui';
import { plural } from '@/utils/format';

/**
 * Questions answered per day.
 *
 * The chart is never the only way the numbers are given: the totals are stated
 * in words above it, and the full series is available to a screen reader as a
 * plain list.
 */

/** Parses a YYYY-MM-DD key as a local date, so no timezone shifts the label. */
function parseKey(key) {
  const [year, month, day] = String(key || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function shortLabel(key) {
  const date = parseKey(key);
  if (!date) return String(key || '');
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date);
}

function longLabel(key) {
  const date = parseKey(key);
  if (!date) return String(key || '');
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-paper-300 bg-white px-3 py-2 text-xs shadow-lift">
      <p className="font-medium text-ink-900">{longLabel(row.date)}</p>
      <p className="tabular mt-0.5 text-ink-600">{plural(row.questions || 0, 'question')} answered</p>
      {row.questions > 0 && (
        <p className="tabular text-ink-500">
          {row.correct || 0} correct · {row.minutes || 0} min
        </p>
      )}
    </div>
  );
}

export default function ActivityChart({ data, days, height = 200, className, caption }) {
  const series = useMemo(() => {
    const rows = Array.isArray(data) ? data : [];
    return days ? rows.slice(-days) : rows;
  }, [data, days]);

  const totals = useMemo(
    () =>
      series.reduce(
        (acc, row) => ({
          questions: acc.questions + (row.questions || 0),
          correct: acc.correct + (row.correct || 0),
          minutes: acc.minutes + (row.minutes || 0),
          activeDays: acc.activeDays + (row.questions > 0 ? 1 : 0),
        }),
        { questions: 0, correct: 0, minutes: 0, activeDays: 0 },
      ),
    [series],
  );

  const span = series.length;

  if (!span) {
    return (
      <p className={cx('flex items-center gap-2 text-sm text-ink-500', className)}>
        <Icon name="chart" size={16} className="text-ink-400" />
        There is no activity to chart yet.
      </p>
    );
  }

  const allZero = totals.questions === 0;
  const busiest = series.reduce((best, row) => ((row.questions || 0) > (best.questions || 0) ? row : best), series[0]);

  const summary = allZero
    ? `No questions answered in the last ${plural(span, 'day')}.`
    : `${plural(totals.questions, 'question')} answered over ${plural(span, 'day')}, on ${plural(
        totals.activeDays,
        'day',
      )}. Busiest day: ${longLabel(busiest.date)} with ${plural(busiest.questions || 0, 'question')}.`;

  return (
    <figure className={cx('m-0', className)}>
      <p className="text-sm leading-relaxed text-ink-600">{summary}</p>

      <div className="mt-3" role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -18 }} barCategoryGap="18%">
            <CartesianGrid stroke="#f0ece4" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={shortLabel}
              tick={{ fill: '#6b7280', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#e3ddd1' }}
              minTickGap={18}
              interval="preserveStartEnd"
            />
            <YAxis
              allowDecimals={false}
              domain={allZero ? [0, 4] : [0, 'auto']}
              tick={{ fill: '#6b7280', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={34}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(47, 72, 119, 0.06)' }} />
            <Bar dataKey="questions" name="Questions" fill="#2f4877" radius={[3, 3, 0, 0]} maxBarSize={26} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <figcaption className="mt-2 text-xs leading-relaxed text-ink-500">
        {caption || `Questions answered each day over the last ${plural(span, 'day')}.`}
        {!allZero && ` ${totals.correct} correct in total, and ${totals.minutes} minutes of work.`}
        {allZero && ' Answer a few questions today and the first bar will appear here.'}
      </figcaption>

      <ul className="sr-only">
        {series.map((row) => (
          <li key={row.date}>
            {longLabel(row.date)}: {plural(row.questions || 0, 'question')} answered, {row.correct || 0} correct.
          </li>
        ))}
      </ul>
    </figure>
  );
}
