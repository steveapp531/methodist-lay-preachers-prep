import { useMemo, useRef, useState } from 'react';
import { adminApi } from '@/services/api';
import { useDocumentTitle } from '@/hooks';
import { useToast } from '@/context/ToastContext';
import { Badge, Button, Card, CardHeader, EmptyState, Icon, Select, StatTile, Textarea } from '@/components/ui';
import { CONTENT_STATUS } from '@shared/constants';

const STATUS_LABELS = {
  [CONTENT_STATUS.DRAFT]: 'Draft — hidden until you publish it',
  [CONTENT_STATUS.NEEDS_REVIEW]: 'Needs review — flagged for a second pair of eyes',
  [CONTENT_STATUS.PUBLISHED]: 'Published — live for candidates immediately',
};

const SAMPLE = [
  {
    questionId: 'DOC-O-2025-14',
    examStage: 'PART2',
    subject: 'DOC',
    chapter: 'The Means of Grace',
    topic: 'The Lord’s Supper',
    questionType: 'multiple_choice',
    question: 'According to the syllabus, what does the Methodist Church understand the Lord’s Supper chiefly to be?',
    context: '',
    options: [
      { key: 'A', text: 'A memorial meal only', isCorrect: false, rationale: 'This states less than the syllabus does: memory is included, but not the whole.' },
      { key: 'B', text: 'A means of grace in which Christ is truly present to faith', isCorrect: true, rationale: '' },
      { key: 'C', text: 'A private devotion for the ordained', isCorrect: false, rationale: 'The syllabus describes it as an act of the whole congregation.' },
      { key: 'D', text: 'A symbolic act with no spiritual effect', isCorrect: false, rationale: 'This denies the grace the syllabus attributes to the sacrament.' },
    ],
    explanation:
      'The syllabus places the Lord’s Supper among the means of grace: an outward sign through which Christ gives himself to those who receive in faith.',
    manualReference: {
      chapterTitle: 'The Means of Grace',
      topicTitle: 'The Lord’s Supper',
      excerpt: 'The Lord’s Supper is a means of grace wherein Christ is truly present to the faith of the believer.',
      citation: 'Lay Preachers’ Syllabus, Doctrine, chapter 6',
      pageNumber: 84,
    },
    scriptureReferences: ['1 Corinthians 11:23-26'],
    difficulty: 'medium',
    tags: ['sacraments', 'means of grace'],
    sourceKind: 'past_paper',
    source: { label: 'Doctrine Part II — September 2025', year: 2025, sitting: 'September', sectionLabel: 'Section A', questionNumber: '14' },
    answerConfidence: 'verified',
    status: 'draft',
  },
  {
    questionId: 'DOC-T-2025-02',
    examStage: 'PART2',
    subject: 'DOC',
    topic: 'The Lord’s Supper',
    questionType: 'theory',
    question: 'Explain the Methodist understanding of the Lord’s Supper as a means of grace.',
    marks: 20,
    idealAnswer:
      'A full answer defines a means of grace, sets the Lord’s Supper among them, describes Christ’s presence to faith, and shows the effect on the believing congregation.',
    keyPoints: ['Defines a means of grace', 'Christ present to faith', 'An act of the gathered church'],
    markingRubric: [
      { id: 'c1', label: 'Definition', description: 'Defines a means of grace.', marks: 6, keywords: ['means of grace', 'outward sign'], synonyms: [['channel', 'instrument']] },
      { id: 'c2', label: 'Presence', description: 'Describes Christ’s presence to faith.', marks: 8, keywords: ['presence', 'faith'] },
      { id: 'c3', label: 'Congregation', description: 'Shows it as an act of the whole church.', marks: 6, keywords: ['congregation', 'church', 'together'] },
    ],
    explanation: 'Candidates commonly stop at memory and omit the grace given in the sacrament.',
    sourceKind: 'manual_derived',
    answerConfidence: 'verified',
    status: 'draft',
  },
];

