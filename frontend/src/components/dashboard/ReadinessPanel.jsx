import { Badge, Icon, ProgressBar, ProgressRing, Tooltip } from '@/components/ui';
import { plural } from '@/utils/format';

/**
 * The readiness indicator, explained.
 *
 * A single number is easy to misread, so the four measured components are shown
 * alongside it with the weight each one carries, and the evidence cap — when it
 * applies — is stated plainly rather than hidden.
 */

const DEFAULT_WEIGHTS = {
  objectiveAccuracy: 0.4,
  syllabusCoverage: 0.25,
  mockPerformance: 0.25,
  consistency: 0.1,
};

const COMPONENTS = [
  {
    key: 'objectiveAccuracy',
    label: 'Objective accuracy',
    hint: 'How well you answer objective questions, over your most recent attempts.',
  },
  {
    key: 'syllabusCoverage',
    label: 'Syllabus coverage',
    hint: 'How much of the syllabus you have worked through, weighted by your mastery of it.',
  },
  {
    key: 'mockPerformance',
    label: 'Mock performance',
    hint: 'Your average across your most recent mock examinations.',
  },
  {
    key: 'consistency',
    label: 'Consistency',
    hint: 'How many of the last fourteen days you studied on.',
  },
];

/** The shared constants use an "info" tone that the design system spells "brand". */
const TONES = { danger: 'danger', warning: 'warning', info: 'brand', brand: 'brand', success: 'success' };

export function bandTone(band) {
  return TONES[band?.tone] || 'brand';
}

function componentTone(value) {
  if (value >= 75) return 'success';
  if (value >= 50) return 'warning';
  return 'danger';
}

export default function ReadinessPanel({ readiness, className, headingLevel = 'h2', showEvidence = true }) {
  if (!readiness) return null;

  const Heading = headingLevel;
  const score = Math.round(readiness.score || 0);
  const band = readiness.band || {};
  const tone = bandTone(band);
  const weights = { ...DEFAULT_WEIGHTS, ...(readiness.weights || {}) };
  const components = readiness.components || {};
  const evidence = readiness.evidence || {};

  return (
    <section className={className} aria-labelledby="readiness-heading">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <ProgressRing value={score} size={96} stroke={9} tone={tone} sublabel="Readiness" />
          <div>
            <Heading id="readiness-heading" className="font-serif text-base font-semibold text-ink-900">
              Examination readiness
            </Heading>
            <p className="mt-1.5">
              <Badge tone={tone} icon={<Icon name={score >= 78 ? 'check' : 'target'} size={13} />}>
                {band.label || 'Needs Preparation'}
              </Badge>
            </p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-500">
              An estimate built from four measures of your work so far, not a prediction of your result.
            </p>
          </div>
        </div>
      </div>

      <ul className="mt-5 grid gap-4 sm:grid-cols-2">
        {COMPONENTS.map((component) => {
          const value = Math.round(components[component.key] ?? 0);
          const weight = Math.round((weights[component.key] ?? 0) * 100);
          return (
            <li key={component.key}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="flex items-center gap-1 text-sm font-medium text-ink-700">
                  {component.label}
                  <Tooltip label={component.hint}>
                    <span
                      tabIndex={0}
                      role="note"
                      aria-label={component.hint}
                      className="inline-flex text-ink-400 hover:text-ink-600"
                    >
                      <Icon name="info" size={13} />
                    </span>
                  </Tooltip>
                </span>
                <span className="tabular text-sm font-semibold text-ink-900">{value}%</span>
              </div>
              <ProgressBar value={value} tone={componentTone(value)} size="sm" label={`${component.label} score`} />
              <p className="mt-1 text-xs text-ink-400">Carries {weight}% of the readiness score</p>
            </li>
          );
        })}
      </ul>

      {evidence.capApplied && (
        <p className="mt-5 flex items-start gap-2 rounded-lg border border-paper-300 bg-paper-100 p-3 text-sm leading-relaxed text-ink-600">
          <Icon name="info" size={16} className="mt-0.5 shrink-0 text-brand-600" />
          <span>
            This score is currently limited by how few questions you have answered so far —{' '}
            {plural(evidence.questionsAnswered || 0, 'question')} to date. That is not a judgement on your work; the
            figure will rise to reflect your true standing as you answer more.
          </span>
        </p>
      )}

      {showEvidence && (
        <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-paper-200 pt-4 sm:grid-cols-4">
          <EvidenceItem label="Questions answered" value={evidence.questionsAnswered ?? 0} />
          <EvidenceItem
            label="Topics covered"
            value={`${evidence.topicsTouched ?? 0} of ${evidence.totalTopics ?? 0}`}
          />
          <EvidenceItem label="Mock examinations" value={evidence.mockExamsTaken ?? 0} />
          <EvidenceItem label="Active days (last 14)" value={evidence.activeDaysLast14 ?? 0} />
        </dl>
      )}
    </section>
  );
}

function EvidenceItem({ label, value }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className="tabular mt-1 font-serif text-lg font-semibold text-ink-900">{value}</dd>
    </div>
  );
}
