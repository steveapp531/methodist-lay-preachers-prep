import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Icon, ProgressBar, SourceBadge, cx } from '@/components/ui';

/**
 * What the candidate sees after answering.
 *
 * The governing idea of the platform is that being told you are wrong teaches
 * nothing. So this panel always carries the correct answer, the reason it is
 * correct, the place in the syllabus it comes from, and a way straight back to
 * that passage.
 */
export default function AnswerFeedback({
  result,
  review,
  theoryEvaluation,
  onStudyTopic,
  onNextQuestion,
  onRetry,
  onBookmark,
  bookmarked = false,
  soundEnabled = true,
}) {
  const panelRef = useRef(null);
  const isTheory = review?.type === 'theory';
  const correct = result?.isCorrect;
  const partial = !correct && result?.score > 0;

  // Move focus to the result so a screen reader announces it immediately.
  useEffect(() => {
    panelRef.current?.focus();
  }, [review?.id]);

  useEffect(() => {
    if (soundEnabled && correct) playChime();
  }, [correct, soundEnabled, review?.id]);

  const tone = correct ? 'success' : partial ? 'warning' : 'danger';
  const headline = isTheory
    ? `${theoryEvaluation?.marksAwarded ?? result?.marksAwarded ?? 0} out of ${theoryEvaluation?.marksAvailable ?? result?.marksAvailable ?? 0}`
    : correct
      ? 'Correct'
      : partial
        ? 'Partly right'
        : 'Not quite';

  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      role="status"
      aria-live="polite"
      className={cx(
        'animate-slide-up overflow-hidden rounded-2xl border-2 focus:outline-none',
        tone === 'success' ? 'border-success-500 bg-success-50' : tone === 'warning' ? 'border-warning-500 bg-warning-50' : 'border-danger-500 bg-danger-50',
      )}
    >
      {/* Verdict */}
      <header className="flex items-start gap-3 px-5 py-4">
        <span
          className={cx(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white',
            correct ? 'animate-pop-in bg-success-500' : partial ? 'bg-warning-500' : 'bg-danger-500',
          )}
        >
          <Icon name={correct ? 'check' : partial ? 'info' : 'close'} size={correct ? 22 : 18} />
        </span>
        <div className="min-w-0 flex-1">
          <h3
            className={cx(
              'font-serif text-lg font-semibold',
              tone === 'success' ? 'text-success-700' : tone === 'warning' ? 'text-warning-600' : 'text-danger-600',
            )}
          >
            {headline}
          </h3>
          {!isTheory && !correct && review?.correctOptionKeys?.length > 0 && (
            <p className="mt-0.5 text-sm text-ink-700">
              The correct answer is{' '}
              <strong className="font-semibold">
                {review.correctOptionKeys
                  .map((key) => {
                    const option = review.options?.find((o) => o.key === key);
                    return option ? `${key}. ${option.text}` : key;
                  })
                  .join('; ')}
              </strong>
            </p>
          )}
          {!isTheory && review?.type === 'fill_blank' && !correct && review?.acceptedAnswers?.length > 0 && (
            <p className="mt-0.5 text-sm text-ink-700">
              Accepted answers: <strong className="font-semibold">{review.acceptedAnswers.join(', ')}</strong>
            </p>
          )}
        </div>

        {onBookmark && (
          <button
            type="button"
            onClick={onBookmark}
            aria-pressed={bookmarked}
            aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark this question'}
            className={cx('rounded-lg p-2 transition-colors', bookmarked ? 'text-gold-600' : 'text-ink-400 hover:bg-white/60 hover:text-ink-700')}
          >
            <Icon name="bookmark" size={18} />
          </button>
        )}
      </header>

      {/* The teaching */}
      <div className="space-y-4 border-t border-white/70 bg-white px-5 py-4">
        {isTheory && theoryEvaluation && <TheoryBreakdown evaluation={theoryEvaluation} review={review} />}

        {review?.explanation && (
          <div>
            <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
              <Icon name="info" size={13} />
              Why
            </h4>
            <p className="text-sm leading-relaxed text-ink-700">{review.explanation}</p>
          </div>
        )}

        {review?.manualReference?.excerpt && (
          <blockquote className="rounded-lg border-l-[3px] border-brand-500 bg-brand-50 px-4 py-3">
            <p className="font-serif text-sm italic leading-relaxed text-ink-700">“{review.manualReference.excerpt}”</p>
            <cite className="mt-2 block text-xs not-italic text-brand-700">
              {review.manualReference.citation || 'Official syllabus'}
            </cite>
          </blockquote>
        )}

        <ManualReferenceRow reference={review?.manualReference} scriptures={review?.scriptureReferences} />

        <div className="flex flex-wrap items-center gap-2 border-t border-paper-200 pt-3">
          <SourceBadge sourceKind={review?.sourceKind} source={review?.source} answerConfidence={review?.answerConfidence} />
          {review?.answerConfidence === 'unverified' && (
            <span className="text-xs text-ink-500">Check this one against your printed syllabus.</span>
          )}
        </div>
      </div>

      {/* What to do next */}
      <footer className="flex flex-wrap gap-2 border-t border-paper-200 bg-paper-50 px-5 py-3.5">
        {onNextQuestion && (
          <Button onClick={onNextQuestion} iconRight={<Icon name="chevronRight" size={15} strokeStyle />}>
            Next question
          </Button>
        )}
        {onStudyTopic && review?.topic && (
          <Button variant="secondary" onClick={onStudyTopic} icon={<Icon name="book" size={15} />}>
            Study this topic
          </Button>
        )}
        {onRetry && !correct && (
          <Button variant="ghost" onClick={onRetry} icon={<Icon name="refresh" size={15} />}>
            Try this question again
          </Button>
        )}
      </footer>
    </section>
  );
}

