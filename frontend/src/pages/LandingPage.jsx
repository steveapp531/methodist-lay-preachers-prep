import { Link } from 'react-router-dom';
import { contentApi } from '@/services/api';
import { useAsync, useDocumentTitle } from '@/hooks';
import { Badge, Button, Icon, Skeleton, cx } from '@/components/ui';
import { CrossFlame } from '@/layouts/AppLayout';
import { EXAM_STAGE_CODES } from '@shared/constants';

/**
 * A half-drop lattice of small crosses, used at very low opacity behind the
 * deep sections. Two crosses to the tile rather than one, so the repeat reads
 * as a woven altar cloth instead of a grid of stamps.
 */
const CROSS_LATTICE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='1.5' stroke-linecap='round'%3E%3Cpath d='M24 8v32M13 19h22'/%3E%3Cpath d='M72 56v32M61 67h22'/%3E%3C/g%3E%3C/svg%3E\")";

/**
 * The papers as they are printed in the syllabus. The page prefers what the API
 * reports, but a visitor who arrives while the server is unreachable should
 * still be told plainly what the platform covers, so this list stands in.
 */
const SYLLABUS_PAPERS = [
  {
    key: 'old-testament-studies',
    name: 'Old Testament Studies',
    description: 'The law, the histories, the prophets and the writings, and how they are read and preached today.',
  },
  {
    key: 'new-testament-studies',
    name: 'New Testament Studies',
    description: 'The Gospels, the Acts, the epistles and the Revelation, in their setting and in the pulpit.',
  },
  {
    key: 'doctrine',
    name: 'Doctrine',
    description: 'What the Church believes and confesses, and the Methodist emphases within that confession.',
  },
  {
    key: 'liturgics',
    name: 'Liturgics',
    description: 'The orders of service, the sacraments, and the conduct of public worship.',
  },
  {
    key: 'methodist-studies',
    name: 'Methodist Studies',
    description: 'Wesley, the people called Methodists, and the story and polity of the Methodist Church Ghana.',
  },
  {
    key: 'church-and-society',
    name: 'Church and Society',
    description: 'The witness of the Church in the community, and the questions society puts to it.',
  },
];

/** Quiet ordinals for the paper cards. Decorative; the name carries the meaning. */
const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI'];

const normalise = (value) => String(value || '').toLowerCase().replace(/[^a-z]/g, '');

/** Lets a paper returned by the API borrow its description if the API sends none. */
const DESCRIPTIONS_BY_NAME = new Map(SYLLABUS_PAPERS.map((paper) => [normalise(paper.name), paper.description]));

const FIGURES = [
  { value: '1,392', label: 'Practice questions', note: 'Across the six papers of Part 2' },
  { value: '775', label: 'From past papers', note: 'Transcribed, 2011 to 2025' },
  { value: '317', label: 'Syllabus topics', note: 'Set out as the syllabus words them' },
  { value: '977', label: 'Scripture passages', note: 'Indexed with their text' },
  { value: '360', label: 'Flashcards', note: 'Returning on a spaced schedule' },
  { value: '6', label: 'Papers', note: 'Covered in syllabus order' },
];

const PAST_PAPER_YEARS = [
  '2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018',
  '2019', '2020', '2021', '2022', '2023', '2024', '2025',
];

const PRACTICE = [
  {
    icon: 'book',
    title: 'The syllabus itself, not a summary of it',
    body:
      'Read the official syllabus a topic at a time, with its key points, key terms, examination focus and scripture references set beside the text. Nothing is paraphrased away.',
  },
  {
    icon: 'cards',
    title: 'Revision that returns at the right moment',
    body:
      'Flashcards, and the questions you found difficult, come back on a spaced schedule, so what you learned in March is still with you in July.',
  },
  {
    icon: 'exam',
    title: 'A full paper, against the clock',
    body:
      'Section A objective and compulsory, Section B answering three of five theory questions, two hours. The screen clears; only the paper remains.',
  },
  {
    icon: 'mic',
    title: 'Theory answers typed or dictated',
    body:
      'Write your theory answer, or speak it aloud and edit the transcript afterwards. Either way it is your own words that are marked.',
  },
  {
    icon: 'award',
    title: 'Marked against the rubric, criterion by criterion',
    body:
      'A theory answer is read against the criteria the examiner uses, and you are shown which points you made, which you touched on, and which you left out.',
  },
  {
    icon: 'chart',
    title: 'Progress you can check',
    body:
      'Your accuracy, your coverage of the syllabus, your mock performance and how steadily you have studied, gathered into one readiness figure with the evidence behind it.',
  },
];

