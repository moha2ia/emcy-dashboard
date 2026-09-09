import { useState, useEffect } from 'react';
import { getRanking } from '../services/api';
import { Trophy, Activity, CheckCircle2 } from 'lucide-react';

export default function RankingPage() {
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRanking().then((r) => setRanking(r.data.ranking)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><Activity size={40} style={{ color: 'var(--accent)' }} /></div>;

  const top3 = ranking.slice(0, 3);
  const podiumOrder = top3.length === 3 ? [top3[1], top3[0], top3[2]] : top3;
  const heights = [140, 180, 110];
  const labels = ['2nd', '1st', '3rd'];
  const colors = ['#94a3b8', '#b8934a', '#a0694a'];
  const getInitials = (n) => n.split(' ').map((x) => x[0]).join('').slice(0, 2);

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <Trophy size={28} style={{ color: '#b8934a' }} />
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Ranking</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Members ranked by number of tasks completed</p>
      </div>

      {top3.length >= 3 && (
        <div className="glass-card" style={{ padding: '40px 20px 0', marginBottom: 32, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 16, maxWidth: 500, margin: '0 auto' }}>
            {podiumOrder.map((m, i) => (
              <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div className="avatar" style={{ width: i === 1 ? 64 : 48, height: i === 1 ? 64 : 48, fontSize: i === 1 ? '1.2rem' : '0.9rem', background: m.avatar ? `url(${m.avatar}) center/cover` : `hsl(${m.name.charCodeAt(0) * 7 % 360}, 60%, 50%)`, color: '#fff', marginBottom: 8, border: `3px solid ${colors[i]}`, boxShadow: i === 1 ? '0 0 25px rgba(254,202,87,0.4)' : 'none' }}>
                  {!m.avatar && getInitials(m.name)}
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', textAlign: 'center', marginBottom: 4 }}>{m.name.split(' ')[0]}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                  <CheckCircle2 size={11} style={{ color: 'var(--success)' }} />
                  {m.tasksDone} {m.tasksDone === 1 ? 'task' : 'tasks'}
                </div>
                <div style={{ width: '100%', height: heights[i], background: `linear-gradient(180deg, ${colors[i]}30, ${colors[i]}10)`, borderRadius: '12px 12px 0 0', border: `1px solid ${colors[i]}40`, borderBottom: 'none', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 16 }}>
                  <span style={{ fontWeight: 800, fontSize: i === 1 ? '1.4rem' : '1.1rem', color: colors[i] }}>{labels[i]}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
        <table className="data-table">
          <thead><tr><th style={{ width: 60 }}>Rank</th><th>Member</th><th>Project</th><th style={{ textAlign: 'center' }}>Tasks Done</th></tr></thead>
          <tbody>
            {ranking.map((m) => (
              <tr key={m.id}>
                <td>{m.rank <= 3 ? <div className={`rank-badge rank-${m.rank}`}>{m.rank}</div> : <span style={{ fontWeight: 600, color: 'var(--text-muted)', paddingLeft: 8 }}>{m.rank}</span>}</td>
                <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div className="avatar" style={{ background: m.avatar ? `url(${m.avatar}) center/cover` : `hsl(${m.name.charCodeAt(0) * 7 % 360}, 60%, 50%)`, color: '#fff' }}>{!m.avatar && getInitials(m.name)}</div><span style={{ fontWeight: 600 }}>{m.name}</span></div></td>
                <td style={{ color: 'var(--text-secondary)' }}>{m.project}</td>
                <td style={{ textAlign: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                    <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                    {m.tasksDone}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
