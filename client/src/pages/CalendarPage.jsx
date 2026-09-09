import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getLogs, createLog, getUsers, uploadWorkFile } from '../services/api';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Users, 
  MessageSquare,
  Plus,
  X,
  Loader2,
  Activity,
  ArrowUpRight,
  Paperclip,
  FileText
} from 'lucide-react';

export default function CalendarPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [logs, setLogs] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(user?.id);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [form, setForm] = useState({ status: 'done', note: '', workLink: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const collapsed = windowWidth < 768;

  useEffect(() => {
    if (!user?.role) return;
    if (user.role === 'admin') {
      getUsers().then(res => {
        const memberList = res.data.users.filter(u => u.role === 'member');
        setMembers(memberList);
      }).catch(console.error);
    }
  }, [user?.role, user?.id]);

  const fetchLogs = () => {
    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();
    
    getLogs({ userId: selectedMember, month, year })
      .then(res => setLogs(res.data.logs))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, selectedMember]);

  const daysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const formatDate = (date) => {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
  };

  const openLogModal = (day) => {
    const dateStr = formatDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
    const existing = logs.find(l => l.date === dateStr);
    
    setSelectedDate(dateStr);
    setForm({
      status: existing ? existing.status : 'done',
      note: existing ? existing.note : '',
      workLink: existing ? existing.workLink || '' : ''
    });
    setShowModal(true);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('workFile', file);

    try {
      const res = await uploadWorkFile(formData);
      setForm({ ...form, workLink: res.data.path });
      showToast('File uploaded successfully.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to upload file.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveLog = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createLog({
        date: selectedDate,
        status: form.status,
        note: form.note,
        workLink: form.workLink,
        userId: selectedMember
      });
      showToast('Log saved successfully.', 'success');
      setShowModal(false);
      fetchLogs();
    } catch (err) {
      console.error(err);
      showToast('Failed to save log.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const year = currentDate.getFullYear();

  // Calendar rendering logic
  const days = [];
  const totalDays = daysInMonth(currentDate.getMonth(), year);
  const startOffset = firstDayOfMonth(currentDate.getMonth(), year);

  // Fill offsets
  for (let i = 0; i < startOffset; i++) {
    days.push(<div key={`offset-${i}`} className="calendar-day-offset" />);
  }

  // Fill days
  for (let day = 1; day <= totalDays; day++) {
    const dateStr = formatDate(new Date(year, currentDate.getMonth(), day));
    const log = logs.find(l => l.date === dateStr);
    const isToday = formatDate(new Date()) === dateStr;

    days.push(
      <div 
        key={day} 
        className={`calendar-day ${isToday ? 'is-today' : ''}`}
        onClick={() => openLogModal(day)}
      >
        <div className="day-number">{day}</div>
        {log && (
          <div className={`log-indicator ${log.status}`}>
            {log.status === 'done' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
            {!collapsed && <span className="log-status-text">{log.status === 'done' ? 'Done' : 'Not Done'}</span>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <CalendarIcon size={28} style={{ color: 'var(--accent)' }} />
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Work Follow-up</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Detailed history and daily tracking</p>
        </div>

        {user?.role === 'admin' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-card)', padding: '6px 12px', borderRadius: 12, border: '1px solid var(--border)' }}>
            <Users size={16} style={{ color: 'var(--text-muted)' }} />
            <select 
              value={selectedMember} 
              onChange={(e) => setSelectedMember(e.target.value)}
              style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
            >
              <option value={user?.id}>Me ({user?.name})</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="glass-card" style={{ padding: 24 }}>
        {/* Calendar Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, textTransform: 'capitalize' }}>
            {monthName} {year}
          </h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-icon" onClick={handlePrevMonth}><ChevronLeft size={20} /></button>
            <button className="btn-icon" onClick={() => setCurrentDate(new Date())}><Clock size={18} /></button>
            <button className="btn-icon" onClick={handleNextMonth}><ChevronRight size={20} /></button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="calendar-grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="calendar-weekday">{day}</div>
          ))}
          {loading ? (
             <div style={{ gridColumn: 'span 7', height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Activity size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
             </div>
          ) : days}
        </div>
      </div>

      <div style={{ marginTop: 24, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div className="glass-card" style={{ padding: 16, flex: 1, minWidth: 200 }}>
             <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase' }}>Month Summary</h3>
             <div style={{ display: 'flex', gap: 32 }}>
                <div>
                   <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>
                      {logs.filter(l => l.status === 'done').length}
                   </div>
                   <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Days Completed</div>
                </div>
                <div>
                   <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--danger)' }}>
                      {logs.filter(l => l.status === 'not_done').length}
                   </div>
                   <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Days Missed</div>
                </div>
             </div>
          </div>
          
          <div className="glass-card" style={{ padding: 16, flex: 2, minWidth: 300 }}>
             <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase' }}>Recent Notes</h3>
             <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {logs.filter(l => l.note).slice(-3).reverse().map(l => (
                    <div key={l.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                       <div style={{ display: 'flex', gap: 10, fontSize: '0.8rem' }}>
                          <div style={{ color: 'var(--accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>{new Date(l.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</div>
                          <div style={{ color: 'var(--text-secondary)', flex: 1 }}>{l.note}</div>
                       </div>
                       {l.workLink && (
                          <a 
                            href={l.workLink.startsWith('http') ? l.workLink : `https://${l.workLink}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ fontSize: '0.75rem', color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                             <ArrowUpRight size={12} /> {l.workLink.includes('/uploads/work/') ? 'View Uploaded File' : 'View Work Attachment'}
                          </a>
                       )}
                    </div>
                ))}
                {logs.filter(l => l.note).length === 0 && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No notes for this month.</div>}
             </div>
          </div>
      </div>

      {/* Log Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                {new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </h2>
              <button onClick={() => setShowModal(false)} className="btn-icon"><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveLog}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Work Status</label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button 
                    type="button"
                    className={`btn-secondary ${form.status === 'done' ? 'active-success' : ''}`}
                    style={{ flex: 1, justifyContent: 'center', gap: 8 }}
                    onClick={() => setForm({ ...form, status: 'done' })}
                  >
                    <CheckCircle2 size={18} /> Done
                  </button>
                  <button 
                    type="button"
                    className={`btn-secondary ${form.status === 'not_done' ? 'active-danger' : ''}`}
                    style={{ flex: 1, justifyContent: 'center', gap: 8 }}
                    onClick={() => setForm({ ...form, status: 'not_done' })}
                  >
                    <XCircle size={18} /> Not Done
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MessageSquare size={14} /> Notes / Progress
                  </div>
                </label>
                <textarea
                  className="form-input"
                  style={{ minHeight: 80, paddingTop: 12, resize: 'none' }}
                  placeholder="What was accomplished today? Any blockers?"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>
                  Submit Work (File or Link)
                </label>
                <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                   <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        className="form-input"
                        placeholder="Paste link here (https://...)"
                        style={{ flex: 1 }}
                        value={form.workLink}
                        onChange={(e) => setForm({ ...form, workLink: e.target.value })}
                      />
                      <button 
                        type="button" 
                        className="btn-secondary"
                        style={{ padding: '8px 12px' }}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                      >
                         {uploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        style={{ display: 'none' }} 
                        onChange={handleFileChange}
                      />
                   </div>
                   {form.workLink && form.workLink.includes('/uploads/work/') && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--success)' }}>
                         <FileText size={14} /> File uploaded: {form.workLink.split('/').pop()}
                         <button 
                           type="button" 
                           onClick={() => setForm({ ...form, workLink: '' })}
                           style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.7rem' }}
                         >
                            Remove
                         </button>
                      </div>
                   )}
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={saving || uploading}>
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                {saving ? 'Saving...' : 'Save Log'}
              </button>
            </form>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 1px;
          background: var(--border);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
        }
        .calendar-weekday {
          background: var(--bg-secondary);
          padding: 12px;
          text-align: center;
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .calendar-day {
          background: var(--bg-card);
          aspect-ratio: 1 / 1;
          padding: 12px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
        }
        .calendar-day:hover {
          background: var(--accent-soft);
          transform: scale(0.98);
          z-index: 1;
          box-shadow: inset 0 0 0 1px var(--accent);
        }
        .calendar-day-offset {
          background: var(--bg-secondary);
          opacity: 0.3;
        }
        .day-number {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text-secondary);
        }
        .is-today .day-number {
          color: var(--accent);
          position: relative;
        }
        .is-today .day-number::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          width: 4px;
          height: 4px;
          background: var(--accent);
          border-radius: 50%;
        }
        .log-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 0.7rem;
          font-weight: 600;
        }
        .log-indicator.done {
          background: var(--success-glow);
          color: var(--success);
        }
        .log-indicator.not_done {
          background: var(--danger-glow);
          color: var(--danger);
        }
        .log-status-text {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .active-success {
          background: var(--success-glow) !important;
          border-color: var(--success) !important;
          color: var(--success) !important;
        }
        .active-danger {
          background: var(--danger-glow) !important;
          border-color: var(--danger) !important;
          color: var(--danger) !important;
        }
        .btn-icon {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-icon:hover {
          background: var(--bg-card);
          color: var(--accent);
          border-color: var(--accent);
        }
        @media (max-width: 768px) {
          .calendar-day {
            padding: 4px;
            aspect-ratio: 1 / 1.2;
          }
          .day-number { font-size: 0.7rem; }
          .log-status-text { display: none; }
          .log-indicator { padding: 4px; justify-content: center; }
        }
      `}} />
    </div>
  );
}
