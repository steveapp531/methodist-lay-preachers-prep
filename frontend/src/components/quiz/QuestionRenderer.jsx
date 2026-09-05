import { useEffect, useMemo, useState } from 'react';
import { Badge, Icon, Input, cx } from '@/components/ui';
import { QUESTION_TYPE_LABELS } from '@/utils/format';
import TheoryAnswerInput from './TheoryAnswerInput';

/**
 * Renders the answer controls for any question type and reports the answer
 * upward in the single shape the API expects:
 *   { selectedOptionKeys, textAnswer, matchAnswer, viaVoice }
 *
 * Correctness is never decided here. Once `revealed` is set the component only
 * marks up what was chosen against what was right; the marking itself came from
 * the server.
 */
export default function QuestionRenderer({
  question,
  value,
  onChange,
  revealed = false,
  correctKeys = [],
  disabled = false,
  autoFocus = false,
}) {
  const answer = value || { selectedOptionKeys: [], textAnswer: '', matchAnswer: {}, viaVoice: false };

  const update = (patch) => onChange({ ...answer, ...patch });

  switch (question.type) {
    case 'multiple_choice':
    case 'true_false':
      return (
        <OptionList
          question={question}
          selected={answer.selectedOptionKeys}
          correctKeys={correctKeys}
          revealed={revealed}
          disabled={disabled}
          multiple={false}
          onSelect={(key) => update({ selectedOptionKeys: [key] })}
        />
      );

    case 'multiple_response':
      return (
        <>
          <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-ink-500">
            <Icon name="info" size={13} />
            Select every option that applies.
          </p>
          <OptionList
            question={question}
            selected={answer.selectedOptionKeys}
            correctKeys={correctKeys}
            revealed={revealed}
            disabled={disabled}
            multiple
            onSelect={(key) => {
              const set = new Set(answer.selectedOptionKeys);
              if (set.has(key)) set.delete(key);
              else set.add(key);
              update({ selectedOptionKeys: [...set] });
            }}
          />
        </>
      );

    case 'fill_blank':
      return (
        <Input
          label="Your answer"
          value={answer.textAnswer}
          autoFocus={autoFocus}
          disabled={disabled}
          onChange={(e) => update({ textAnswer: e.target.value })}
          placeholder="Type your answer"
          autoComplete="off"
          hint={revealed ? undefined : 'Spelling is checked loosely, so small typing slips will not cost you the mark.'}
        />
      );

    case 'matching':
      return (
        <MatchingGrid
          question={question}
          value={answer.matchAnswer || {}}
          revealed={revealed}
          disabled={disabled}
          onChange={(matchAnswer) => update({ matchAnswer })}
        />
      );

    case 'theory':
      return (
        <TheoryAnswerInput
          question={question}
          value={answer.textAnswer}
          viaVoice={answer.viaVoice}
          disabled={disabled}
          onChange={(textAnswer, viaVoice) => update({ textAnswer, viaVoice })}
        />
      );

    default:
      return (
        <p className="rounded-lg bg-warning-50 p-4 text-sm text-warning-600">
          This question uses a format ({QUESTION_TYPE_LABELS[question.type] || question.type}) that this version cannot
          display. Please report it to an administrator.
        </p>
      );
  }
}

function OptionList({ question, selected, correctKeys, revealed, disabled, multiple, onSelect }) {
  const chosen = new Set(selected || []);
  const correct = new Set(correctKeys || []);

  return (
    <div role={multiple ? 'group' : 'radiogroup'} aria-label="Answer options" className="space-y-2.5">
      {(question.options || []).map((option) => {
        const isChosen = chosen.has(option.key);
        const isCorrect = revealed && correct.has(option.key);
        const isWrongChoice = revealed && isChosen && !correct.has(option.key);

        return (
          <button
            key={option.key}
            type="button"
            role={multiple ? 'checkbox' : 'radio'}
            aria-checked={isChosen}
            disabled={disabled}
            onClick={() => onSelect(option.key)}
            className={cx(
              'flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all duration-150',
              'disabled:cursor-default',
              isCorrect
                ? 'border-success-500 bg-success-50'
                : isWrongChoice
                  ? 'border-danger-500 bg-danger-50'
                  : isChosen
                    ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                    : 'border-paper-300 bg-white hover:border-brand-300 hover:bg-paper-50',
            )}
          >
            <span
              className={cx(
                'flex h-7 w-7 shrink-0 items-center justify-center text-xs font-semibold transition-colors',
                multiple ? 'rounded-md' : 'rounded-full',
                isCorrect
                  ? 'bg-success-500 text-white'
                  : isWrongChoice
                    ? 'bg-danger-500 text-white'
                    : isChosen
                      ? 'bg-brand-700 text-white'
                      : 'bg-paper-200 text-ink-600',
              )}
            >
              {/* Correctness is shown by an icon as well as by colour, never colour alone. */}
              {isCorrect ? <Icon name="check" size={15} /> : isWrongChoice ? <Icon name="close" size={13} /> : option.key}
            </span>

            <span className="min-w-0 flex-1 pt-0.5">
              <span className="block text-sm leading-relaxed text-ink-800">{option.text}</span>
              {revealed && option.rationale && (
                <span className={cx('mt-1.5 block text-xs leading-relaxed', isCorrect ? 'text-success-700' : 'text-ink-500')}>
                  {option.rationale}
                </span>
              )}
            </span>

            {revealed && (isCorrect || isWrongChoice) && (
              <Badge tone={isCorrect ? 'success' : 'danger'} size="sm">
                {isCorrect ? 'Correct answer' : 'Your answer'}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}

function MatchingGrid({ question, value, revealed, disabled, onChange }) {
  const pairs = question.matchPairs || [];
  const options = useMemo(() => question.matchOptions || pairs.map((p) => p.right), [question.matchOptions, pairs]);
  const [local, setLocal] = useState(value);

  useEffect(() => setLocal(value), [value]);

  const set = (left, right) => {
    const next = { ...local, [left]: right };
    setLocal(next);
    onChange(next);
  };

  return (
    <div className="space-y-2.5">
      {pairs.map((pair) => {
        const chosen = local[pair.left] || '';
        const isCorrect = revealed && chosen && chosen === pair.right;
        const isWrong = revealed && chosen && chosen !== pair.right;

        return (
          <div
            key={pair.left}
            className={cx(
              'grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center',
              isCorrect ? 'border-success-500 bg-success-50' : isWrong ? 'border-danger-500 bg-danger-50' : 'border-paper-300 bg-white',
            )}
          >
            <span className="text-sm text-ink-800">{pair.left}</span>
            <Icon name="chevronRight" size={16} className="hidden text-ink-300 sm:block" strokeStyle />
            <div>
              <select
                value={chosen}
                disabled={disabled}
                aria-label={`Match for ${pair.left}`}
                onChange={(e) => set(pair.left, e.target.value)}
                className="w-full rounded-lg border border-paper-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="">Choose…</option>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {isWrong && <p className="mt-1.5 text-xs text-danger-600">Correct match: {pair.right}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
