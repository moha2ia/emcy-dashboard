import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { resolveUrl } from '../utils/resolveUrl';
import { DeadlineBadge, DeadlineLine } from '../utils/deadline';
import { getTasks, completeTask, uploadTaskFile } from '../services/api';
import {
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Paperclip,
  FileText,
  ExternalLink,
  Clock,
  Send,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  X,
  Link as LinkIcon,
  Upload,
} from 'lucide-react';

export default function TaskPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Which task's file-picker is active (uploading state)
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedTask, setExpandedTask] = useState(null);
  const fileInputRef = useRef(null);
  const [activeUploadTaskId, setActiveUploadTaskId] = useState(null);

  // Per-task form input state, keyed by taskId
  const [notes, setNotes] = useState({});
  const [workLinks, setWorkLinks] = useState({});

  const fetchTasks = async () => {
    try {
      const res = await getTasks();
      setTasks(res.data.tasks);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    getTasks()
      .then((res) => { if (!cancelled) setTasks(res.data.tasks); })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleNoteChange = (taskId, val) => {
    setNotes(prev => ({ ...prev, [taskId]: val }));
  };
  const handleWorkLinkChange = (taskId, val) => {
    setWorkLinks(prev => ({ ...prev, [taskId]: val }));
  };

  const handleFileUpload = async (taskId, e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('workFile', file);
    e.target.value = '';
    try {
      const res = await uploadTaskFile(formData);
      handleWorkLinkChange(taskId, res.data.path);
      showToast('File uploaded.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to upload file.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (taskId) => {
    setSubmitting(true);
    try {
      await completeTask(taskId, { note: notes[taskId] || '', workLink: workLinks[taskId] || '' });
      showToast('Task submitted successfully.', 'success');
      
      // Clear inputs for this task
      handleNoteChange(taskId, '');
      handleWorkLinkChange(taskId, '');
      
      fetchTasks();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to submit task.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const doneTasks = tasks.filter(t => t.status === 'done');

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'var(--accent-glow)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--accent)',
          }}>
            <ClipboardList size={26} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.7rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
              My Tasks
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: 2 }}>
              Welcome, <span style={{ color: 'var(--accent-light)', fontWeight: 600 }}>{user?.name?.split(' ')[0]}</span> — submit your work when you're done.
            </p>
          </div>
        </div>
      </div>

      {/* Summary mini cards */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 32, flexWrap: 'wrap' }}>
        <div style={{
          padding: '12px 20px', borderRadius: 12, background: 'var(--bg-card)',
          border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <AlertCircle size={18} style={{ color: '#e97272' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{pendingTasks.length}</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Pending</span>
        </div>
        <div style={{
          padding: '12px 20px', borderRadius: 12, background: 'var(--bg-card)',
          border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{doneTasks.length}</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Completed</span>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '30vh' }}>
          <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      ) : (
        <>
          {/* ── PENDING TASKS ─────────────────────────────── */}
          {pendingTasks.length > 0 && (
            <div style={{ marginBottom: 36 }}>
              <div style={{
                fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase',
                letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 14,
                display: 'flex', alignItems: 'center', gap: 8
              }}>
                <AlertCircle size={13} style={{ color: '#e97272' }} /> Pending
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {pendingTasks.map(task => (
                  <div
                    key={task.id}
                    className="glass-card"
                    style={{
                      padding: 0, overflow: 'hidden',
                      border: '1px solid var(--border)',
                      transition: 'border-color 0.2s',
                    }}
                  >
                    {/* Task header */}
                    <div style={{
                      padding: '20px 24px',
                      background: 'transparent',
                      display: 'flex', alignItems: 'flex-start', gap: 16, transition: 'background 0.3s'
                    }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                        background: 'rgba(231,97,97,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '1px solid rgba(231,97,97,0.25)',
                      }}>
                        <AlertCircle size={22} style={{ color: '#e97272' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 4 }}>{task.title}</h2>
                        {task.description && (
                          <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 8 }}>
                            {task.description}
                          </p>
                        )}
                        {task.attachment && (
                          <a
                            href={resolveUrl(task.attachment)}
                            target="_blank" rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8, color: 'var(--accent)', fontSize: '0.8rem', textDecoration: 'none' }}
                          >
                            <Paperclip size={14} /> View Task Attachment
                          </a>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            <Clock size={11} />
                            Assigned {new Date(task.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                          </span>
                          <DeadlineLine task={task} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                        <DeadlineBadge task={task} />
                        <span style={{
                          padding: '4px 12px', borderRadius: 20, fontSize: '0.65rem', fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                          background: 'rgba(231,97,97,0.1)', color: '#e97272',
                          border: '1px solid rgba(231,97,97,0.3)',
                        }}>
                          Pending
                        </span>
                      </div>
                    </div>

                    {/* Submit form is always visible for pending tasks */}
                    <div style={{ padding: '0 24px 24px' }}>
                      <div style={{
                        height: 1, background: 'var(--border)', margin: '0 0 20px',
                      }} />
                      <h3 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Upload size={15} style={{ color: 'var(--accent)' }} /> Submit Your Work
                      </h3>

                      {/* Note */}
                      <div style={{ marginBottom: 14 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                          <MessageSquare size={12} style={{ display: 'inline', marginRight: 5 }} />
                          Note / What did you accomplish? <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span>
                        </label>
                        <textarea
                          className="form-input"
                          placeholder="Describe what you completed, tools used, any notes for the admin..."
                          value={notes[task.id] || ''}
                          onChange={e => handleNoteChange(task.id, e.target.value)}
                          style={{ minHeight: 90, resize: 'vertical', paddingTop: 12 }}
                        />
                      </div>

                      {/* Work link or file */}
                      <div style={{ marginBottom: 20 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                          <LinkIcon size={12} style={{ display: 'inline', marginRight: 5 }} />
                          Attach Work — Link or File <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span>
                        </label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            className="form-input"
                            placeholder="Paste a URL (Google Drive, GitHub, Figma...)"
                            value={workLinks[task.id] || ''}
                            onChange={e => handleWorkLinkChange(task.id, e.target.value)}
                          />
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '0 14px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}
                            onClick={() => {
                              setActiveUploadTaskId(task.id);
                              fileInputRef.current?.click();
                            }}
                            disabled={uploading}
                            title="Upload a file"
                          >
                            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
                            <span style={{ fontSize: '0.78rem' }}>File</span>
                          </button>
                        </div>
                        {workLinks[task.id] && workLinks[task.id].includes('/uploads/') && (
                          <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            gap: 8, marginTop: 8, padding: '8px 12px',
                            background: 'var(--success-glow)', borderRadius: 8,
                            fontSize: '0.75rem', color: 'var(--success)',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <FileText size={13} /> {workLinks[task.id].split('/').pop()}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleWorkLinkChange(task.id, '')}
                              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0 }}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button
                          className="btn-primary"
                          style={{ flex: 1, justifyContent: 'center' }}
                          onClick={() => handleSubmit(task.id)}
                          disabled={submitting || uploading}
                        >
                          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                          {submitting ? 'Submitting...' : 'Submit & Mark as Done'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No pending tasks (only when the member has at least one task) */}
          {pendingTasks.length === 0 && tasks.length > 0 && (
            <div className="glass-card" style={{
              padding: '52px 24px', textAlign: 'center',
              border: '1px dashed var(--border)', marginBottom: 32,
            }}>
              <CheckCircle2 size={52} style={{ color: 'var(--success)', margin: '0 auto 14px' }} />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>No Pending Tasks</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: 340, margin: '0 auto' }}>
                You have no pending tasks at the moment. New assignments will appear here when available.
              </p>
            </div>
          )}

          {/* ── COMPLETED TASKS ───────────────────────────── */}
          {doneTasks.length > 0 && (
            <div>
              <div style={{
                fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase',
                letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 14,
                display: 'flex', alignItems: 'center', gap: 8
              }}>
                <CheckCircle2 size={13} style={{ color: 'var(--success)' }} /> Completed
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {doneTasks.map(task => (
                  <div
                    key={task.id}
                    className="glass-card"
                    style={{ padding: '16px 20px', border: '1px solid var(--success-glow)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: 'var(--success-glow)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{task.title}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--success)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle2 size={11} />
                          Submitted {task.doneAt ? new Date(task.doneAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
                        </div>
                        {(task.note || task.workLink) && (
                          <button
                            style={{
                              background: 'none', border: 'none', color: 'var(--accent)',
                              fontSize: '0.75rem', cursor: 'pointer', padding: '4px 0', marginTop: 4,
                              display: 'flex', alignItems: 'center', gap: 4,
                            }}
                            onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                          >
                            {expandedTask === task.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            {expandedTask === task.id ? 'Hide' : 'View'} my submission
                          </button>
                        )}
                        {expandedTask === task.id && (
                          <div style={{
                            marginTop: 10, padding: '12px 14px', background: 'var(--bg-secondary)',
                            borderRadius: 10, fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.6,
                          }}>
                            {task.note && <p style={{ marginBottom: task.workLink ? 10 : 0 }}>{task.note}</p>}
                            {task.workLink && (
                              <a
                                href={resolveUrl(task.workLink)}
                                target="_blank" rel="noopener noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--accent)', fontSize: '0.78rem', textDecoration: 'none' }}
                              >
                                <ExternalLink size={13} /> View Submitted Work
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: '0.62rem', fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0,
                        background: 'var(--success-glow)', color: 'var(--success)',
                        border: '1px solid rgba(0,200,150,0.3)',
                      }}>
                        Completed
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tasks.length === 0 && (
            <div className="glass-card" style={{ padding: '52px 24px', textAlign: 'center', border: '1px dashed var(--border)' }}>
              <ClipboardList size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 14px' }} />
              <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8 }}>No Tasks Assigned</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                No tasks have been assigned to you yet. Check back for new assignments.
              </p>
            </div>
          )}
        </>
      )}

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={(e) => activeUploadTaskId && handleFileUpload(activeUploadTaskId, e)}
      />
    </div>
  );
}
