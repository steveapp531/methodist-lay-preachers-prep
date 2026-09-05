import { Outlet } from 'react-router-dom';

/**
 * The sitting shell.
 *
 * Deliberately bare: no navigation, no search, no notifications. An examination
 * should feel like an examination, and there should be no accidental route out
 * of a timed paper.
 */
export default function ExamLayout() {
  return (
    <div className="min-h-screen bg-paper-200">
      <main id="main-content" className="min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
