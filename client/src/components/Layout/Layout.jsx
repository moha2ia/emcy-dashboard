import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useState } from 'react';
import { Menu, Crown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import EmcyLogo from '../EmcyLogo';

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuth();
  const location = useLocation();

  const closeMobile = () => setMobileOpen(false);

  const pageTitle = location.pathname === '/' ? 'Dashboard' : location.pathname.replace(/^\//, '');

  // The EMCY Management admin is the Owner of the dashboard
  const isOwner = user?.role === 'admin' && (user?.project || '').trim().toLowerCase() === 'emcy management';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Mobile Header */}
      <header className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setMobileOpen(true)} className="btn-icon" style={{ border: 'none', background: 'none' }} aria-label="Open menu">
            <Menu size={24} />
          </button>
          <EmcyLogo variant="compact" />
        </div>
        <div className="avatar" style={{ background: 'var(--accent)', color: '#fff' }}>
          {user?.name?.[0]}
        </div>
      </header>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          onClick={closeMobile}
          className="modal-overlay"
          style={{ zIndex: 35 }}
        />
      )}

      {/* Sidebar Container */}
      <div className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <Sidebar collapsed={collapsed} onToggleCollapse={setCollapsed} />
      </div>

      {/* Main content area */}
      <main className="main-content">
        {/* Desktop Header (hidden on mobile via CSS) */}
        <header className="desktop-header" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ color: 'var(--text-muted)' }}>Pages /</div>
            <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{pageTitle}</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user?.name}</div>
                <div style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', textTransform: 'capitalize', color: isOwner ? '#b8934a' : 'var(--text-muted)', fontWeight: isOwner ? 700 : 400 }}>
                  {isOwner && <Crown size={10} />}
                  {isOwner ? 'Owner' : user?.role}
                </div>
              </div>
              <div className="avatar" style={{ background: 'var(--accent)', color: '#fff' }}>
                {user?.name?.[0]}
              </div>
            </div>
          </div>
        </header>

        <Outlet />
      </main>
    </div>
  );
}
