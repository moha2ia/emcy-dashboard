import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { resolveUrl } from '../utils/resolveUrl';
import { DeadlineBadge, DeadlineLine, toLocalInputValue } from '../utils/deadline';
import { getStats, getRecentActivity, getTasks, createTask, completeTask, deleteTask, reopenTask, uploadTaskFile, getUsers } from '../services/api';
import {
  Users,
  ArrowUpRight,
  Activity,
  CheckCircle2,
  MessageSquare,
  Plus,
  Loader2,
  Paperclip,
  FileText,
  Clock,
  ExternalLink,
  X,
  Trash2,
  ClipboardList,
  Send,
  RotateCcw,
  AlertCircle,
  User,
  ChevronDown,
  ChevronUp,
  CalendarClock,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';

const COLORS = ['#3d6db5', '#0d9488', '#6366f1', '#d97706', '#5b8fd4', '#0891b2'];

export default function DashboardPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);

  // Task states
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [members, setMembers] = useState([]);

  // Member: completing a task
  const [completingTaskId, setCompletingTaskId] = useState(null);
  const [taskNote, setTaskNote] = useState('');
  const [taskWorkLink, setTaskWorkLink] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  // Admin: creating a task
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ title: '', description: '', assignedTo: 'all', attachment: '', deadline: '' });
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [reopeningId, setReopeningId] = useState(null);
  const adminFileInputRef = useRef(null);

  // UI
  const [expandedTask, setExpandedTask] = useState(null);

  const refreshData = async () => {
    // Silent refresh used after mutations - no loading spinners
    try {
      const [statsRes, tasksRes] = await Promise.all([getStats(), getTasks()]);
      setStats(statsRes.data.stats);
      setTasks(tasksRes.data.tasks);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    // Re-fetch only when the identity changes (not on every user object refresh)
    if (!user?.id) return;
    const isAdmin = user.role === 'admin';
    const fetchAll = async () => {
      const requests = [getStats(), getTasks()];
      if (isAdmin) requests.push(getRecentActivity(), getUsers());
      const [statsRes, tasksRes, activityRes, usersRes] = await Promise.allSettled(requests);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data.stats);
      if (tasksRes.status === 'fulfilled') setTasks(tasksRes.value.data.tasks);
      if (activityRes?.status === 'fulfilled') setRecentActivity(activityRes.value.data.activity);
      if (usersRes?.status === 'fulfilled') {
        setMembers(usersRes.value.data.users.filter(u => u.role === 'member'));
      }
      setLoading(false);
      setTasksLoading(false);
    };
    fetchAll();
  }, [user?.id, user?.role]);

  // Member: File upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingFile(true);
    const formData = new FormData();
    formData.append('workFile', file);
    try {
      const res = await uploadTaskFile(formData);
      setTaskWorkLink(res.data.path);
      showToast('File uploaded.', 'success');
    } catch {
      showToast('Failed to upload file.', 'error');
    } finally {
      setUploadingFile(false);
    }
  };

  // Member: Complete task
  const handleCompleteTask = async (taskId) => {
    setSubmitting(true);
    try {
      await completeTask(taskId, { note: taskNote, workLink: taskWorkLink });
      showToast('Task marked as done.', 'success');
      setCompletingTaskId(null);
      setTaskNote('');
      setTaskWorkLink('');
      refreshData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to complete task.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Admin: File upload for task creation
  const handleAdminFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingFile(true);
    const formData = new FormData();
    formData.append('workFile', file);
    try {
      const res = await uploadTaskFile(formData);
      setCreateForm(prev => ({ ...prev, attachment: res.data.path }));
      showToast('File uploaded.', 'success');
    } catch {
      showToast('Failed to upload file.', 'error');
    } finally {
      setUploadingFile(false);
    }
  };

  // Admin: Create task
  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!createForm.title.trim()) return showToast('Title is required.', 'error');
    if (createForm.deadline) {
      const d = new Date(createForm.deadline);
      if (Number.isNaN(d.getTime()) || d.getTime() < Date.now() - 5 * 60 * 1000) {
        return showToast('Deadline must be a valid future date.', 'error');
      }
    }
    setCreating(true);
    try {
      await createTask({
        ...createForm,
        deadline: createForm.deadline ? new Date(createForm.deadline).toISOString() : null,
      });
      showToast('Task created.', 'success');
      setShowCreateModal(false);
      setCreateForm({ title: '', description: '', assignedTo: 'all', attachment: '', deadline: '' });
      refreshData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create task.', 'error');
    } finally {
      setCreating(false);
    }
  };

  // Admin: Delete task
  const handleDeleteTask = async (taskId) => {
    setDeletingId(taskId);
    try {
      await deleteTask(taskId);
      showToast('Task deleted.', 'success');
      refreshData();
    } catch {
      showToast('Failed to delete task.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  // Admin: Reopen task
  const handleReopenTask = async (taskId) => {
    setReopeningId(taskId);
    try {
      await reopenTask(taskId);
      showToast('Task reopened.', 'success');
      refreshData();
    } catch {
      showToast('Failed to reopen task.', 'error');
    } finally {
      setReopeningId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <Activity size={40} style={{ color: 'var(--accent)' }} />
          <p style={{ color: 'var(--text-muted)', marginTop: 16 }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const isAdmin = user.role === 'admin';

  // Derived task stats
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.status === 'done').length;
  const pendingTasks = tasks.filter(t => t.status === 'pending').length;

  const statCards = isAdmin ? [
    { label: 'Total Members', value: stats.totalMembers, icon: Users, color: '#3d6db5', change: 'Active members' },
    { label: 'Tasks Created', value: totalTasks, icon: ClipboardList, color: '#6366f1', change: `${pendingTasks} pending` },
    { label: 'Completed', value: doneTasks, icon: CheckCircle2, color: '#0d9488', change: `of ${totalTasks} assigned` },
    { label: 'Pending', value: pendingTasks, icon: AlertCircle, color: '#e17055', change: 'Awaiting submission' },
  ] : [
    { label: 'Pending Tasks', value: tasks.filter(t => t.status === 'pending').length, icon: AlertCircle, color: '#e17055', change: 'Awaiting completion' },
    { label: 'Tasks Done', value: tasks.filter(t => t.status === 'done').length, icon: CheckCircle2, color: '#3d6db5', change: 'Total completed' },
  ];

  // Member's active (pending) task - first one
  const myPendingTask = !isAdmin ? tasks.find(t => t.status === 'pending') : null;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
            Welcome back, <span style={{ color: 'var(--accent-light)' }}>{user?.name?.split(' ')[0]}</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
            {isAdmin ? "Manage your team's tasks and monitor progress." : "Here's your current task and progress overview."}
          </p>
        </div>

        {isAdmin && (
          <button
            className="btn-primary"
            style={{ gap: 8, padding: '10px 20px' }}
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={18} /> Assign New Task
          </button>
        )}
      </div>

      {/* Stat Cards */}
      <div className="stagger-children" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 32 }}>
        {statCards.map((card, i) => (
          <div key={i} className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: `${card.color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <card.icon size={22} color={card.color} />
              </div>
              <ArrowUpRight size={16} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>
              {card.value}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{card.label}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 8 }}>{card.change}</div>
          </div>
        ))}
      </div>

      {/* MEMBER VIEW: Current Task */}
      {!isAdmin && (
        <div style={{ marginBottom: 32 }}>
          {tasksLoading ? (
            <div className="glass-card" style={{ padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent)' }} />
              <span style={{ color: 'var(--text-muted)' }}>Loading your task...</span>
            </div>
          ) : myPendingTask ? (
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--accent)', borderRadius: 16 }}>
              {/* Task header */}
              <div style={{
                padding: '20px 24px',
                background: 'linear-gradient(135deg, var(--accent-glow) 0%, transparent 100%)',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14, background: 'var(--accent-glow)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  border: '1px solid var(--accent)'
                }}>
                  <ClipboardList size={26} style={{ color: 'var(--accent)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                    Your Current Task
                  </div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: myPendingTask.description ? 6 : 0 }}>
                    {myPendingTask.title}
                  </h2>
                  {myPendingTask.description && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {myPendingTask.description}
                    </p>
                  )}
                  {myPendingTask.attachment && (
                    <a
                      href={resolveUrl(myPendingTask.attachment)}
                      target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, color: 'var(--accent)', fontSize: '0.8rem', textDecoration: 'none' }}
                    >
                      <Paperclip size={14} /> View Task Attachment
                    </a>
                  )}
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} /> Assigned {new Date(myPendingTask.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                    <DeadlineLine task={myPendingTask} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  <DeadlineBadge task={myPendingTask} />
                  <div style={{
                    padding: '4px 12px', borderRadius: 20, background: 'rgba(231,97,97,0.12)',
                    color: '#e97272', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                    border: '1px solid rgba(231,97,97,0.3)',
                  }}>
                    Pending
                  </div>
                </div>
              </div>

              {/* Completion form */}
              {completingTaskId === myPendingTask.id ? (
                <div style={{ padding: 24 }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MessageSquare size={16} style={{ color: 'var(--accent)' }} /> Submit your work
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>Note / What did you accomplish?</div>
                      <textarea
                        className="form-input"
                        placeholder="Describe what you did, any challenges, links to resources..."
                        value={taskNote}
                        onChange={e => setTaskNote(e.target.value)}
                        style={{ minHeight: 80, resize: 'vertical', paddingTop: 12 }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>Work Link or File (optional)</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          className="form-input"
                          placeholder="https://..."
                          value={taskWorkLink}
                          onChange={e => setTaskWorkLink(e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '8px 12px' }}
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingFile}
                          title="Upload a file"
                        >
                          {uploadingFile ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
                        </button>
                        <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
                      </div>
                      {taskWorkLink && taskWorkLink.includes('/uploads/') && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', color: 'var(--success)', marginTop: 6 }}>
                          <FileText size={12} /> {taskWorkLink.split('/').pop()}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                      <button
                        className="btn-primary"
                        style={{ flex: 1, justifyContent: 'center' }}
                        onClick={() => handleCompleteTask(myPendingTask.id)}
                        disabled={submitting || uploadingFile}
                      >
                        {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                        {submitting ? 'Submitting...' : 'Mark as Done'}
                      </button>
                      <button
                        className="btn-secondary"
                        style={{ padding: '10px 20px' }}
                        onClick={() => { setCompletingTaskId(null); setTaskNote(''); setTaskWorkLink(''); }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    className="btn-primary"
                    style={{ gap: 8 }}
                    onClick={() => setCompletingTaskId(myPendingTask.id)}
                  >
                    <CheckCircle2 size={18} /> Submit Completed Work
                  </button>
                </div>
              )}
            </div>
          ) : tasks.length === 0 ? (
            <div className="glass-card" style={{ padding: 40, textAlign: 'center', border: '1px dashed var(--border)' }}>
              <ClipboardList size={44} style={{ color: 'var(--text-muted)', margin: '0 auto 14px' }} />
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 8 }}>No Tasks Assigned Yet</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                When your team lead assigns you a task, it will appear here.
              </p>
            </div>
          ) : (
            <div className="glass-card" style={{ padding: 40, textAlign: 'center', border: '1px dashed var(--border)' }}>
              <CheckCircle2 size={48} style={{ color: 'var(--success)', margin: '0 auto 16px' }} />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>No Pending Tasks</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                You have no pending tasks at the moment. New assignments will appear here when available.
              </p>
            </div>
          )}

          {/* Completed tasks (member) */}
          {tasks.filter(t => t.status === 'done').length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={14} style={{ color: 'var(--success)' }} /> Completed Tasks
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tasks.filter(t => t.status === 'done').map(task => (
                  <div key={task.id} className="glass-card" style={{ padding: '14px 20px', border: '1px solid var(--success-glow)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--success-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{task.title}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            Completed {task.doneAt ? new Date(task.doneAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                          </div>
                        </div>
                      </div>
                      <button
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                        onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                        title="View details"
                      >
                        {expandedTask === task.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                    {expandedTask === task.id && task.note && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {task.note}
                        {task.workLink && (
                          <a
                            href={resolveUrl(task.workLink)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, color: 'var(--accent)', fontSize: '0.8rem', textDecoration: 'none' }}
                          >
                            <ExternalLink size={14} /> View Work
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ADMIN VIEW: Task Management */}
      {isAdmin && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardList size={18} style={{ color: 'var(--accent)' }} /> Task Management
            </h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {pendingTasks} pending · {doneTasks} completed
            </div>
          </div>

          {tasksLoading ? (
            <div className="glass-card" style={{ padding: 32, textAlign: 'center' }}>
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
            </div>
          ) : tasks.length === 0 ? (
            <div className="glass-card" style={{ padding: 40, textAlign: 'center', border: '1px dashed var(--border)' }}>
              <ClipboardList size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No tasks found. Use "Create New Task" to begin.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {tasks.map(task => (
                <div
                  key={task.id}
                  className="glass-card"
                  style={{
                    padding: '16px 20px',
                    border: `1px solid ${task.status === 'done' ? 'var(--success-glow)' : 'var(--border)'}`,
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    {/* Status icon */}
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0, marginTop: 2,
                      background: task.status === 'done' ? 'var(--success-glow)' : 'rgba(99,102,241,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {task.status === 'done'
                        ? <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
                        : <AlertCircle size={18} style={{ color: '#4f46e5' }} />
                      }
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{task.title}</span>
                        <span style={{
                          padding: '2px 10px', borderRadius: 20, fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                          background: task.status === 'done' ? 'var(--success-glow)' : 'rgba(231,97,97,0.12)',
                          color: task.status === 'done' ? 'var(--success)' : '#e97272',
                          border: `1px solid ${task.status === 'done' ? 'rgba(0,200,150,0.3)' : 'rgba(231,97,97,0.3)'}`,
                        }}>
                          {task.status === 'done' ? 'Completed' : 'Pending'}
                        </span>
                        <DeadlineBadge task={task} size="sm" />
                      </div>
                      {task.description && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>{task.description}</p>
                      )}
                      {task.attachment && (
                        <a
                          href={resolveUrl(task.attachment)}
                          target="_blank" rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, color: 'var(--accent)', fontSize: '0.75rem', textDecoration: 'none' }}
                        >
                          <Paperclip size={13} /> View Attachment
                        </a>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          <User size={12} />
                          {task.assignedToName}
                          {task.assignedToProject && <span style={{ opacity: 0.6 }}>· {task.assignedToProject}</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          <Clock size={12} />
                          Created {new Date(task.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                        </div>
                        {task.status === 'done' && task.doneAt && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: 'var(--success)' }}>
                            <CheckCircle2 size={12} />
                            Completed {new Date(task.doneAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                          </div>
                        )}
                      </div>
                      {/* Submission note (if done) */}
                      {task.status === 'done' && task.note && (
                        <div style={{ marginTop: 10 }}>
                          <button
                            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.75rem', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
                            onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                          >
                            {expandedTask === task.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            {expandedTask === task.id ? 'Hide' : 'View'} submission
                          </button>
                          {expandedTask === task.id && (
                            <div style={{ marginTop: 8, padding: 12, background: 'var(--bg-secondary)', borderRadius: 10, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                              {task.note}
                              {task.workLink && (
                                <a
                                  href={resolveUrl(task.workLink)}
                                  target="_blank" rel="noopener noreferrer"
                                  style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, color: 'var(--accent)', fontSize: '0.78rem', textDecoration: 'none' }}
                                >
                                  <ExternalLink size={13} /> View Work
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      {task.status === 'done' && (
                        <button
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.75rem', gap: 6 }}
                          onClick={() => handleReopenTask(task.id)}
                          disabled={reopeningId === task.id}
                          title="Reopen task"
                        >
                          {reopeningId === task.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                          Reopen
                        </button>
                      )}
                      <button
                        className="btn-secondary"
                        style={{ padding: '6px 10px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                        onClick={() => handleDeleteTask(task.id)}
                        disabled={deletingId === task.id}
                        title="Delete task"
                      >
                        {deletingId === task.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Charts & Recent Activity (Admin) */}
      {isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 24, marginBottom: 32 }}>
          {/* Task Completion Chart */}
          <div className="glass-card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 20 }}>Team Performance Weekly</h3>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={stats.weeklyStats}>
                <defs>
                  <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="week" tickFormatter={(w) => `W${w}`} stroke="var(--text-muted)" fontSize={12} />
                <YAxis stroke="var(--text-muted)" fontSize={12} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: '0.85rem' }}
                  labelFormatter={(w) => `Week ${w}`}
                  formatter={(value) => [`${value}%`, 'Completion']}
                />
                <Area type="monotone" dataKey="completionRate" stroke="#2563eb" strokeWidth={2} fill="url(#colorRate)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Recent Activity */}
          <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={18} style={{ color: 'var(--accent)' }} /> Activity Feed
            </h3>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', maxHeight: 300 }}>
              {recentActivity.map((act, i) => (
                <div
                  key={act.id}
                  onClick={() => setSelectedActivity(act)}
                  style={{
                    display: 'flex', gap: 12, cursor: 'pointer',
                    padding: '8px', borderRadius: '8px',
                    borderBottom: i < recentActivity.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                  className="activity-item-hover"
                >
                  <div
                    className="avatar"
                    style={{
                      width: 32, height: 32, fontSize: '0.7rem', flexShrink: 0,
                      background: act.userAvatar ? `url(${resolveUrl(act.userAvatar)}) center/cover` : `hsl(${act.userName.charCodeAt(0) * 13 % 360}, 50%, 50%)`,
                      color: '#fff'
                    }}
                  >
                    {!act.userAvatar && act.userName[0]}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{act.userName}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(act.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{act.note}</p>
                    {act.workLink && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <ExternalLink size={12} /> Details
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 40 }}>No activity recorded.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Admin: Project Distribution + Weekly breakdown */}
      {isAdmin && stats.projectStats && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div className="glass-card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 20 }}>Project Distribution</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <div style={{ width: '50%' }}>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={stats.projectStats} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="members" nameKey="name" paddingAngle={3} strokeWidth={0}>
                      {stats.projectStats.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: '0.8rem' }} formatter={(v, n) => [`${v} members`, n]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ width: '50%' }}>
                {stats.projectStats.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', marginBottom: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{p.name}</span>
                    <span style={{ fontWeight: 600 }}>{p.avgScore}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="glass-card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 20 }}>Team Weekly Status</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.weeklyStats} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="week" tickFormatter={(w) => `W${w}`} stroke="var(--text-muted)" fontSize={12} />
                <YAxis stroke="var(--text-muted)" fontSize={12} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: '0.85rem' }} labelFormatter={(w) => `Week ${w}`} />
                <Bar dataKey="done" name="Done" fill="#0d9488" radius={[4, 4, 0, 0]} />
                <Bar dataKey="notDone" name="Pending" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Member: performance chart */}
      {!isAdmin && stats.userWeeklyStats && stats.userWeeklyStats.length > 0 && (
        <div className="glass-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 20 }}>Engagement History</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={stats.userWeeklyStats}>
              <defs>
                <linearGradient id="colorMember" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="week" tickFormatter={(w) => `W${w}`} stroke="var(--text-muted)" fontSize={12} />
              <YAxis stroke="var(--text-muted)" fontSize={12} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: '0.85rem' }} labelFormatter={(w) => `Week ${w}`} formatter={(v) => [`${v}%`, 'Status']} />
              <Area type="monotone" dataKey="completionRate" stroke="#2563eb" strokeWidth={2} fill="url(#colorMember)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Create Task Modal (Admin) */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Create New Task</h2>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateTask}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Task Title *
                </label>
                <input
                  className="form-input"
                  placeholder="Task subject"
                  value={createForm.title}
                  onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
                  required
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  <CalendarClock size={14} /> Deadline <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
                </label>
                <input
                  className="form-input"
                  type="datetime-local"
                  value={createForm.deadline}
                  onChange={e => setCreateForm({ ...createForm, deadline: e.target.value })}
                />
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Today 18:00', get: () => { const d = new Date(); d.setHours(18, 0, 0, 0); return d; } },
                    { label: 'Tomorrow 9:00', get: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; } },
                    { label: 'In 3 days', get: () => { const d = new Date(); d.setDate(d.getDate() + 3); d.setHours(18, 0, 0, 0); return d; } },
                    { label: 'Next week', get: () => { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(18, 0, 0, 0); return d; } },
                  ].map(q => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => setCreateForm({ ...createForm, deadline: toLocalInputValue(q.get()) })}
                      style={{
                        padding: '4px 10px', borderRadius: 16, fontSize: '0.7rem', fontWeight: 600,
                        border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                        color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                      {q.label}
                    </button>
                  ))}
                  {createForm.deadline && (
                    <button
                      type="button"
                      onClick={() => setCreateForm({ ...createForm, deadline: '' })}
                      style={{
                        padding: '4px 10px', borderRadius: 16, fontSize: '0.7rem', fontWeight: 600,
                        border: '1px solid rgba(220,38,38,0.3)', background: 'var(--danger-glow)',
                        color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                      }}
                    >
                      <X size={11} /> Clear
                    </button>
                  )}
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Description (optional)
                </label>
                <textarea
                  className="form-input"
                  placeholder="Provide task details..."
                  value={createForm.description}
                  onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                  style={{ minHeight: 80, resize: 'vertical', paddingTop: 12 }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Attachment (optional)
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="form-input"
                    placeholder="URL or upload a file..."
                    value={createForm.attachment}
                    onChange={e => setCreateForm({ ...createForm, attachment: e.target.value })}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '8px 12px' }}
                    onClick={() => adminFileInputRef.current?.click()}
                    disabled={uploadingFile}
                    title="Upload a file"
                  >
                    {uploadingFile ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
                  </button>
                  <input type="file" ref={adminFileInputRef} style={{ display: 'none' }} onChange={handleAdminFileUpload} />
                </div>
                {createForm.attachment && createForm.attachment.includes('/uploads/') && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', color: 'var(--success)', marginTop: 6 }}>
                    <FileText size={12} /> {createForm.attachment.split('/').pop()}
                  </div>
                )}
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Assign To *
                </label>
                <select
                  className="form-input"
                  value={createForm.assignedTo}
                  onChange={e => setCreateForm({ ...createForm, assignedTo: e.target.value })}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="all">All Members</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name} - {m.project}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={creating}>
                  {creating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                  {creating ? 'Creating...' : 'Create Task'}
                </button>
                <button type="button" className="btn-secondary" style={{ padding: '10px 20px' }} onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Activity Details Modal */}
      {selectedActivity && (
        <div className="modal-overlay" onClick={() => setSelectedActivity(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Activity Details</h2>
              <button onClick={() => setSelectedActivity(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div
                className="avatar"
                style={{
                  width: 56, height: 56, fontSize: '1.2rem',
                  background: selectedActivity.userAvatar ? `url(${resolveUrl(selectedActivity.userAvatar)}) center/cover` : `hsl(${selectedActivity.userName.charCodeAt(0) * 13 % 360}, 50%, 50%)`,
                  color: '#fff'
                }}
              >
                {!selectedActivity.userAvatar && selectedActivity.userName[0]}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{selectedActivity.userName}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Project: {selectedActivity.userProject || 'General'}</div>
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={14} /> Submitted on {new Date(selectedActivity.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
              <div className="glass-card" style={{ padding: 16, fontSize: '0.9rem', lineHeight: 1.6, background: 'var(--surface-muted)' }}>
                {selectedActivity.note}
              </div>
            </div>
            {selectedActivity.workLink && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Attachment</div>
                <a
                  href={resolveUrl(selectedActivity.workLink)}
                  target="_blank" rel="noopener noreferrer"
                  className="btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', gap: 10 }}
                >
                  <ExternalLink size={18} /> View Submitted Work
                </a>
              </div>
            )}
            <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setSelectedActivity(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