const SAMPLE_TEXT = JSON.stringify(SAMPLE, null, 2);

const FIELD_REFERENCE = [
  {
    group: 'Placement',
    fields: [
      { name: 'questionId', note: 'Stable identifier. A record whose identifier already exists updates that question instead of creating a second one. Left out, one is generated.' },
      { name: 'examStage', note: 'The examination code, for example PART1 or PART2. Defaults to PART2.' },
      { name: 'subject', note: 'Required. The subject code (DOC, OT, NT…), its slug or its full name.' },
      { name: 'chapter', note: 'Chapter title or number. A chapter that cannot be found is reported as a warning, not an error.' },
      { name: 'topic', note: 'Topic title, slug or number. Also reported as a warning if it cannot be found.' },
    ],
  },
  {
    group: 'The question',
    fields: [
      { name: 'questionType', note: 'multiple_choice, true_false, multiple_response, fill_blank, matching or theory. Common aliases (mcq, essay, completion) are understood.' },
      { name: 'question', note: 'Required. The question text. “prompt” is accepted as an alias.' },
      { name: 'context', note: 'A passage or scenario printed above the question.' },
      { name: 'marks', note: 'Defaults to 1, or to 25 for a theory question.' },
      { name: 'suggestedMinutes', note: 'How long a candidate should spend.' },
    ],
  },
  {
    group: 'The answer',
    fields: [
      { name: 'options', note: 'An array of { key, text, isCorrect, rationale }, an array of plain strings (lettered A, B, C…), or an object { "A": "…", "B": "…" }.' },
      { name: 'correctAnswer', note: 'The correct option key or keys. For true/false the words True and False are also understood. Ignored if options already carry isCorrect.' },
      { name: 'acceptedAnswers', note: 'Fill-in-the-blank only. An array, or several answers separated by a vertical bar.' },
      { name: 'matchPairs', note: 'Matching only. An array of { left, right }.' },
      { name: 'idealAnswer / keyPoints / markingRubric', note: 'Theory only. A theory question needs at least one of these, or it cannot be marked. Rubric criteria take { id, label, description, marks, keywords, synonyms }.' },
    ],
  },
  {
    group: 'Teaching',
    fields: [
      { name: 'explanation', note: 'Why the answer is right. A published question must have this or a manual excerpt.' },
      { name: 'manualReference', note: '{ subjectName, chapterTitle, topicTitle, anchor, pageNumber, excerpt, citation }. Missing parts are filled from the resolved subject, chapter and topic.' },
      { name: 'scriptureReferences', note: 'An array of strings like "Amos 5:24", or of { book, chapter, verses }.' },
    ],
  },
  {
    group: 'Classification',
    fields: [
      { name: 'difficulty', note: 'easy, medium or hard. Defaults to medium.' },
      { name: 'tags', note: 'An array, or values separated by a vertical bar.' },
      { name: 'sourceKind', note: 'past_paper, manual_derived or demo. Defaults to manual_derived. This is shown to candidates on every question.' },
      { name: 'source', note: '{ label, paperCode, year, sitting, sectionLabel, questionNumber }.' },
      { name: 'answerConfidence', note: 'verified, provisional or unverified. Defaults to unverified.' },
      { name: 'reviewNotes', note: 'A note for other administrators. Candidates never see it.' },
      { name: 'status', note: 'Overrides the default status chosen below, record by record.' },
    ],
  },
];

