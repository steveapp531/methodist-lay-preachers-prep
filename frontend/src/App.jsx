import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { LoadingScreen, ToastViewport } from '@/components/ui';
import AppLayout from '@/layouts/AppLayout';
import AuthLayout from '@/layouts/AuthLayout';
import ExamLayout from '@/layouts/ExamLayout';
import ErrorBoundary from '@/components/ErrorBoundary';

const LandingPage = lazy(() => import('@/pages/LandingPage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'));

const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const StudyPage = lazy(() => import('@/pages/StudyPage'));
const SubjectPage = lazy(() => import('@/pages/SubjectPage'));
const TopicPage = lazy(() => import('@/pages/TopicPage'));

const QuizSetupPage = lazy(() => import('@/pages/QuizSetupPage'));
const QuizPage = lazy(() => import('@/pages/QuizPage'));
const QuizResultsPage = lazy(() => import('@/pages/QuizResultsPage'));

const MockExamListPage = lazy(() => import('@/pages/MockExamListPage'));
const MockExamPage = lazy(() => import('@/pages/MockExamPage'));
const MockExamResultsPage = lazy(() => import('@/pages/MockExamResultsPage'));

const FlashcardsPage = lazy(() => import('@/pages/FlashcardsPage'));
const MistakesPage = lazy(() => import('@/pages/MistakesPage'));
const BookmarksPage = lazy(() => import('@/pages/BookmarksPage'));
const ScripturePage = lazy(() => import('@/pages/ScripturePage'));
const ScriptureDetailPage = lazy(() => import('@/pages/ScriptureDetailPage'));
const NotesPage = lazy(() => import('@/pages/NotesPage'));
const ProgressPage = lazy(() => import('@/pages/ProgressPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const SearchPage = lazy(() => import('@/pages/SearchPage'));
const QuestionDetailPage = lazy(() => import('@/pages/QuestionDetailPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'));
const AdminQuestionsPage = lazy(() => import('@/pages/admin/AdminQuestionsPage'));
const AdminQuestionEditorPage = lazy(() => import('@/pages/admin/AdminQuestionEditorPage'));
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage'));
const AdminMockExamsPage = lazy(() => import('@/pages/admin/AdminMockExamsPage'));
const AdminImportPage = lazy(() => import('@/pages/admin/AdminImportPage'));
const AdminContentPage = lazy(() => import('@/pages/admin/AdminContentPage'));

/** Sends signed-out visitors to the sign-in page, remembering where they were. */
function RequireAuth({ children, adminOnly = false }) {
  const { isAuthenticated, isLoading, isAdmin, hasChosenExam } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen message="Checking your session…" />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />;
  // Everything in the study area is scoped to an examination stage.
  if (!adminOnly && !hasChosenExam && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }
  return children;
}

function RedirectIfSignedIn({ children }) {
  const { isAuthenticated, isLoading, hasChosenExam } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (isAuthenticated) return <Navigate to={hasChosenExam ? '/dashboard' : '/onboarding'} replace />;
  return children;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [pathname]);
  return null;
}

export default function App() {
  const { toasts, dismiss } = useToast();

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <ScrollToTop />
      <ErrorBoundary>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            {/* Public */}
            <Route
              path="/"
              element={
                <RedirectIfSignedIn>
                  <LandingPage />
                </RedirectIfSignedIn>
              }
            />
            <Route element={<AuthLayout />}>
              <Route
                path="/login"
                element={
                  <RedirectIfSignedIn>
                    <LoginPage />
                  </RedirectIfSignedIn>
                }
              />
              <Route
                path="/register"
                element={
                  <RedirectIfSignedIn>
                    <RegisterPage />
                  </RedirectIfSignedIn>
                }
              />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
            </Route>

            {/* Choosing an examination stage happens outside the main shell. */}
            <Route
              path="/onboarding"
              element={
                <RequireAuth>
                  <OnboardingPage />
                </RequireAuth>
              }
            />

            {/* A sitting takes over the screen: no navigation, no distractions. */}
            <Route
              element={
                <RequireAuth>
                  <ExamLayout />
                </RequireAuth>
              }
            >
              <Route path="/mock-exam/sitting/:attemptId" element={<MockExamPage />} />
            </Route>

            {/* The study application */}
            <Route
              element={
                <RequireAuth>
                  <AppLayout />
                </RequireAuth>
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />

              <Route path="/study" element={<StudyPage />} />
              <Route path="/study/subject/:subjectId" element={<SubjectPage />} />
              <Route path="/study/topic/:topicId" element={<TopicPage />} />

              <Route path="/quiz" element={<QuizSetupPage />} />
              <Route path="/quiz/:quizId" element={<QuizPage />} />
              <Route path="/quiz/:quizId/results" element={<QuizResultsPage />} />

              <Route path="/mock-exam" element={<MockExamListPage />} />
              <Route path="/mock-exam/results/:attemptId" element={<MockExamResultsPage />} />

              <Route path="/flashcards" element={<FlashcardsPage />} />
              <Route path="/mistakes" element={<MistakesPage />} />
              <Route path="/bookmarks" element={<BookmarksPage />} />
              <Route path="/scripture" element={<ScripturePage />} />
              <Route path="/scripture/:reference" element={<ScriptureDetailPage />} />
              <Route path="/notes" element={<NotesPage />} />
              <Route path="/progress" element={<ProgressPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/questions/:questionId" element={<QuestionDetailPage />} />
            </Route>

            {/* Administration */}
            <Route
              element={
                <RequireAuth adminOnly>
                  <AppLayout admin />
                </RequireAuth>
              }
            >
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/questions" element={<AdminQuestionsPage />} />
              <Route path="/admin/questions/new" element={<AdminQuestionEditorPage />} />
              <Route path="/admin/questions/:questionId" element={<AdminQuestionEditorPage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/mock-exams" element={<AdminMockExamsPage />} />
              <Route path="/admin/import" element={<AdminImportPage />} />
              <Route path="/admin/content" element={<AdminContentPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
