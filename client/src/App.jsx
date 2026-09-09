import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TrackerPage from './pages/TrackerPage';
import MembersPage from './pages/MembersPage';
import RankingPage from './pages/RankingPage';
import ProfilePage from './pages/ProfilePage';
import CalendarPage from './pages/CalendarPage';
import TaskPage from './pages/TaskPage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>Loading...</div>;
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
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              {/* Root: admin → Dashboard, member → Task page */}
              <Route path="/" element={<HomeRedirect />} />

              {/* Admin-only routes */}
              <Route path="/tracker" element={<AdminRoute><TrackerPage /></AdminRoute>} />
              <Route path="/members" element={<AdminRoute><MembersPage /></AdminRoute>} />
              <Route path="/ranking" element={<AdminRoute><RankingPage /></AdminRoute>} />
              <Route path="/calendar" element={<AdminRoute><CalendarPage /></AdminRoute>} />

              {/* Member task submission page */}
              <Route path="/task" element={<TaskPage />} />

              {/* Shared */}
              <Route path="/profile" element={<ProfilePage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