export default function AdminImportPage() {
  useDocumentTitle('Import questions');

  const toast = useToast();
  const fileRef = useRef(null);

  const [text, setText] = useState('');
  const [parseError, setParseError] = useState('');
  const [defaultStatus, setDefaultStatus] = useState(CONTENT_STATUS.DRAFT);
  const [validation, setValidation] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [phase, setPhase] = useState(null); // 'validating' | 'importing'
  const busy = phase !== null;

  const recordCount = useMemo(() => {
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed.length : null;
    } catch {
      return null;
    }
  }, [text]);

  /** Any edit invalidates a previous validation: you cannot import unchecked text. */
  const changeText = (value) => {
    setText(value);
    setParseError('');
    setValidation(null);
    setOutcome(null);
  };

  const parseRecords = () => {
    if (!text.trim()) {
      setParseError('Paste some records first, or load a .json file.');
      return null;
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      setParseError(`That is not valid JSON: ${err.message}`);
      return null;
    }
    if (!Array.isArray(parsed)) {
      setParseError('The file must hold a JSON array of question records, wrapped in square brackets.');
      return null;
    }
    if (!parsed.length) {
      setParseError('The array is empty, so there is nothing to import.');
      return null;
    }
    setParseError('');
    return parsed;
  };

  const readFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const contents = await file.text();
      changeText(contents);
      toast.success(`${file.name} was loaded. Validate it before importing.`);
    } catch {
      toast.error('That file could not be read.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const runValidation = async () => {
    const questions = parseRecords();
    if (!questions) return;
    setPhase('validating');
    setOutcome(null);
    try {
      const result = await adminApi.import({ questions, dryRun: true, defaultStatus });
      setValidation(result);
      if (result.errors?.length) {
        toast.warning(`${result.errors.length} of ${result.total} records cannot be imported as they stand.`);
      } else {
        toast.success(`All ${result.total} records are ready to import.`);
      }
    } catch (err) {
      toast.error(err.message || 'The records could not be validated.');
    } finally {
      setPhase(null);
    }
  };

  const runImport = async () => {
    const questions = parseRecords();
    if (!questions) return;
    setPhase('importing');
    try {
      const result = await adminApi.import({ questions, dryRun: false, defaultStatus });
      setOutcome(result);
      setValidation(null);
      toast.success(`${result.created} created and ${result.updated} updated.`);
    } catch (err) {
      toast.error(err.message || 'The import did not complete.');
    } finally {
      setPhase(null);
    }
  };

  const copySample = async () => {
    try {
      await navigator.clipboard.writeText(SAMPLE_TEXT);
      toast.success('A sample record was copied to your clipboard.');
    } catch {
      // Clipboard access is often refused; putting the sample in the editor is
      // just as useful and never fails.
      changeText(SAMPLE_TEXT);
      toast.info('Your browser would not let us reach the clipboard, so the sample was put in the editor instead.');
    }
  };

  const canImport = Boolean(validation) && !busy;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-serif text-2xl font-semibold text-ink-900">Import questions</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-500">
          Paste a JSON array of question records, check it, then import. Records are validated one at a time, so a single
          malformed row does not stop the rest.
        </p>
      </header>

      <div className="rounded-xl border border-warning-500 bg-warning-50 p-4">
        <h2 className="flex items-center gap-2 font-serif text-sm font-semibold text-warning-600">
          <Icon name="alert" size={16} />
          What happens to content whose answer is not known
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-700">
          <li>
            A past paper question imported without an answer key is kept, but it is marked{' '}
            <strong className="font-semibold">unverified</strong> and held at{' '}
            <strong className="font-semibold">needs review</strong>. It will not be shown to a candidate.
          </li>
          <li>
            Any other question without a correct answer is rejected outright, because there is nothing it could teach.
          </li>
          <li>
            A record asking to be published without an explanation or a syllabus excerpt is rejected. Being told you are
            wrong, with no reason given, teaches nothing.
          </li>
          <li>Anything you import without stating an answer confidence is treated as unverified.</li>
        </ul>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* -------------------------------------------------------- editor */}
        <div className="min-w-0 space-y-5">
          <Card as="section">
            <CardHeader
              title="Records"
              subtitle={recordCount == null ? 'A JSON array of question records.' : `${recordCount} ${recordCount === 1 ? 'record' : 'records'} in the editor.`}
              icon={<Icon name="upload" size={18} />}
              action={
                <Button variant="ghost" size="sm" onClick={copySample} icon={<Icon name="note" size={14} />}>
                  Copy a sample record
                </Button>
              }
            />
            <div className="space-y-4 p-5">
              <div>
                <label htmlFor="import-file" className="mb-1.5 block text-sm font-medium text-ink-700">
                  Load a .json file
                </label>
                <input
                  id="import-file"
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={readFile}
                  className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-lg file:border-0 file:bg-paper-200 file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-ink-700 hover:file:bg-paper-300"
                />
                <p className="mt-1.5 text-xs text-ink-500">The file's contents are placed in the editor below, where you can check them.</p>
              </div>

              <Textarea
                label="Question records"
                rows={18}
                value={text}
                error={parseError}
                onChange={(e) => changeText(e.target.value)}
                placeholder={'[\n  { "subject": "DOC", "question": "…", "options": [ … ] }\n]'}
                className="[&_textarea]:font-mono [&_textarea]:text-xs"
                spellCheck="false"
              />

              <Select
                label="Default status for imported questions"
                value={defaultStatus}
                onChange={(e) => {
                  setDefaultStatus(e.target.value);
                  setValidation(null);
                }}
                hint="A record that names its own status overrides this."
              >
                {[CONTENT_STATUS.DRAFT, CONTENT_STATUS.NEEDS_REVIEW, CONTENT_STATUS.PUBLISHED].map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </Select>

              {defaultStatus === CONTENT_STATUS.PUBLISHED && (
                <p className="flex items-start gap-2 rounded-lg bg-warning-50 p-3 text-xs leading-relaxed text-warning-600">
                  <Icon name="alert" size={14} className="mt-px" />
                  Publishing on import puts these questions in front of candidates straight away. Only do this for
                  material you have already checked against the syllabus.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 border-t border-paper-200 pt-4">
                <Button onClick={runValidation} loading={phase === 'validating'} variant="secondary" icon={<Icon name="check" size={16} />}>
                  Validate
                </Button>
                <Button onClick={runImport} disabled={!canImport} loading={phase === 'importing'} icon={<Icon name="upload" size={16} />}>
                  Import {validation ? `${validation.total - validation.skipped} records` : ''}
                </Button>
                {!validation && !outcome && (
                  <p className="text-xs text-ink-500">Validation must be run before anything can be imported.</p>
                )}
              </div>
            </div>
          </Card>

          {validation && <ResultPanel result={validation} title="Validation result" dryRun />}
          {outcome && <ResultPanel result={outcome} title="Import result" defaultStatus={defaultStatus} />}
        </div>

        {/* ----------------------------------------------------- reference */}
        <aside className="min-w-0">
          <Card as="section">
            <CardHeader
              title="The import format"
              subtitle="Records are referenced by code and title, not by database identifiers, so a row can be written by hand."
              icon={<Icon name="book" size={18} />}
            />
            <div className="space-y-5 p-5">
              {FIELD_REFERENCE.map((group) => (
                <div key={group.group}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">{group.group}</h3>
                  <dl className="space-y-2.5">
                    {group.fields.map((field) => (
                      <div key={field.name} className="rounded-lg border border-paper-200 p-3">
                        <dt className="font-mono text-xs font-semibold text-brand-800">{field.name}</dt>
                        <dd className="mt-1 text-xs leading-relaxed text-ink-600">{field.note}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}

              <details className="rounded-lg border border-paper-300 bg-paper-50">
                <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-ink-700">
                  A well-formed example
                </summary>
                <pre className="overflow-x-auto border-t border-paper-200 p-3 text-[11px] leading-relaxed text-ink-700">
                  {SAMPLE_TEXT}
                </pre>
              </details>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function ResultPanel({ result, title, dryRun = false, defaultStatus }) {
  const clean = !result.errors?.length;

  return (
    <Card as="section">
      <CardHeader
        title={title}
        subtitle={dryRun ? 'Nothing has been written yet.' : 'These questions are now in the bank.'}
        icon={<Icon name={clean ? 'check' : 'alert'} size={18} />}
      />
      <div className="space-y-5 p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Records read" value={result.total} />
          <StatTile label={dryRun ? 'Would be written' : 'Created'} value={result.created} tone="success" />
          {!dryRun && <StatTile label="Updated" value={result.updated} tone="brand" />}
          <StatTile label="Skipped" value={result.skipped} tone={result.skipped ? 'danger' : 'neutral'} />
          {dryRun && <StatTile label="Warnings" value={result.warnings?.length || 0} tone={result.warnings?.length ? 'warning' : 'neutral'} />}
        </div>

        {clean && (
          <p className="flex items-start gap-2 rounded-lg bg-success-50 p-3 text-sm leading-relaxed text-success-700">
            <Icon name="check" size={15} className="mt-0.5" />
            {dryRun
              ? 'Every record is well formed. You can import them now.'
              : 'Every record was imported without an error.'}
          </p>
        )}

        {!dryRun && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              to={`/admin/questions?status=${defaultStatus || CONTENT_STATUS.DRAFT}`}
              icon={<Icon name="eye" size={15} />}
            >
              See the imported questions
            </Button>
            <Button variant="ghost" to="/admin/questions?answerConfidence=unverified">
              Review unverified answers
            </Button>
          </div>
        )}

        {result.errors?.length > 0 && (
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-danger-600">
              <Icon name="alert" size={15} />
              {result.errors.length} {result.errors.length === 1 ? 'record was rejected' : 'records were rejected'}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] border-collapse text-sm">
                <caption className="sr-only">Records that could not be imported, and why.</caption>
                <thead>
                  <tr className="border-b border-paper-200 text-left text-xs uppercase tracking-wide text-ink-400">
                    <th scope="col" className="py-2 pr-3 font-medium">Line</th>
                    <th scope="col" className="px-3 py-2 font-medium">Identifier</th>
                    <th scope="col" className="px-3 py-2 font-medium">What is wrong</th>
                  </tr>
                </thead>
                <tbody>
                  {result.errors.map((row, index) => (
                    <tr key={`${row.line}-${index}`} className="border-b border-paper-100 last:border-0 align-top">
                      <th scope="row" className="tabular py-2.5 pr-3 text-left font-normal text-ink-700">
                        {row.line}
                      </th>
                      <td className="px-3 py-2.5 font-mono text-xs text-ink-600">{row.questionId || '—'}</td>
                      <td className="px-3 py-2.5">
                        <ul className="space-y-1 text-sm text-ink-700">
                          {row.problems.map((problem, i) => (
                            <li key={i} className="flex gap-1.5">
                              <Icon name="close" size={12} className="mt-1 shrink-0 text-danger-500" />
                              {problem}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {result.warnings?.length > 0 && (
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-warning-600">
              <Icon name="info" size={15} />
              {result.warnings.length} {result.warnings.length === 1 ? 'record imported with a warning' : 'records imported with warnings'}
            </h3>
            <ul className="space-y-2">
              {result.warnings.map((row, index) => (
                <li key={`${row.line}-${index}`} className="rounded-lg border border-warning-500/40 bg-warning-50 p-3">
                  <p className="flex flex-wrap items-center gap-2 text-xs text-ink-600">
                    <Badge tone="warning" size="sm">
                      Line {row.line}
                    </Badge>
                    <span className="font-mono">{row.questionId || 'No identifier'}</span>
                  </p>
                  <ul className="mt-1.5 space-y-1 text-sm leading-relaxed text-ink-700">
                    {row.warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!clean && (
          <p className="text-xs leading-relaxed text-ink-500">
            Correct the records listed above and validate again. The records that passed are unaffected by the ones that
            failed.
          </p>
        )}

        {result.total === 0 && <EmptyState icon="inbox" title="Nothing was read" message="The array held no records." />}
      </div>
    </Card>
  );
}