/** One paper, presented as an entry in a syllabus rather than a tier in a price list. */
function PaperCard({ ordinal, name, description, shortName, topicCount, questionCount }) {
  return (
    <li className="relative flex h-full flex-col bg-white p-6 transition-colors duration-200 hover:bg-paper-50 sm:p-7">
      <span
        className="font-serif text-sm font-semibold tracking-[0.2em] text-gold-700"
        aria-hidden="true"
      >
        {ordinal}
      </span>
      <h3 className="mt-3 font-serif text-xl font-semibold leading-snug text-ink-900">{name}</h3>
      {description && <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-600">{description}</p>}
      {(shortName || topicCount > 0 || questionCount > 0) && (
        <div className="mt-5 flex flex-wrap items-center gap-1.5 border-t border-paper-200 pt-4">
          {shortName && (
            <Badge tone="outline" size="sm">
              {shortName}
            </Badge>
          )}
          {topicCount > 0 && (
            <Badge tone="neutral" size="sm">
              {topicCount} topics
            </Badge>
          )}
          {questionCount > 0 && (
            <Badge tone="brand" size="sm">
              {questionCount} questions
            </Badge>
          )}
        </div>
      )}
    </li>
  );
}

export default function LandingPage() {
  useDocumentTitle("Prepare for the Lay Preachers' Examination");

  const { data, error, loading, reload } = useAsync(async () => {
    const { exams } = await contentApi.exams();
    const list = Array.isArray(exams) ? exams : [];
    const stage =
      list.find((exam) => exam.code === EXAM_STAGE_CODES.PART2) ||
      list.find((exam) => exam.hasTheoryPaper) ||
      list[0] ||
      null;
    if (!stage) return { stage: null, subjects: [] };
    const detail = await contentApi.exam(stage._id);
    return { stage: detail?.exam || stage, subjects: detail?.subjects || [] };
  }, []);

  const subjects = data?.subjects || [];
  const isEmpty = !loading && !error && subjects.length === 0;
  const usingFallback = !loading && (error || isEmpty);

  return (
    <div className="flex min-h-screen flex-col bg-paper-100">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      {/* ------------------------------------------------------------ header */}
      <header className="sticky top-0 z-30 border-b border-paper-300/70 bg-paper-100/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-2.5"
            aria-label="Lay Preachers examination preparation, home"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-800 text-paper-50">
              <CrossFlame />
            </span>
            <span className="leading-tight">
              <span className="block font-serif text-sm font-semibold text-ink-900">Lay Preachers</span>
              <span className="block text-xs uppercase tracking-[0.14em] text-ink-400">Examination preparation</span>
            </span>
          </Link>

          <nav aria-label="Sections of this page" className="ml-6 hidden items-center gap-6 lg:flex">
            <a href="#papers" className="rounded text-sm text-ink-600 hover:text-brand-800">
              The papers
            </a>
            <a href="#teaching" className="rounded text-sm text-ink-600 hover:text-brand-800">
              How it teaches
            </a>
            <a href="#past-papers" className="rounded text-sm text-ink-600 hover:text-brand-800">
              Past papers
            </a>
          </nav>

          <div className="flex flex-1 items-center justify-end gap-2">
            <Button to="/login" variant="ghost" size="sm">
              Sign in
            </Button>
            <Button to="/register" size="sm">
              Create account
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        {/* -------------------------------------------------------------- hero */}
        <section className="relative overflow-hidden bg-brand-900" aria-labelledby="hero-heading">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: CROSS_LATTICE, backgroundSize: '96px' }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(110% 85% at 12% 0%, rgba(61,93,148,0.38) 0%, rgba(22,34,58,0) 62%), linear-gradient(to bottom, rgba(13,21,36,0) 45%, rgba(13,21,36,0.75) 100%)',
            }}
            aria-hidden="true"
          />

          <div className="relative mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:py-36">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs uppercase tracking-[0.2em] text-brand-200">
              <span className="h-px w-10 bg-gold-500" aria-hidden="true" />
              The Methodist Church Ghana &middot; Connexional Lay Preachers&rsquo; Examination, Part 2
            </p>

            <h1
              id="hero-heading"
              className="mt-7 max-w-4xl font-serif text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl"
            >
              Every answer traced back to the passage of the syllabus it came from.
            </h1>

            <p className="mt-7 max-w-2xl text-base leading-relaxed text-brand-100 sm:text-lg">
              A quiet place to work through the official syllabus, answer questions on it, and sit full timed papers in
              the format you will meet in the hall. When you are wrong, you are not simply marked down — you are told
              why, and shown where to read it.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                to="/register"
                size="lg"
                variant="gold"
                iconRight={<Icon name="chevronRight" size={16} strokeStyle />}
              >
                Create your account
              </Button>
              <Button to="/login" size="lg" variant="secondary">
                Sign in
              </Button>
            </div>

            <ul className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-brand-200 sm:mt-14">
              {[
                'Six papers, in syllabus order',
                '775 questions from real past papers',
                'Theory answers marked to the rubric',
              ].map((fact) => (
                <li key={fact} className="flex items-center gap-2.5">
                  <span className="h-1.5 w-1.5 rotate-45 bg-gold-500" aria-hidden="true" />
                  {fact}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* -------------------------------------------------------- figures --- */}
        <section className="border-b border-paper-300 bg-paper-50" aria-labelledby="figures-heading">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <h2 id="figures-heading" className="sr-only">
              What is on the platform
            </h2>
            <dl className="grid gap-px overflow-hidden rounded-xl border border-paper-300 bg-paper-300 sm:grid-cols-2 lg:grid-cols-3">
              {FIGURES.map((figure) => (
                <div key={figure.label} className="bg-paper-50 p-6">
                  <dt className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500">{figure.label}</dt>
                  <dd>
                    <span className="tabular mt-2 block font-serif text-3xl font-semibold leading-none text-brand-800">
                      {figure.value}
                    </span>
                    <span className="mt-2 block text-sm leading-relaxed text-ink-500">{figure.note}</span>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 max-w-3xl text-sm leading-relaxed text-ink-500">
              Scripture is quoted from the Authorised (King James) Version, which is in the public domain. Every figure
              above is a count of what is on the platform, not an estimate.
            </p>
          </div>
        </section>

        {/* --------------------------------------------------------- papers --- */}
        <section id="papers" className="scroll-mt-20 bg-paper-100" aria-labelledby="papers-heading">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.2em] text-gold-700">The syllabus</p>
              <h2 id="papers-heading" className="mt-3 font-serif text-2xl font-semibold text-ink-900 sm:text-3xl">
                The six papers of Part 2
              </h2>
              <p className="mt-4 text-base leading-relaxed text-ink-600">
                {data?.stage?.description ||
                  'Each paper is examined by an objective section and a theory section. The platform covers all six, topic by topic, in the order the syllabus sets them out.'}
              </p>
            </div>

            {loading && (
              <>
                <p className="sr-only" role="status">
                  Loading the papers of Part 2.
                </p>
                <ul className="mt-10 grid gap-px overflow-hidden rounded-xl border border-paper-300 bg-paper-300 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <li key={index} className="bg-white p-6 sm:p-7">
                      <Skeleton className="h-3.5 w-6" rounded="rounded" />
                      <Skeleton className="mt-4 h-5 w-2/3" rounded="rounded" />
                      <Skeleton className="mt-4 h-3 w-full" rounded="rounded" />
                      <Skeleton className="mt-2 h-3 w-11/12" rounded="rounded" />
                      <Skeleton className="mt-2 h-3 w-4/6" rounded="rounded" />
                      <Skeleton className="mt-6 h-5 w-24" rounded="rounded-full" />
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/*
              If the server cannot be reached, or has not published the papers yet,
              a visitor is still shown what the examination covers rather than an
              apology. The reason is stated plainly underneath.
            */}
            {usingFallback && (
              <>
                <ul className="mt-10 grid gap-px overflow-hidden rounded-xl border border-paper-300 bg-paper-300 sm:grid-cols-2 lg:grid-cols-3">
                  {SYLLABUS_PAPERS.map((paper, index) => (
                    <PaperCard
                      key={paper.key}
                      ordinal={NUMERALS[index]}
                      name={paper.name}
                      description={paper.description}
                    />
                  ))}
                </ul>
                <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-relaxed text-ink-500">
                  <Icon name="info" size={16} className="text-ink-400" />
                  {error
                    ? 'We could not reach the server just now, so these are the papers as printed in the syllabus.'
                    : 'The paper list has not been published to the platform yet, so these are the papers as printed in the syllabus.'}
                  {error && (
                    <button
                      type="button"
                      onClick={reload}
                      className="rounded font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
                    >
                      Try again
                    </button>
                  )}
                </p>
              </>
            )}

            {!loading && !error && subjects.length > 0 && (
              <ul className="mt-10 grid gap-px overflow-hidden rounded-xl border border-paper-300 bg-paper-300 sm:grid-cols-2 lg:grid-cols-3">
                {subjects.map((subject, index) => {
                  const name = subject.paper || subject.name;
                  return (
                    <PaperCard
                      key={subject._id}
                      ordinal={NUMERALS[index] || String(index + 1)}
                      name={name}
                      description={subject.description || DESCRIPTIONS_BY_NAME.get(normalise(name))}
                      shortName={subject.shortName}
                      topicCount={subject.stats?.topicCount}
                      questionCount={subject.stats?.questionCount}
                    />
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* ------------------------------------------------------- teaching --- */}
        <section
          id="teaching"
          className="scroll-mt-20 border-y border-paper-300 bg-paper-50"
          aria-labelledby="teaching-heading"
        >
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-16">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gold-700">The governing principle</p>
                <h2 id="teaching-heading" className="mt-3 font-serif text-2xl font-semibold text-ink-900 sm:text-3xl">
                  We do not just tell you whether you are right. We teach you why.
                </h2>
                <p className="mt-5 text-base leading-relaxed text-ink-600">
                  A question marked wrong and left there has taught you nothing. So every question on this platform
                  carries its answer, the reasoning behind that answer, the passage of the official syllabus the
                  reasoning rests on, and the scripture it cites.
                </p>
                <p className="mt-4 text-base leading-relaxed text-ink-600">
                  The panel beside this is what a candidate sees the moment an answer is submitted. It is shown here in
                  full, because it is the whole of the argument for using this rather than a stack of photocopies.
                </p>

                <ul className="mt-8 space-y-4 border-t border-paper-300 pt-8">
                  {[
                    { icon: 'check', text: 'The correct answer, and why each option stands or falls.' },
                    { icon: 'book', text: 'The syllabus topic the answer comes from, so you can go and read it.' },
                    { icon: 'scroll', text: 'The scripture cited, with its text, so you need not reach for a Bible.' },
                    { icon: 'target', text: 'The question set aside to return to you later, until it is secure.' },
                  ].map((item) => (
                    <li key={item.text} className="flex gap-3.5">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700">
                        <Icon name={item.icon} size={15} />
                      </span>
                      <span className="text-sm leading-relaxed text-ink-600">{item.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/*
                A real question from the bank, shown exactly as the platform
                stores it — Church and Society, Section A, September 2025, with
                its own syllabus excerpt and scripture. Nothing here is mocked
                up: a page arguing that the platform never invents content
                should not open with invented content.
              */}
              <figure className="m-0">
                <div className="overflow-hidden rounded-xl border border-paper-300 bg-white shadow-lift">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-paper-200 bg-paper-100 px-5 py-3">
                    <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500">
                      Church and Society &middot; Section A
                    </span>
                    <Badge tone="gold" size="sm">
                      September 2025 paper
                    </Badge>
                  </div>

                  <div className="px-5 py-5 sm:px-6 sm:py-6">
                    <p className="font-serif text-lg font-semibold leading-snug text-ink-900">
                      Philippians 2:6&ndash;7 in terms of human rights supports
                    </p>

                    <ul className="mt-5 space-y-2.5">
                      <li className="rounded-lg border border-paper-300 px-4 py-3 text-sm leading-relaxed text-ink-600">
                        <span className="font-medium text-ink-500">A.</span> Human dignity
                      </li>
                      <li className="rounded-lg border-2 border-danger-500 bg-danger-50 px-4 py-3">
                        <p className="text-sm leading-relaxed text-ink-800">
                          <span className="font-medium text-ink-600">B.</span> Human equality
                        </p>
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-danger-600">
                          <Icon name="close" size={13} />
                          Your answer &mdash; not correct
                        </p>
                      </li>
                      <li className="rounded-lg border-2 border-success-500 bg-success-50 px-4 py-3">
                        <p className="text-sm leading-relaxed text-ink-800">
                          <span className="font-medium text-ink-600">C.</span> Human responsibility
                        </p>
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-success-700">
                          <Icon name="check" size={13} />
                          Correct answer
                        </p>
                      </li>
                      <li className="rounded-lg border border-paper-300 px-4 py-3 text-sm leading-relaxed text-ink-600">
                        <span className="font-medium text-ink-500">D.</span> Human sexuality
                      </li>
                    </ul>

                    <div className="mt-6 border-t border-paper-200 pt-5">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">
                        Why this is the answer
                      </h3>
                      <p className="mt-2.5 text-sm leading-relaxed text-ink-700">
                        The syllabus cites Philippians 2:6&ndash;7 under human responsibility, as the supreme model of
                        the renunciation of rights.
                      </p>
                    </div>

                    <dl className="mt-5 space-y-4 rounded-lg bg-paper-100 p-4">
                      <div className="flex gap-3">
                        <dt className="shrink-0 text-brand-700">
                          <span className="sr-only">Syllabus reference</span>
                          <Icon name="book" size={17} />
                        </dt>
                        <dd className="min-w-0 text-sm leading-relaxed text-ink-700">
                          <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">
                            Syllabus reference
                          </span>
                          Human rights &middot; The Biblical Basis of Human Rights
                          <span className="mt-2 block border-l-2 border-brand-300 pl-3 font-serif italic leading-relaxed text-ink-600">
                            &ldquo;Jesus Christ is the supreme model of this renunciation of rights as we are told in
                            Philippians 2:6-7.&rdquo;
                          </span>
                        </dd>
                      </div>
                      <div className="flex gap-3 border-t border-paper-300 pt-4">
                        <dt className="shrink-0 text-brand-700">
                          <span className="sr-only">Scripture</span>
                          <Icon name="scroll" size={17} />
                        </dt>
                        <dd className="min-w-0 text-sm text-ink-700">
                          <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">
                            Scripture
                          </span>
                          <span className="mt-1 block font-serif italic leading-relaxed">
                            &ldquo;Who, being in the form of God, thought it not robbery to be equal with God: but made
                            himself of no reputation, and took upon him the form of a servant, and was made in the
                            likeness of men.&rdquo;
                          </span>
                          <span className="mt-1.5 block text-xs not-italic text-ink-500">
                            Philippians 2:6&ndash;7 &middot; Authorised Version
                          </span>
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
                <figcaption className="mt-3 text-sm leading-relaxed text-ink-500">
                  A real question from the bank, taken from the September 2025 Church and Society paper, with the
                  feedback shown after an answer is submitted.
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------- past papers --- */}
        <section id="past-papers" className="scroll-mt-20 bg-paper-100" aria-labelledby="past-papers-heading">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-start lg:gap-16">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gold-700">Where the questions come from</p>
                <h2 id="past-papers-heading" className="mt-3 font-serif text-2xl font-semibold text-ink-900 sm:text-3xl">
                  Fifteen years of past papers, transcribed
                </h2>
                <p className="mt-5 text-base leading-relaxed text-ink-600">
                  Of the 1,392 questions on the platform, 775 are transcribed from official past papers of the
                  Connexional Lay Preachers&rsquo; Examination. Every paper from 2011 to 2025 is included, up to and
                  including the sitting of September 2025.
                </p>
                <p className="mt-4 text-base leading-relaxed text-ink-600">
                  Each question is labelled by where it came from. A question taken from an official past paper is
                  marked as such; a question written from the syllabus for practice is marked differently. The two are
                  never presented as though they were the same thing.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-2">
                  <Badge tone="gold">Official past paper</Badge>
                  <Badge tone="brand">From the syllabus</Badge>
                  <span className="text-sm text-ink-500">— as the labels appear on a question.</span>
                </div>
              </div>

              <div className="rounded-xl border border-paper-300 bg-white p-6 shadow-card sm:p-8">
                <h3 className="font-serif text-lg font-semibold text-ink-900">Papers held, by year</h3>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {PAST_PAPER_YEARS.map((year) => (
                    <li
                      key={year}
                      className={cx(
                        'tabular rounded-md border px-3 py-1.5 text-sm font-medium',
                        year === '2025'
                          ? 'border-gold-500 bg-gold-50 text-gold-800'
                          : 'border-paper-300 bg-paper-50 text-ink-700',
                      )}
                    >
                      {year}
                      {year === '2025' && <span className="sr-only"> — the most recent sitting held</span>}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-sm leading-relaxed text-ink-500">
                  The 2025 papers include the September sitting, the most recent held.
                </p>

                <dl className="mt-8 space-y-5 border-t border-paper-200 pt-6">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">Section A</dt>
                    <dd className="mt-1.5 text-sm leading-relaxed text-ink-700">
                      Objective questions, compulsory, answered by every candidate.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">Section B</dt>
                    <dd className="mt-1.5 text-sm leading-relaxed text-ink-700">
                      Five theory questions, of which you answer three.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">Time allowed</dt>
                    <dd className="tabular mt-1.5 text-sm leading-relaxed text-ink-700">
                      Two hours, kept by the clock, as in the hall.
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- practice --- */}
        <section className="border-y border-paper-300 bg-paper-50" aria-labelledby="practice-heading">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.2em] text-gold-700">The work itself</p>
              <h2 id="practice-heading" className="mt-3 font-serif text-2xl font-semibold text-ink-900 sm:text-3xl">
                How the preparation is done
              </h2>
              <p className="mt-4 text-base leading-relaxed text-ink-600">
                A few things, done properly, rather than a great many done loosely.
              </p>
            </div>

            <ul className="mt-10 grid gap-px overflow-hidden rounded-xl border border-paper-300 bg-paper-300 sm:grid-cols-2 lg:grid-cols-3">
              {PRACTICE.map((item) => (
                <li key={item.title} className="bg-paper-50 p-6 sm:p-7">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <Icon name={item.icon} size={20} />
                  </span>
                  <h3 className="mt-4 font-serif text-lg font-semibold leading-snug text-ink-900">{item.title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-ink-600">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------------ provenance --- */}
        <section className="bg-paper-100" aria-labelledby="provenance-heading">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="max-w-reading">
              <h2 id="provenance-heading" className="font-serif text-xl font-semibold text-ink-900 sm:text-2xl">
                Where the material comes from
              </h2>
              <p className="mt-4 text-base leading-relaxed text-ink-600">
                The study material here is reproduced from the official Methodist Church Ghana Lay Preachers&rsquo;
                syllabus for the personal use of candidates preparing for the examination. It is a study aid and nothing
                more. It is not an official publication of the Church, it does not replace the printed syllabus, and it
                confers no standing in the examination. Always check the printed syllabus before you sit.
              </p>
              <p className="mt-4 text-base leading-relaxed text-ink-600">
                Your notes, bookmarks and answers belong to your account and are not shown to anyone else.
              </p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- CTA --- */}
        <section className="relative overflow-hidden bg-brand-900" aria-labelledby="cta-heading">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: CROSS_LATTICE, backgroundSize: '96px' }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(100% 70% at 50% 0%, rgba(61,93,148,0.32) 0%, rgba(22,34,58,0) 70%)',
            }}
            aria-hidden="true"
          />

          <div className="relative mx-auto w-full max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-24">
            <blockquote className="mx-auto max-w-2xl">
              <p className="font-serif text-lg italic leading-relaxed text-brand-100 sm:text-xl">
                &ldquo;Study to shew thyself approved unto God, a workman that needeth not to be ashamed, rightly
                dividing the word of truth.&rdquo;
              </p>
              <footer className="mt-3 text-sm not-italic text-brand-300">
                <cite className="not-italic">2 Timothy 2:15</cite>
              </footer>
            </blockquote>

            <span className="mx-auto mt-10 block h-px w-16 bg-gold-500" aria-hidden="true" />

            <h2 id="cta-heading" className="mt-10 font-serif text-2xl font-semibold text-white sm:text-3xl">
              Begin where you are
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-brand-100">
              Create an account, choose the paper you want to start with, and tell us when you sit. The pacing and the
              revision follow from there.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button to="/register" size="lg" variant="gold">
                Create account
              </Button>
              <Button to="/login" size="lg" variant="secondary">
                Sign in
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* ------------------------------------------------------------ footer --- */}
      <footer className="bg-brand-950">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 text-paper-50">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                <CrossFlame size={18} />
              </span>
              <span className="leading-tight">
                <span className="block font-serif text-sm font-semibold">Lay Preachers&rsquo; Examination</span>
                <span className="block text-xs uppercase tracking-[0.14em] text-brand-300">Preparation, Part 2</span>
              </span>
            </div>
            <nav aria-label="Footer" className="flex items-center gap-5 text-sm text-brand-200">
              <Link to="/login" className="rounded hover:text-white">
                Sign in
              </Link>
              <Link to="/register" className="rounded hover:text-white">
                Create account
              </Link>
            </nav>
          </div>
          <p className="mt-8 border-t border-white/10 pt-6 text-sm leading-relaxed text-brand-300">
            An independent study aid for candidates of the Connexional Lay Preachers&rsquo; Examination of The Methodist
            Church Ghana. The syllabus content belongs to The Methodist Church Ghana and is reproduced here for
            candidates&rsquo; personal study. Scripture is quoted from the Authorised (King James) Version.
          </p>
        </div>
      </footer>
    </div>
  );
}
