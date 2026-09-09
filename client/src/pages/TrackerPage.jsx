import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { resolveUrl } from '../utils/resolveUrl';
import { DeadlineBadge } from '../utils/deadline';
import { getTasks, deleteTask, reopenTask } from '../services/api';
import {
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  RotateCcw,
  ExternalLink,
  Briefcase,
  X,
  Activity,
  FileText,
  Paperclip,
} from 'lucide-react';

export default function TrackerPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [reopeningId, setReopeningId] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'done'
  const [selectedTask, setSelectedTask] = useState(null);

  const fetchTasks = () => {
    getTasks()
      .then((res) => setTasks(res.data.tasks))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleDelete = async (taskId) => {
    setDeletingId(taskId);
    try {
      await deleteTask(taskId);
      showToast('Task deleted.', 'success');
      fetchTasks();
    } catch {
      showToast('Failed to delete task.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleReopen = async (taskId) => {
    setReopeningId(taskId);
    try {
      await reopenTask(taskId);
      showToast('Task reopened.', 'success');
      fetchTasks();
    } catch {
      showToast('Failed to reopen task.', 'error');
    } finally {
      setReopeningId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <Activity size={40} style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  const filtered = tasks.filter(t => {
    if (filter === 'all') return true;
    return t.status === filter;
  });

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.status === 'done').length;
  const pendingTasks = tasks.filter(t => t.status === 'pending').length;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <ClipboardList size={28} style={{ color: 'var(--accent)' }} />
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Task Tracker</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {user.role === 'admin'
            ? 'Overview of all assigned tasks and their completion status.'
            : 'Track your assigned tasks and submissions.'}
        </p>
      </div>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Total Tasks', value: totalTasks, color: '#6366f1', icon: ClipboardList },
          { label: 'Completed', value: doneTasks, color: '#0d9488', icon: CheckCircle2 },
          { label: 'Pending', value: pendingTasks, color: '#e17055', icon: AlertCircle },
        ].map((s, i) => (
          <div key={i} className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12, flexShrink: 0,
              background: `${s.color}15`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <s.icon size={20} color={s.color} />
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>{s.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['all', 'pending', 'done'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 18px',
              borderRadius: 20,
              border: '1px solid',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
              textTransform: 'capitalize',
              transition: 'all 0.2s',
              background: filter === f ? 'var(--accent)' : 'transparent',
              borderColor: filter === f ? 'var(--accent)' : 'var(--border)',
              color: filter === f ? '#fff' : 'var(--text-secondary)',
            }}
          >
            {f === 'all' ? `All (${totalTasks})` : f === 'pending' ? `Pending (${pendingTasks})` : `Done (${doneTasks})`}
          </button>
        ))}
      </div>

      {/* Task list */}
      {filtered.length === 0 ? (
        <div className="glass-card" style={{ padding: 48, textAlign: 'center', border: '1px dashed var(--border)' }}>
          <ClipboardList size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No {filter !== 'all' ? filter : ''} tasks found.</p>
        </div>
      ) : (
        <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>Task</th>
                <th style={{ minWidth: 160 }}>Assigned To</th>
                <th style={{ textAlign: 'center', minWidth: 100 }}>Status</th>
                <th style={{ textAlign: 'center', minWidth: 150 }}>Deadline</th>
                <th style={{ minWidth: 100 }}>Created</th>
                <th style={{ minWidth: 100 }}>Completed</th>
                <th style={{ textAlign: 'center', minWidth: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((task, idx) => (
                <tr key={task.id} style={{ animationDelay: `${idx * 0.04}s` }}>
                  {/* Task title + description */}
                  <td>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{task.title}</div>
                      {task.description && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2, maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {task.description}
                        </div>
                      )}
                      {task.attachment && (
                        <a
                          href={resolveUrl(task.attachment)}
                          target="_blank" rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, color: 'var(--accent)', fontSize: '0.72rem', textDecoration: 'none' }}
                        >
                          <Paperclip size={12} /> Attachment
                        </a>
                      )}
                    </div>
                  </td>

                  {/* Assigned to */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        className="avatar"
                        style={{
                          width: 28, height: 28, fontSize: '0.6rem', flexShrink: 0,
                          background: task.assignedToAvatar
                            ? `url(${resolveUrl(task.assignedToAvatar)}) center/cover`
                            : task.assignedTo === 'all'
                              ? 'linear-gradient(135deg, #3d6db5, #6366f1)'
                              : `hsl(${task.assignedToName.charCodeAt(0) * 13 % 360}, 50%, 50%)`,
                          color: '#fff',
                        }}
                      >
                        {task.assignedTo === 'all' ? 'A' : (!task.assignedToAvatar && task.assignedToName[0])}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{task.assignedToName}</div>
                        {task.assignedToProject && (
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{task.assignedToProject}</div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Status badge */}
                  <td style={{ textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '4px 12px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                      background: task.status === 'done' ? 'var(--success-glow)' : 'rgba(231,97,97,0.12)',
                      color: task.status === 'done' ? 'var(--success)' : '#e97272',
                      border: `1px solid ${task.status === 'done' ? 'rgba(0,200,150,0.3)' : 'rgba(231,97,97,0.3)'}`,
                    }}>
                      {task.status === 'done' ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                      {task.status === 'done' ? 'Done' : 'Pending'}
                    </span>
                  </td>

                  {/* Deadline */}
                  <td style={{ textAlign: 'center' }}>
                    {task.deadline ? (
                      <DeadlineBadge task={task} size="sm" />
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>
                    )}
                  </td>

                  {/* Created date */}
                  <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {new Date(task.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>

                  {/* Completed date */}
                  <td style={{ fontSize: '0.78rem', color: task.doneAt ? 'var(--success)' : 'var(--text-muted)' }}>
                    {task.doneAt
                      ? new Date(task.doneAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—'}
                  </td>

                  {/* Actions */}
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                      {(task.note || task.workLink) && (
                        <button
                          className="btn-secondary"
                          style={{ padding: '5px 10px', fontSize: '0.72rem', gap: 5 }}
                          onClick={() => setSelectedTask(task)}
                          title="View submission"
                        >
                          <FileText size={13} /> View
                        </button>
                      )}
                      {user.role === 'admin' && task.status === 'done' && (
                        <button
                          className="btn-secondary"
                          style={{ padding: '5px 10px', fontSize: '0.72rem', gap: 5 }}
                          onClick={() => handleReopen(task.id)}
                          disabled={reopeningId === task.id}
                          title="Reopen task"
                        >
                          {reopeningId === task.id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                        </button>
                      )}
                      {user.role === 'admin' && (
                        <button
                          className="btn-secondary"
                          style={{ padding: '5px 10px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                          onClick={() => handleDelete(task.id)}
                          disabled={deletingId === task.id}
                          title="Delete task"
                        >
                          {deletingId === task.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Submission Details Modal */}
      {selectedTask && (
        <div className="modal-overlay" onClick={() => setSelectedTask(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Task Submission</h2>
              <button onClick={() => setSelectedTask(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Member info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, background: 'var(--bg-secondary)', borderRadius: 12, marginBottom: 20 }}>
              <div
                className="avatar"
                style={{
                  width: 44, height: 44,
                  background: selectedTask.assignedToAvatar
                    ? `url(${resolveUrl(selectedTask.assignedToAvatar)}) center/cover`
                    : `hsl(${selectedTask.assignedToName.charCodeAt(0) * 13 % 360}, 50%, 50%)`,
                  color: '#fff',
                }}
              >
                {!selectedTask.assignedToAvatar && selectedTask.assignedToName[0]}
              </div>
              <div>
                <div style={{ fontWeight: 700 }}>{selectedTask.assignedToName}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Briefcase size={12} /> {selectedTask.assignedToProject || 'General'}
                </div>
              </div>
            </div>

            {/* Task title */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Task</div>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>{selectedTask.title}</div>
              {selectedTask.description && (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>{selectedTask.description}</p>
              )}
              {selectedTask.deadline && (
                <div style={{ marginTop: 8 }}>
                  <DeadlineBadge task={selectedTask} size="sm" />
                </div>
              )}
            </div>

            {/* Submission details */}
            {selectedTask.doneAt && (
              <div style={{ fontSize: '0.72rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 16 }}>
                <CheckCircle2 size={13} />
                Submitted on {new Date(selectedTask.doneAt).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            )}

            {selectedTask.note && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Note</div>
                <div className="glass-card" style={{ padding: 14, fontSize: '0.88rem', lineHeight: 1.6, background: 'var(--surface-muted)' }}>
                  {selectedTask.note}
                </div>
              </div>
            )}

            {selectedTask.workLink && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Attachment</div>
                <a
                  href={resolveUrl(selectedTask.workLink)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', gap: 10 }}
                >
                  <ExternalLink size={16} /> View Submitted Work
                </a>
              </div>
            )}

            <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setSelectedTask(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
