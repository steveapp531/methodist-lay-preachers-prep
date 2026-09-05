import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { libraryApi } from '@/services/api';
import { useAsync, useDebounced, useDocumentTitle } from '@/hooks';
import { useToast } from '@/context/ToastContext';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Icon,
  Input,
  Modal,
  Skeleton,
  Tabs,
  Textarea,
  cx,
} from '@/components/ui';
import { relativeTime } from '@/utils/format';

/** Colours a candidate can use to sort their own notes by eye. */
const COLOURS = [
  { value: '', label: 'None', swatch: 'bg-paper-300', accent: 'border-l-paper-300' },
  { value: 'brand', label: 'Indigo', swatch: 'bg-brand-600', accent: 'border-l-brand-600' },
  { value: 'gold', label: 'Gold', swatch: 'bg-gold-500', accent: 'border-l-gold-500' },
  { value: 'flame', label: 'Scarlet', swatch: 'bg-flame-500', accent: 'border-l-flame-500' },
  { value: 'success', label: 'Green', swatch: 'bg-success-500', accent: 'border-l-success-500' },
];

const EMPTY_DRAFT = { title: '', body: '', tags: '', colour: '', pinned: false };

/**
 * Everything the candidate has written down, in one place.
 *
 * Notes are private. The only exception is study material an administrator has
 * deliberately published, which is shown separately and cannot be edited.
 */
