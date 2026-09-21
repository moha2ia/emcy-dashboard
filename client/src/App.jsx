import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout/Layout';

// Lazy-loaded page components for code splitting
const LoginPage = lazy(() => import('./pages/LoginPage'));
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const TrackerPage = lazy(() => import('./pages/TrackerPage'));
const MembersPage = lazy(() => import('./pages/MembersPage'));
const RankingPage = lazy(() => import('./pages/RankingPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const TaskPage = lazy(() => import('./pages/TaskPage'));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage'));

function PageLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  return user ? children : <Navigate to="/login" />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" /> : children;
}

/** Redirect members away from admin-only pages */
function AdminRoute({ children }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/task" replace />;
  return children;
}

/** Redirect members from the root "/" to "/task" */
function HomeRedirect() {
  const { user } = useAuth();
  if (user?.role === 'member') return <Navigate to="/task" replace />;
  return <DashboardPage />;
}

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
              <Route path="/admin/login" element={<PublicRoute><AdminLoginPage /></PublicRoute>} />
              <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                {/* Root: admin -> Dashboard, member -> Task page */}
                <Route path="/" element={<HomeRedirect />} />

                {/* Admin-only routes */}
                <Route path="/tracker" element={<AdminRoute><TrackerPage /></AdminRoute>} />
                <Route path="/members" element={<AdminRoute><MembersPage /></AdminRoute>} />
                <Route path="/ranking" element={<AdminRoute><RankingPage /></AdminRoute>} />
                <Route path="/calendar" element={<AdminRoute><CalendarPage /></AdminRoute>} />

                {/* Member task submission page */}
                <Route path="/task" element={<TaskPage />} />

                {/* Shared resources area */}
                <Route path="/resources" element={<ResourcesPage />} />

                {/* Shared */}
                <Route path="/profile" element={<ProfilePage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
