import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUser } from '../services/api';
import { resolveUrl } from '../utils/resolveUrl';
import { User, Briefcase, Mail, Calendar, Activity, Crown } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      getUser(user.id).then((r) => setProfile(r.data.user)).catch(console.error).finally(() => setLoading(false));
    }
  }, [user]);

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><Activity size={40} style={{ color: 'var(--accent)' }} /></div>;
  if (!profile) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Profile not found.</div>;

  const chartData = (profile.progress || []).map((p) => ({ week: `W${p.weekNumber}`, value: p.status === 'done' ? 100 : 0 }));

  // The EMCY Management admin is the Owner of the dashboard
  const isOwner = profile.role === 'admin' && (profile.project || '').trim().toLowerCase() === 'emcy management';

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <User size={28} style={{ color: 'var(--accent)' }} />
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Profile</h1>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
        {/* Left card */}
        <div className="glass-card" style={{ padding: 32, textAlign: 'center' }}>
          <div className="avatar" style={{ width: 80, height: 80, fontSize: '2rem', background: profile.avatar ? `url(${resolveUrl(profile.avatar)}) center/cover` : `hsl(0, 0%, 30%)`, color: '#fff', margin: '0 auto 16px', border: '3px solid var(--accent)' }}>
            {!profile.avatar && profile.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </div>
          <h2 style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: 4 }}>{profile.name}</h2>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 14px', borderRadius: 20, background: 'rgba(108,92,231,0.15)', color: 'var(--accent-light)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize', marginBottom: 20 }}>
            {isOwner && <Crown size={12} />}
            {isOwner ? 'Owner' : profile.role}
          </div>

          <div style={{ textAlign: 'left' }}>
            {[
              { icon: Mail, label: 'Email', value: profile.email },
              { icon: Briefcase, label: 'Major', value: profile.project },
              { icon: Calendar, label: 'Joined', value: new Date(profile.joinDate || profile.createdAt).toLocaleDateString() },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none', fontSize: '0.85rem' }}>
                <item.icon size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{item.label}</span>
                <span style={{ fontWeight: 500 }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Chart */}
          <div className="glass-card" style={{ padding: 24, flex: 1 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Weekly History</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="profileGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3d6db5" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3d6db5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="week" stroke="var(--text-muted)" fontSize={12} />
                <YAxis stroke="var(--text-muted)" fontSize={11} domain={[0, 100]} tickFormatter={(v) => v === 100 ? 'Done' : 'Missed'} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }} formatter={(v) => [v === 100 ? 'Done' : 'Not Done', 'Status']} />
                <Area type="stepAfter" dataKey="value" stroke="#3d6db5" strokeWidth={2} fill="url(#profileGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
