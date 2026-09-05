import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { contentApi, libraryApi } from '@/services/api';
import { useAsync, useDocumentTitle } from '@/hooks';
import { Badge, Button, Card, EmptyState, ErrorState, Icon, Skeleton, SkeletonText } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { QUESTION_TYPE_LABELS, plural } from '@/utils/format';

/**
 * One passage.
 *
 * The passage is shown verse by verse from the bundled Authorised (King James)
 * Version, which is out of copyright. Where the syllabus mis-cites a reference
 * and it resolves to nothing, the page says so plainly and sends the candidate
 * to their own Bible rather than showing an empty panel.
 */
export default function ScriptureDetailPage() {
  const { reference: rawReference } = useParams();
  const reference = safeDecode(rawReference);
  const toast = useToast();

  useDocumentTitle(reference || 'Scripture');

  const { data, error, loading, reload } = useAsync(() => contentApi.scripture(reference), [reference]);
  const scripture = data?.scripture || null;
  const questions = data?.questions || [];

  const [bookmark, setBookmark] = useState(null);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);

  // Knowing whether it is already bookmarked lets the action be a real toggle.
  useEffect(() => {
    let cancelled = false;
    libraryApi
      .bookmarks({ targetType: 'scripture', limit: 100 })
      .then((result) => {
        if (cancelled) return;
        const match = (result?.bookmarks || []).find((b) => b.scriptureReference === reference);
        setBookmark(match || null);
      })
      .catch(() => {
        /* The bookmark state is a convenience; the page works without it. */
      });
    return () => {
      cancelled = true;
    };
  }, [reference]);

  const toggleBookmark = async () => {
    setBookmarkBusy(true);
    try {
      if (bookmark) {
        await libraryApi.deleteBookmark(bookmark._id);
        setBookmark(null);
        toast.success('Bookmark removed.');
      } else {
        const result = await libraryApi.createBookmark({ targetType: 'scripture', scriptureReference: reference });
        setBookmark(result?.bookmark || { _id: 'pending', scriptureReference: reference });
        toast.success('Bookmarked.');
      }
    } catch (err) {
      toast.error(err?.message || 'The bookmark could not be saved.');
    } finally {
      setBookmarkBusy(false);
    }
  };

  /* --------------------------------------------------------------- states --- */

  if (loading) return <DetailSkeleton />;

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <BackLink />
        <Card className="mt-4">
          <ErrorState error={error} onRetry={reload} />
        </Card>
      </div>
    );
  }

  if (!scripture) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <BackLink />
        <Card className="mt-4">
          <EmptyState
            icon="scroll"
            title={`${reference} is not in the index`}
            message="The syllabus does not cite this passage, or it is spelled differently in the index."
            action={<Button to="/scripture">Browse the scripture index</Button>}
          />
        </Card>
      </div>
    );
  }

  const citations = scripture.citedIn || [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <BackLink />

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink-900 sm:text-3xl">{scripture.reference}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-ink-500">
            <Badge tone="gold" size="sm">
              {scripture.testament === 'OT' ? 'Old Testament' : 'New Testament'}
            </Badge>
            <span>{scripture.book}</span>
            <span aria-hidden="true">·</span>
            <span>cited {plural(scripture.citationCount || citations.length, 'time')} in the syllabus</span>
          </p>
        </div>

        <Button
          variant={bookmark ? 'gold' : 'secondary'}
          onClick={toggleBookmark}
          loading={bookmarkBusy}
          aria-pressed={Boolean(bookmark)}
          icon={<Icon name={bookmark ? 'bookmark-check' : 'bookmark'} size={15} />}
        >
          {bookmark ? 'Bookmarked' : 'Bookmark'}
        </Button>
      </header>

      {/* The passage itself. */}
      <Card className="mt-6 overflow-hidden">
        {scripture.verseList?.length || scripture.text ? (
          <>
            <div className="bg-paper-50 px-5 py-5 sm:px-7 sm:py-6">
              {scripture.verseList?.length ? (
                <ol className="max-w-reading space-y-3">
                  {scripture.verseList.map((verse) => (
                    <li key={verse.verse} className="flex gap-3">
                      <span
                        className="mt-1 w-7 shrink-0 select-none text-right font-sans text-xs font-semibold tabular text-gold-600"
                        aria-hidden="true"
                      >
                        {verse.verse}
                      </span>
                      <p className="font-serif text-reading-base text-ink-800">
                        <span className="sr-only">Verse {verse.verse}. </span>
                        {verse.text}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <blockquote className="border-l-[3px] border-gold-500 pl-4">
                  <p className="prose-manual whitespace-pre-line">{scripture.text}</p>
                </blockquote>
              )}
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-paper-200 px-5 py-3 text-xs text-ink-500 sm:px-7">
              <span>
                <strong className="font-semibold text-ink-700">{scripture.reference}</strong>
                {scripture.translation ? ` · ${scripture.translation}` : ''}
              </span>
              {scripture.truncated && (
                <span className="text-ink-400">
                  Shown in part — read the whole {scripture.wholeChapter ? 'chapter' : 'passage'} in your Bible.
                </span>
              )}
            </footer>
          </>
        ) : (
          <div className="p-5 sm:p-6">
            <p className="flex items-start gap-2.5 text-sm leading-relaxed text-ink-600">
              <Icon name="info" size={16} className="mt-0.5 shrink-0 text-warning-500" />
              <span>
                This passage could not be matched to a chapter and verse, which usually means the syllabus cites it
                slightly wrongly. Please look up{' '}
                <strong className="font-semibold text-ink-800">{scripture.reference}</strong> in your own Bible.
              </span>
            </p>
          </div>
        )}
      </Card>

      {/* Where the syllabus leans on it. */}
      <section className="mt-8">
        <h2 className="mb-3 font-serif text-lg font-semibold text-ink-900">Where the syllabus cites this</h2>

        {citations.length ? (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-paper-200">
              {citations.map((citation, i) => {
                const topicId = citation.topic?._id || (typeof citation.topic === 'string' ? citation.topic : null);
                const subjectName = citation.subject?.name || citation.subject?.shortName || citation.subjectName;
                const topicTitle = citation.topic?.title || citation.topicTitle;

                const body = (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink-800">{topicTitle || 'Syllabus passage'}</p>
                      <p className="mt-0.5 text-sm text-ink-500">{subjectName || 'Official syllabus'}</p>
                      {citation.citation && <p className="mt-1 text-xs text-ink-400">{citation.citation}</p>}
                    </div>
                    {topicId && <Icon name="chevronRight" size={16} className="mt-1 shrink-0 text-ink-300" strokeStyle />}
                  </>
                );

                return (
                  <li key={`${topicId || 'citation'}-${i}`}>
                    {topicId ? (
                      <Link
                        to={`/study/topic/${topicId}`}
                        className="flex items-start gap-4 px-5 py-3.5 transition-colors hover:bg-paper-50"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="flex items-start gap-4 px-5 py-3.5">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : (
          <Card>
            <EmptyState
              icon="book"
              title="No syllabus citation recorded"
              message="This passage is in the index but no syllabus topic has been linked to it yet."
            />
          </Card>
        )}
      </section>

      {/* Questions that turn on it. */}
      <section className="mt-8">
        <h2 className="mb-3 font-serif text-lg font-semibold text-ink-900">Questions that use this passage</h2>

        {questions.length ? (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-paper-200">
              {questions.map((question) => (
                <li key={question._id || question.questionId}>
                  <Link
                    to={`/questions/${question._id || question.questionId}`}
                    className="flex items-start gap-4 px-5 py-3.5 transition-colors hover:bg-paper-50"
                  >
                    <Icon name="quiz" size={17} className="mt-0.5 shrink-0 text-brand-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-relaxed text-ink-800">{question.prompt}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                        <Badge tone="outline" size="sm">
                          {QUESTION_TYPE_LABELS[question.type] || question.type}
                        </Badge>
                        {question.topic?.title && <span>{question.topic.title}</span>}
                      </p>
                    </div>
                    <Icon name="chevronRight" size={16} className="mt-1 shrink-0 text-ink-300" strokeStyle />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <Card>
            <EmptyState
              icon="quiz"
              title="No question uses this passage yet"
              message="When a question cites this reference it will be listed here, so you can test yourself on it."
              action={
                <Button to="/quiz" variant="secondary">
                  Set up a practice quiz
                </Button>
              }
            />
          </Card>
        )}
      </section>
    </div>
  );
}

/** The router decodes route parameters; this only guards a stray percent sign. */
function safeDecode(value) {
  try {
    return decodeURIComponent(value || '');
  } catch {
    return value || '';
  }
}

function BackLink() {
  return (
    <Link to="/scripture" className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:underline">
      <Icon name="chevronLeft" size={15} strokeStyle />
      Scripture index
    </Link>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6" aria-hidden="true">
      <Skeleton className="h-4 w-32" rounded="rounded" />
      <Skeleton className="mt-4 h-8 w-1/2" rounded="rounded" />
      <Skeleton className="mt-2 h-4 w-1/3" rounded="rounded" />
      <Card className="mt-6 p-6">
        <SkeletonText lines={3} />
      </Card>
      <Skeleton className="mt-8 h-5 w-48" rounded="rounded" />
      <Card className="mt-3 overflow-hidden">
        <ul className="divide-y divide-paper-200">
          {[0, 1, 2].map((i) => (
            <li key={i} className="px-5 py-4">
              <Skeleton className="h-4 w-2/5" rounded="rounded" />
              <Skeleton className="mt-2 h-3 w-1/4" rounded="rounded" />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
