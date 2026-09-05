import { useState } from 'react';
import { Badge, Button, Icon, cx } from '@/components/ui';

/**
 * One thing to do next.
 *
 * Every recommendation carries the action that starts it, so the dashboard never
 * tells a candidate to revise something without a button that begins exactly that.
 * Urgency is shown with a border, a badge and words — never with colour alone.
 */

const URGENCY = {
  high: {
    border: 'border-l-danger-500',
    tone: 'danger',
    icon: 'alert',
    label: 'Do this first',
  },
  medium: {
    border: 'border-l-warning-500',
    tone: 'warning',
    icon: 'info',
    label: 'Worth doing soon',
  },
  low: {
    border: 'border-l-brand-400',
    tone: 'brand',
    icon: 'info',
    label: 'When you have time',
  },
};

const ACTION_LABELS = {
  study_topic: 'Read the topic',
  topic_quiz: 'Quiz me on it',
  mistakes_quiz: 'Practise these again',
  daily_revision: "Start today's revision",
  mock_exam: 'Go to mock examinations',
};

const ACTION_ICONS = {
  study_topic: 'book',
  topic_quiz: 'quiz',
  mistakes_quiz: 'target',
  daily_revision: 'play',
  mock_exam: 'exam',
};

function actionLabel(action) {
  if (!action) return null;
  return ACTION_LABELS[action.type] || 'Begin';
}

export default function RecommendationCard({ recommendation, onAction, className }) {
  const [busy, setBusy] = useState(null);
  if (!recommendation) return null;

  const urgency = URGENCY[recommendation.urgency] || URGENCY.medium;
  const { action, secondaryAction } = recommendation;

  const run = async (candidate, slot) => {
    if (!candidate || busy) return;
    setBusy(slot);
    try {
      await onAction?.(candidate);
    } finally {
      setBusy(null);
    }
  };

  return (
    <article
      className={cx(
        'rounded-xl border border-paper-300 border-l-4 bg-white p-4 shadow-card sm:p-5',
        urgency.border,
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={urgency.tone} size="sm" icon={<Icon name={urgency.icon} size={12} />}>
          {urgency.label}
        </Badge>
        {recommendation.subject && (
          <Badge tone="outline" size="sm">
            {recommendation.subject}
          </Badge>
        )}
      </div>

      <h3 className="mt-2.5 font-serif text-base font-semibold leading-snug text-ink-900">{recommendation.title}</h3>
      {recommendation.detail && (
        <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{recommendation.detail}</p>
      )}

      {(action || secondaryAction) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {action && (
            <Button
              size="sm"
              onClick={() => run(action, 'primary')}
              loading={busy === 'primary'}
              disabled={busy != null && busy !== 'primary'}
              icon={busy === 'primary' ? undefined : <Icon name={ACTION_ICONS[action.type] || 'play'} size={15} />}
            >
              {actionLabel(action)}
            </Button>
          )}
          {secondaryAction && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => run(secondaryAction, 'secondary')}
              loading={busy === 'secondary'}
              disabled={busy != null && busy !== 'secondary'}
              icon={
                busy === 'secondary' ? undefined : (
                  <Icon name={ACTION_ICONS[secondaryAction.type] || 'play'} size={15} />
                )
              }
            >
              {actionLabel(secondaryAction)}
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