export default function NotesPage() {
  useDocumentTitle('Notes');

  const toast = useToast();
  const { data, error, loading, reload } = useAsync(() => libraryApi.notes({ limit: 100 }), []);

  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const search = useDebounced(query.trim().toLowerCase(), 250);

  const [editor, setEditor] = useState(null); // { note|null, draft }
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const allNotes = useMemo(() => data?.notes || [], [data]);

  const ownNotes = useMemo(
    () => allNotes.filter((note) => note.isOwn !== false).sort(byPinnedThenUpdated),
    [allNotes],
  );
  const sharedNotes = useMemo(
    () => allNotes.filter((note) => note.isOwn === false && note.visibility === 'shared').sort(byPinnedThenUpdated),
    [allNotes],
  );

  const counts = useMemo(
    () => ({
      all: ownNotes.length,
      topic: ownNotes.filter((note) => note.targetType === 'topic').length,
      question: ownNotes.filter((note) => note.targetType === 'question').length,
      general: ownNotes.filter((note) => !['topic', 'question'].includes(note.targetType)).length,
    }),
    [ownNotes],
  );

  const visible = useMemo(() => {
    return ownNotes.filter((note) => {
      if (filter === 'topic' && note.targetType !== 'topic') return false;
      if (filter === 'question' && note.targetType !== 'question') return false;
      if (filter === 'general' && ['topic', 'question'].includes(note.targetType)) return false;
      if (!search) return true;
      const haystack = `${note.title || ''} ${note.body || ''} ${(note.tags || []).join(' ')}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [ownNotes, filter, search]);

  /* ---------------------------------------------------------------- actions */

  const openNew = () => setEditor({ note: null, draft: { ...EMPTY_DRAFT } });

  const openEdit = (note) =>
    setEditor({
      note,
      draft: {
        title: note.title || '',
        body: note.body || '',
        tags: (note.tags || []).join(', '),
        colour: note.colour || '',
        pinned: Boolean(note.pinned),
      },
    });

  const save = async () => {
    if (!editor?.draft.body.trim()) return;
    setSaving(true);
    const payload = {
      title: editor.draft.title.trim(),
      body: editor.draft.body.trim(),
      tags: editor.draft.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 12),
      colour: editor.draft.colour,
      pinned: editor.draft.pinned,
    };

    try {
      if (editor.note) await libraryApi.updateNote(editor.note._id, payload);
      else await libraryApi.createNote({ targetType: 'general', ...payload });
      setEditor(null);
      await reload();
      toast.success(editor.note ? 'Note updated.' : 'Note saved.');
    } catch (err) {
      toast.error(err?.message || 'We could not save that note.');
    } finally {
      setSaving(false);
    }
  };

  const togglePinned = async (note) => {
    setBusyId(note._id);
    try {
      await libraryApi.updateNote(note._id, { pinned: !note.pinned });
      await reload();
    } catch (err) {
      toast.error(err?.message || 'We could not change that note.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await libraryApi.deleteNote(pendingDelete._id);
      setPendingDelete(null);
      await reload();
      toast.success('Note deleted.');
    } catch (err) {
      toast.error(err?.message || 'We could not delete that note.');
    } finally {
      setDeleting(false);
    }
  };

  /* ----------------------------------------------------------------- render */

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-reading">
          <h1 className="font-serif text-2xl font-semibold text-ink-900 sm:text-3xl">Notes</h1>
          <p className="mt-2 text-reading-base leading-relaxed text-ink-600">
            Everything you have written down while studying. Your notes are private to you; nobody else can read them.
          </p>
        </div>
        <Button onClick={openNew} icon={<Icon name="plus" size={16} />}>
          New note
        </Button>
      </header>

      {loading && <NotesSkeleton />}

      {!loading && error && <ErrorState error={error} onRetry={reload} className="card" />}

      {!loading && !error && (
        <>
          {ownNotes.length === 0 && sharedNotes.length === 0 ? (
            <Card>
              <EmptyState
                icon="note"
                title="You have not written any notes yet"
                message="Notes are the quickest way to hold on to something you have just understood. Write one here, or add one while reading a topic."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button onClick={openNew} icon={<Icon name="plus" size={15} />}>
                      Write your first note
                    </Button>
                    <Button variant="secondary" to="/study" icon={<Icon name="book" size={15} />}>
                      Go to Study
                    </Button>
                  </div>
                }
              />
            </Card>
          ) : (
            <>
              {ownNotes.length > 0 && (
                <Card>
                  <div className="border-b border-paper-200 p-4">
                    <Input
                      label="Search your notes"
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search titles, text and tags"
                      hint={search ? `${visible.length} of ${counts.all} notes match` : undefined}
                    />
                  </div>
                  <Tabs
                    className="px-2"
                    active={filter}
                    onChange={setFilter}
                    tabs={[
                      { key: 'all', label: 'All', count: counts.all },
                      { key: 'topic', label: 'On a topic', count: counts.topic },
                      { key: 'question', label: 'On a question', count: counts.question },
                      { key: 'general', label: 'General', count: counts.general },
                    ]}
                  />

                  {visible.length === 0 ? (
                    <EmptyState
                      icon="search"
                      title="No notes match"
                      message="Try a different search, or another filter."
                      action={
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setQuery('');
                            setFilter('all');
                          }}
                        >
                          Clear the filters
                        </Button>
                      }
                    />
                  ) : (
                    <ul className="grid gap-4 p-4 md:grid-cols-2">
                      {visible.map((note) => (
                        <li key={note._id} className="flex">
                          <NoteCard
                            note={note}
                            busy={busyId === note._id}
                            onEdit={() => openEdit(note)}
                            onDelete={() => setPendingDelete(note)}
                            onTogglePin={() => togglePinned(note)}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}

              {sharedNotes.length > 0 && (
                <section aria-labelledby="shared-heading" className="space-y-3">
                  <div>
                    <h2 id="shared-heading" className="font-serif text-lg font-semibold text-ink-900">
                      Shared study notes
                    </h2>
                    <p className="mt-1 max-w-reading text-sm text-ink-600">
                      Published by an administrator for every candidate. You can read these but not change them.
                    </p>
                  </div>
                  <ul className="grid gap-4 md:grid-cols-2">
                    {sharedNotes.map((note) => (
                      <li key={note._id} className="flex">
                        <NoteCard note={note} readOnly />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </>
      )}

      <NoteEditor
        editor={editor}
        saving={saving}
        onChange={(patch) => setEditor((current) => ({ ...current, draft: { ...current.draft, ...patch } }))}
        onClose={() => setEditor(null)}
        onSave={save}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
        onConfirm={remove}
        loading={deleting}
        tone="danger"
        confirmLabel="Delete note"
        title="Delete this note?"
        message={
          pendingDelete?.title
            ? `“${pendingDelete.title}” will be removed. This cannot be undone.`
            : 'This note will be removed. This cannot be undone.'
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------- note card --- */

function NoteCard({ note, readOnly = false, busy = false, onEdit, onDelete, onTogglePin }) {
  const [expanded, setExpanded] = useState(false);
  const colour = COLOURS.find((entry) => entry.value === (note.colour || '')) || COLOURS[0];
  const long = (note.body || '').length > 320 || (note.body || '').split('\n').length > 5;

  return (
    <Card className={cx('flex w-full flex-col border-l-4', colour.accent)}>
      <div className="flex-1 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {note.pinned && (
                <Badge tone="gold" size="sm" icon={<Icon name="bookmark" size={10} />}>
                  Pinned
                </Badge>
              )}
              <AttachmentBadge note={note} />
            </div>
            <h3 className="mt-1.5 font-serif text-base font-semibold text-ink-900">
              {note.title || <span className="text-ink-500">Untitled note</span>}
            </h3>
          </div>

          {!readOnly && (
            <div className="flex shrink-0 gap-0.5">
              <button
                type="button"
                onClick={onTogglePin}
                disabled={busy}
                aria-pressed={Boolean(note.pinned)}
                aria-label={note.pinned ? 'Unpin this note' : 'Pin this note'}
                className={cx(
                  'rounded-lg p-1.5 transition-colors disabled:opacity-50',
                  note.pinned ? 'text-gold-600 hover:bg-gold-50' : 'text-ink-400 hover:bg-paper-100 hover:text-ink-700',
                )}
              >
                <Icon name={note.pinned ? 'bookmark-check' : 'bookmark'} size={15} />
              </button>
              <button
                type="button"
                onClick={onEdit}
                aria-label={`Edit ${note.title || 'this note'}`}
                className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-paper-100 hover:text-ink-700"
              >
                <Icon name="pen" size={15} />
              </button>
              <button
                type="button"
                onClick={onDelete}
                aria-label={`Delete ${note.title || 'this note'}`}
                className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600"
              >
                <Icon name="trash" size={15} />
              </button>
            </div>
          )}
        </div>

        <p
          className={cx(
            'mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-700',
            !expanded && long && 'line-clamp-5',
          )}
        >
          {note.body}
        </p>

        {long && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="mt-1.5 text-xs font-medium text-brand-700 hover:underline"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}

        {note.tags?.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {note.tags.map((tag) => (
              <li key={tag}>
                <Badge tone="neutral" size="sm">
                  #{tag}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-paper-200 px-4 py-2.5 text-xs text-ink-400">
        <span>Updated {relativeTime(note.updatedAt)}</span>
        {readOnly && (
          <Badge tone="gold" size="sm" icon={<Icon name="users" size={10} />}>
            Shared — read only
          </Badge>
        )}
      </div>
    </Card>
  );
}

function AttachmentBadge({ note }) {
  if (note.targetType === 'topic' && note.topic) {
    return (
      <Link
        to={`/study/topic/${note.topic._id}`}
        className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-800 hover:bg-brand-100"
      >
        <Icon name="book" size={10} />
        {note.topic.title || 'A topic'}
      </Link>
    );
  }

  if (note.targetType === 'question' && note.question) {
    return (
      <Link
        to={`/questions/${note.question._id}`}
        className="inline-flex max-w-[16rem] items-center gap-1 truncate rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-800 hover:bg-brand-100"
      >
        <Icon name="quiz" size={10} />
        <span className="truncate">{note.question.prompt || note.question.questionId || 'A question'}</span>
      </Link>
    );
  }

  return (
    <Badge tone="outline" size="sm" icon={<Icon name="note" size={10} />}>
      General
    </Badge>
  );
}

/* ----------------------------------------------------------------- editor --- */

function NoteEditor({ editor, saving, onChange, onClose, onSave }) {
  const open = Boolean(editor);
  const draft = editor?.draft || EMPTY_DRAFT;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editor?.note ? 'Edit note' : 'New note'}
      description="Only you can see this."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onSave} loading={saving} disabled={!draft.body.trim()}>
            {editor?.note ? 'Save changes' : 'Save note'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <Input
          label="Title"
          value={draft.title}
          maxLength={200}
          onChange={(event) => onChange({ title: event.target.value })}
          placeholder="A short heading (optional)"
        />

        <Textarea
          label="Note"
          required
          rows={7}
          value={draft.body}
          maxLength={20000}
          onChange={(event) => onChange({ body: event.target.value })}
          placeholder="What you want to remember…"
        />

        <Input
          label="Tags"
          value={draft.tags}
          onChange={(event) => onChange({ tags: event.target.value })}
          hint="Separate tags with commas, for example: covenant, prophets"
          placeholder="covenant, prophets"
        />

        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-ink-700">Colour</legend>
          <div className="flex flex-wrap gap-2">
            {COLOURS.map((entry) => {
              const selected = draft.colour === entry.value;
              return (
                <label
                  key={entry.value || 'none'}
                  className={cx(
                    'inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                    'focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2',
                    selected ? 'border-brand-600 bg-brand-50 font-medium text-brand-800' : 'border-paper-300 text-ink-600 hover:bg-paper-100',
                  )}
                >
                  <input
                    type="radio"
                    name="note-colour"
                    value={entry.value}
                    checked={selected}
                    onChange={() => onChange({ colour: entry.value })}
                    className="sr-only"
                  />
                  <span className={cx('h-3.5 w-3.5 rounded-full', entry.swatch)} aria-hidden="true" />
                  {entry.label}
                  {selected && <Icon name="check" size={13} />}
                </label>
              );
            })}
          </div>
        </fieldset>

        <Checkbox
          label="Pin this note"
          description="Pinned notes are listed first."
          checked={draft.pinned}
          onChange={(event) => onChange({ pinned: event.target.checked })}
        />
      </form>
    </Modal>
  );
}

/* -------------------------------------------------------------- utilities --- */

function byPinnedThenUpdated(a, b) {
  if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
  return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
}

function NotesSkeleton() {
  return (
    <div className="card" aria-hidden="true">
      <div className="border-b border-paper-200 p-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-2 h-11 w-full" />
      </div>
      <div className="flex gap-4 border-b border-paper-300 px-4 py-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-4 w-20" />
        ))}
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-paper-300 p-4">
            <Skeleton className="h-4 w-24" rounded="rounded-full" />
            <Skeleton className="mt-2 h-5 w-2/3" />
            <Skeleton className="mt-3 h-3.5 w-full" />
            <Skeleton className="mt-2 h-3.5 w-full" />
            <Skeleton className="mt-2 h-3.5 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
