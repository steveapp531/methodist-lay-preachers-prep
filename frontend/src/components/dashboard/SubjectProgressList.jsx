import { Link } from 'react-router-dom';
import { Badge, EmptyState, Icon, ProgressBar } from '@/components/ui';
import { masteryTone, percent, plural } from '@/utils/format';

/**
 * Per-paper progress.
 *
 * The dashboard rollup does not carry a percentComplete, so it is derived here
 * from the topics completed against the paper's total — the same figure the
 * subject listing returns, computed the same way.
 */

export function subjectPercentComplete(subject) {
  if (subject?.percentComplete != null) return Math.round(subject.percentComplete);
  const total = subject?.totalTopics || 0;
  if (!total) return 0;
  return Math.round(((subject.topicsCompleted || 0) / total) * 100);
}

export default function SubjectProgressList({ subjects, emptyAction, className }) {
  const rows = Array.isArray(subjects) ? subjects : [];

  if (!rows.length) {
    return (
      <EmptyState
        icon="book"
        title="No paper progress yet"
        message="Once you have read a topic or answered a question, your progress in each paper appears here."
        action={emptyAction}
      />
    );
  }

  return (
    <ul className={className}>
      {rows.map((subject) => {
        const complete = subjectPercentComplete(subject);
        const mastery = Math.round(subject.mastery || 0);
        return (
          <li key={subject.subjectId || subject.slug} className="border-b border-paper-200 last:border-b-0">
            <Link
              to={`/study/subject/${subject.subjectId}`}
              className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-paper-100"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-serif text-sm font-semibold text-ink-900">{subject.name}</span>
                  {subject.code && (
                    <Badge tone="outline" size="sm">
                      {subject.code}
                    </Badge>
                  )}
                  {subject.topicsNeedingRevision > 0 && (
                    <Badge tone="warning" size="sm" icon={<Icon name="alert" size={11} />}>
                      {plural(subject.topicsNeedingRevision, 'topic')} to revise
                    </Badge>
                  )}
                </div>

                <div className="mt-2 flex items-center gap-3">
                  <ProgressBar
                    value={complete}
                    tone={masteryTone(mastery)}
                    size="sm"
                    label={`${subject.name} completed`}
                    className="min-w-0 flex-1"
                  />
                  <span className="tabular w-11 shrink-0 text-right text-sm font-semibold text-ink-800">
                    {complete}%
                  </span>
                </div>

                <p className="tabular mt-1.5 text-xs text-ink-500">
                  {subject.topicsCompleted || 0} of {subject.totalTopics || 0} topics completed ·{' '}
                  {subject.topicsTouched || 0} started · mastery {mastery}% · accuracy{' '}
                  {subject.attempts ? percent(subject.accuracy) : '—'}
                </p>
              </div>

              <Icon name="chevronRight" size={16} className="shrink-0 text-ink-400" strokeStyle />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
