import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Trophy,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Crown,
} from 'lucide-react';
import EmcyLogo from '../EmcyLogo';
import { resolveUrl } from '../../utils/resolveUrl';

// Admin sees everything; members only see My Task + Profile
const adminNavItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/tracker', icon: CalendarCheck, label: 'Task Tracker' },
  { path: '/members', icon: Users, label: 'Members' },
  { path: '/ranking', icon: Trophy, label: 'Ranking' },
  { path: '/profile', icon: User, label: 'Profile' },
];

const memberNavItems = [
  { path: '/task', icon: ClipboardList, label: 'My Task' },
  { path: '/profile', icon: User, label: 'Profile' },
];


export default function Sidebar({ collapsed, onToggleCollapse }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const getInitials = (name) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const accentColors = ['#3d6db5', '#0d9488', '#6366f1', '#d97706', '#5b8fd4', '#0891b2'];
  const colorIndex = user?.name ? user.name.charCodeAt(0) % accentColors.length : 0;

  // The EMCY Management admin is the Owner of the dashboard
  const isOwner = user?.role === 'admin' && (user?.project || '').trim().toLowerCase() === 'emcy management';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <div style={{ padding: collapsed ? '20px 8px' : '24px 16px', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <EmcyLogo variant={collapsed ? 'icon' : 'full'} />
        </div>
      </div>

      {/* Nav Section */}
      <nav style={{ flex: 1, padding: '0 4px', overflowY: 'auto' }}>
        {!collapsed && (
          <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', padding: '12px 16px', marginBottom: 4 }}>
            {user?.role === 'admin' ? 'Overview' : 'Menu'}
          </div>
        )}
        {(user?.role === 'admin' ? adminNavItems : memberNavItems).map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
              title={collapsed ? item.label : undefined}
              style={collapsed ? { justifyContent: 'center', padding: '12px 0', margin: '4px 8px' } : {}}
            >
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                 <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                 {isActive && (
                    <div style={{ 
                      position: 'absolute', 
                      left: -20, 
                      width: 4, 
                      height: 20, 
                      background: 'var(--accent)', 
                      borderRadius: '0 4px 4px 0',
                      display: collapsed ? 'none' : 'block'
                    }} />
                 )}
              </div>
              {!collapsed && <span style={{ fontWeight: isActive ? 600 : 500 }}>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* User & Settings Footer */}
      <div style={{ padding: '20px 12px', borderTop: '1px solid var(--border)' }}>
        {!collapsed && (
           <button
             onClick={() => onToggleCollapse(true)}
             className="sidebar-link"
             style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', marginBottom: 12 }}
           >
             <ChevronLeft size={18} />
             <span>Collapse Menu</span>
           </button>
        )}
        
        {collapsed ? (
           <button 
             onClick={() => onToggleCollapse(false)}
             className="btn-icon"
             style={{ width: '100%', height: 44, marginBottom: 12 }}
           >
              <ChevronRight size={18} />
           </button>
        ) : null}

        <div className="sidebar-user-card" style={{ padding: collapsed ? '8px' : '12px' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                className="avatar"
                style={{ 
                  background: user?.avatar ? `url(${resolveUrl(user.avatar)}) center/cover` : accentColors[colorIndex], 
                  color: '#fff', 
                  width: 32, 
                  height: 32,
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                {user && !user.avatar && getInitials(user.name)}
              </div>
              {!collapsed && (
                <div style={{ overflow: 'hidden', flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
                  <div style={{ fontSize: '0.65rem', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: 4, color: isOwner ? '#b8934a' : 'var(--text-muted)', fontWeight: isOwner ? 700 : 400 }}>
                    {isOwner && <Crown size={10} />}
                    {isOwner ? 'Owner' : user?.role}
                  </div>
                </div>
              )}
           </div>
           
           {!collapsed && (
             <button onClick={logout} className="sidebar-logout-btn">
               <LogOut size={14} /> Log Out
             </button>
           )}
           
           {collapsed && (
              <button onClick={logout} className="btn-icon" style={{ width: '100%', height: 40, border: 'none', color: 'var(--danger)' }}>
                 <LogOut size={18} />
              </button>
           )}
        </div>
      </div>
    </div>
  );
}