/** Where the answer came from, and what scripture it rests on. */
export function ManualReferenceRow({ reference, scriptures }) {
  const hasReference = reference?.topicTitle || reference?.chapterTitle || reference?.citation;
  if (!hasReference && !scriptures?.length) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {hasReference && (
        <div>
          <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
            <Icon name="book" size={13} />
            Syllabus reference
          </h4>
          <p className="text-sm leading-relaxed text-ink-700">
            {[reference.chapterTitle, reference.topicTitle].filter(Boolean).join(' — ') || reference.citation}
          </p>
          {reference.pageNumber && <p className="mt-0.5 text-xs text-ink-500">Page {reference.pageNumber}</p>}
        </div>
      )}

      {scriptures?.length > 0 && (
        <div>
          <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
            <Icon name="scroll" size={13} />
            Scripture
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {scriptures.map((ref) => (
              <Link
                key={ref.reference}
                to={`/scripture/${encodeURIComponent(ref.reference)}`}
                className="rounded-full bg-gold-50 px-2.5 py-1 text-xs font-medium text-gold-700 hover:bg-gold-100"
              >
                {ref.reference}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Criterion-by-criterion marking of a theory answer. */
export function TheoryBreakdown({ evaluation, review }) {
  const tones = {
    covered: { badge: 'success', icon: 'check', label: 'Covered' },
    partial: { badge: 'warning', icon: 'info', label: 'Partly covered' },
    missing: { badge: 'danger', icon: 'close', label: 'Not addressed' },
  };

  return (
    <div className="space-y-4">
      <ProgressBar
        value={evaluation.marksAwarded}
        max={evaluation.marksAvailable}
        tone={evaluation.percentage >= 70 ? 'success' : evaluation.percentage >= 45 ? 'warning' : 'danger'}
        label={`${evaluation.marksAwarded} of ${evaluation.marksAvailable} marks`}
        showValue
      />

      {evaluation.feedback && <p className="text-sm leading-relaxed text-ink-700">{evaluation.feedback}</p>}

      {evaluation.confidence === 'inconclusive' && (
        <p className="flex items-start gap-1.5 rounded-lg bg-warning-50 p-2.5 text-xs leading-relaxed text-warning-600">
          <Icon name="alert" size={14} className="mt-px" />
          This answer could not be marked confidently against the rubric. Compare it with the ideal answer below and use
          your own judgement.
        </p>
      )}

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Against the marking scheme</h4>
        <ul className="space-y-2">
          {evaluation.criteria?.map((criterion) => {
            const tone = tones[criterion.verdict] || tones.missing;
            return (
              <li key={criterion.id} className="rounded-lg border border-paper-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-ink-800">
                      <Icon name={tone.icon} size={14} className={`text-${tone.badge}-500`} />
                      {criterion.label}
                    </p>
                    {criterion.evidence && (
                      <p className="mt-1 border-l-2 border-paper-300 pl-2.5 text-xs italic leading-relaxed text-ink-500">
                        “{criterion.evidence}”
                      </p>
                    )}
                    {criterion.guidance && criterion.verdict !== 'covered' && (
                      <p className="mt-1 text-xs leading-relaxed text-ink-500">{criterion.guidance}</p>
                    )}
                  </div>
                  <Badge tone={tone.badge} size="sm" className="shrink-0 tabular">
                    {criterion.marksAwarded}/{criterion.marksAvailable}
                  </Badge>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {review?.idealAnswer && (
        <details className="group rounded-lg border border-paper-300 bg-paper-50">
          <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-2.5 text-sm font-medium text-ink-700">
            What a full-mark answer contains
            <Icon name="chevronDown" size={16} className="transition-transform group-open:rotate-180" strokeStyle />
          </summary>
          <div className="border-t border-paper-200 px-4 py-3">
            <p className="whitespace-pre-line font-serif text-sm leading-relaxed text-ink-700">{review.idealAnswer}</p>
            {review.keyPoints?.length > 0 && (
              <ul className="mt-3 space-y-1">
                {review.keyPoints.map((point, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink-600">
                    <Icon name="check" size={14} className="mt-0.5 shrink-0 text-success-500" />
                    {point}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>
      )}

      {evaluation.engine !== 'rubric' && (
        <p className="text-[11px] text-ink-400">
          Marked against the examiner's rubric
          {evaluation.engine === 'ai' ? ' with AI assistance' : ''}. Treat the mark as guidance, not as an official
          result.
        </p>
      )}
    </div>
  );
}

/**
 * A short, quiet chime on a correct answer. Synthesised rather than shipped as
 * an audio file, and silently skipped where the browser blocks audio.
 */
let audioContext = null;
function playChime() {
  try {
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();

    const now = audioContext.currentTime;
    [784, 1046.5].forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, now + index * 0.09);
      gain.gain.linearRampToValueAtTime(0.06, now + index * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.09 + 0.42);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(now + index * 0.09);
      oscillator.stop(now + index * 0.09 + 0.45);
    });
  } catch {
    /* Audio is a flourish, never a requirement. */
  }
}
