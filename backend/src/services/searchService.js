import { CONTENT_STATUS } from '../../../shared/constants.js';
import { Flashcard } from '../models/Flashcard.js';
import { Note } from '../models/Note.js';
import { Question } from '../models/Question.js';
import { ScriptureReference } from '../models/ScriptureReference.js';
import { Topic } from '../models/Topic.js';
import { escapeRegex, truncate } from '../utils/text.js';

/**
 * Global search across every kind of content the candidate can reach.
 *
 * Each result declares where it came from and carries the route needed to open
 * it, so the interface never has to guess how to link a hit.
 */
export async function globalSearch({ query, examId, userId, limitPerType = 5, types = null }) {
  const term = String(query || '').trim();
  if (term.length < 2) return { query: term, results: [], total: 0 };

  const rx = new RegExp(escapeRegex(term), 'i');
  const want = (kind) => !types?.length || types.includes(kind);
  const jobs = [];

  if (want('topic')) {
    jobs.push(
      Topic.find({ exam: examId, isPublished: true, $or: [{ title: rx }, { summary: rx }, { 'blocks.text': rx }] })
        .limit(limitPerType)
        .populate('subject', 'name shortName slug')
        .populate('chapter', 'title number')
        .lean()
        .then((rows) =>
          rows.map((t) => ({
            kind: 'topic',
            id: String(t._id),
            title: t.title,
            subtitle: `${t.subject?.shortName || ''} · ${t.chapter?.title || ''}`.trim(),
            excerpt: truncate(t.summary || t.blocks?.find((b) => rx.test(b.text))?.text || '', 200),
            route: `/study/topic/${t._id}`,
          })),
        ),
    );
  }

  if (want('question')) {
    jobs.push(
      Question.find({ exam: examId, status: CONTENT_STATUS.PUBLISHED, $or: [{ prompt: rx }, { explanation: rx }, { tags: rx }] })
        .limit(limitPerType)
        .populate('subject', 'shortName name')
        .populate('topic', 'title')
        .lean()
        .then((rows) =>
          rows.map((q) => ({
            kind: 'question',
            id: String(q._id),
            title: truncate(q.prompt, 140),
            subtitle: `${q.subject?.shortName || ''} · ${q.topic?.title || 'Unassigned'}`,
            excerpt: truncate(q.explanation, 180),
            badge: q.sourceKind,
            route: `/questions/${q._id}`,
          })),
        ),
    );
  }

  if (want('flashcard')) {
    jobs.push(
      Flashcard.find({ exam: examId, status: CONTENT_STATUS.PUBLISHED, $or: [{ front: rx }, { back: rx }] })
        .limit(limitPerType)
        .populate('topic', 'title')
        .lean()
        .then((rows) =>
          rows.map((f) => ({
            kind: 'flashcard',
            id: String(f._id),
            title: truncate(f.front, 140),
            subtitle: f.topic?.title || '',
            excerpt: truncate(f.back, 180),
            route: `/flashcards?card=${f._id}`,
          })),
        ),
    );
  }

  if (want('scripture')) {
    jobs.push(
      ScriptureReference.find({ exam: examId, $or: [{ reference: rx }, { book: rx }] })
        .sort({ bookOrder: 1, chapter: 1 })
        .limit(limitPerType)
        .lean()
        .then((rows) =>
          rows.map((s) => ({
            kind: 'scripture',
            id: String(s._id),
            title: s.reference,
            subtitle: `${s.testament === 'OT' ? 'Old' : 'New'} Testament · cited ${s.citationCount} time${s.citationCount === 1 ? '' : 's'}`,
            excerpt: s.text ? truncate(s.text, 180) : (s.citedIn?.[0]?.citation || ''),
            route: `/scripture/${encodeURIComponent(s.reference)}`,
          })),
        ),
    );
  }

  if (want('note') && userId) {
    jobs.push(
      Note.find({ $or: [{ user: userId }, { visibility: 'shared' }], $and: [{ $or: [{ title: rx }, { body: rx }] }] })
        .limit(limitPerType)
        .populate('topic', 'title')
        .lean()
        .then((rows) =>
          rows.map((n) => ({
            kind: 'note',
            id: String(n._id),
            title: n.title || truncate(n.body, 60),
            subtitle: n.visibility === 'shared' ? 'Shared study note' : (n.topic?.title || 'Personal note'),
            excerpt: truncate(n.body, 180),
            route: `/notes?note=${n._id}`,
          })),
        ),
    );
  }

  const grouped = await Promise.all(jobs);
  const results = grouped.flat();
  return { query: term, results, total: results.length, byKind: countBy(results) };
}

function countBy(rows) {
  return rows.reduce((acc, row) => {
    acc[row.kind] = (acc[row.kind] || 0) + 1;
    return acc;
  }, {});
}
