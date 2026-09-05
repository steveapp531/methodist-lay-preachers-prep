import { useEffect, useState } from 'react';
import { Badge, Button, Icon, Textarea, cx } from '@/components/ui';
import { useSpeechRecognition } from '@/hooks';
import { formatDuration } from '@/hooks';

/**
 * Typing or dictation for a theory answer.
 *
 * Dictation is an alternative, never a requirement: where the browser has no
 * speech recognition the recording controls are simply absent and the textarea
 * is the whole interface. A transcript is always shown for editing before it
 * becomes the answer — the candidate, not the recogniser, decides what is
 * submitted.
 */
export default function TheoryAnswerInput({ question, value = '', viaVoice = false, disabled = false, onChange }) {
  const [mode, setMode] = useState('type');
  const [draft, setDraft] = useState('');
  const speech = useSpeechRecognition();

  // Keep the live transcript in a draft the candidate can edit before accepting.
  useEffect(() => {
    if (speech.listening || speech.transcript) {
      setDraft(`${speech.transcript}${speech.interim ? ` ${speech.interim}` : ''}`.trim());
    }
  }, [speech.transcript, speech.interim, speech.listening]);

  const marks = question.marks || 25;
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  // Roughly twelve substantive words per mark is a realistic written-answer length.
  const suggested = Math.round(marks * 12);

  const acceptTranscript = () => {
    const merged = value.trim() ? `${value.trim()} ${draft.trim()}` : draft.trim();
    onChange(merged, true);
    speech.reset();
    setDraft('');
    setMode('type');
  };

  const discardTranscript = () => {
    speech.stop();
    speech.reset();
    setDraft('');
    setMode('type');
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-lg bg-paper-200 p-1" role="tablist" aria-label="How to answer">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'type'}
            onClick={() => setMode('type')}
            disabled={disabled}
            className={cx(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              mode === 'type' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700',
            )}
          >
            <Icon name="pen" size={14} />
            Type your answer
          </button>

          {speech.supported && (
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'voice'}
              onClick={() => setMode('voice')}
              disabled={disabled}
              className={cx(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                mode === 'voice' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700',
              )}
            >
              <Icon name="mic" size={14} />
              Record answer
            </button>
          )}
        </div>

        <span className={cx('tabular text-xs', words >= suggested * 0.6 ? 'text-success-600' : 'text-ink-400')}>
          {words} {words === 1 ? 'word' : 'words'}
          <span className="text-ink-400"> · around {suggested} suits {marks} marks</span>
        </span>
      </div>

      {mode === 'type' && (
        <Textarea
          value={value}
          disabled={disabled}
          rows={10}
          onChange={(e) => onChange(e.target.value, viaVoice)}
          placeholder="Write your answer here. Address each part of the question in turn, and support your points from scripture and the syllabus where you can."
          aria-label="Your theory answer"
        />
      )}

      {mode === 'voice' && (
        <div className="rounded-xl border border-paper-300 bg-white p-4">
          {!speech.supported ? (
            <p className="text-sm text-ink-600">
              This browser does not offer speech recognition. Please type your answer instead.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                {!speech.listening ? (
                  <Button onClick={speech.start} disabled={disabled} icon={<Icon name="mic" size={16} />}>
                    Start recording
                  </Button>
                ) : (
                  <Button variant="danger" onClick={speech.stop} icon={<Icon name="stop" size={14} />}>
                    Stop recording
                  </Button>
                )}

                {speech.listening && (
                  <span className="flex items-center gap-2 text-sm text-danger-600" role="status">
                    <span className="flex h-2.5 w-2.5 animate-gentle-pulse rounded-full bg-danger-500" />
                    Recording
                    <span className="tabular font-medium">{formatDuration(speech.seconds)}</span>
                  </span>
                )}
              </div>

              {speech.error && (
                <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-warning-50 p-2.5 text-xs leading-relaxed text-warning-600" role="alert">
                  <Icon name="alert" size={14} className="mt-px" />
                  {speech.error}
                </p>
              )}

              {(draft || speech.listening) && (
                <div className="mt-4">
                  <label htmlFor="transcript" className="mb-1.5 block text-sm font-medium text-ink-700">
                    Transcript — check and correct it before adding it to your answer
                  </label>
                  <textarea
                    id="transcript"
                    rows={6}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="w-full rounded-lg border border-paper-300 bg-paper-50 px-3.5 py-2.5 text-sm leading-relaxed focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <Button size="sm" onClick={acceptTranscript} disabled={!draft.trim() || speech.listening}>
                      {value.trim() ? 'Add to my answer' : 'Use this as my answer'}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={discardTranscript}>
                      Discard
                    </Button>
                  </div>
                </div>
              )}

              {!draft && !speech.listening && (
                <p className="mt-3 text-xs leading-relaxed text-ink-500">
                  Speak your answer aloud. What you say is transcribed by your browser and shown here for you to edit —
                  nothing is submitted until you accept it.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {viaVoice && value && (
        <Badge tone="brand" size="sm" icon={<Icon name="mic" size={11} />}>
          Includes dictated text
        </Badge>
      )}
    </div>
  );
}
