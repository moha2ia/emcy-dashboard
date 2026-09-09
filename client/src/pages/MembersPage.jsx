import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { resolveUrl } from '../utils/resolveUrl';
import { validateEmcyEmail, EMCY_EMAIL_ERROR } from '../utils/emcyEmail';
import { getUsers, registerUser, deleteUser, updateUser, uploadAvatar } from '../services/api';
import { Users, Plus, Trash2, Search, Briefcase, Activity, X, UserPlus, Edit2, Camera, Upload, Loader2, Download, ShieldCheck, Crown } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const OWNER_MAJOR = 'emcy management';

export default function MembersPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [members, setMembers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', project: '', role: 'member', avatar: '', skills: '', joinDate: '' });
  const [formError, setFormError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // The EMCY Management admin is the Owner — only they manage admin accounts
  const isOwner = user?.role === 'admin' && (user?.project || '').trim().toLowerCase() === OWNER_MAJOR;

  // Live EMCY email validation for the add/edit form
  const emailCheck = validateEmcyEmail(form.email);

  const fetchMembers = () => {
    getUsers()
      .then((res) => {
        setAdmins(res.data.users.filter((u) => u.role === 'admin'));
        setMembers(res.data.users.filter((u) => u.role === 'member'));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchMembers(); }, []);

  const resetForm = () => {
    setForm({ name: '', email: '', password: '', project: '', role: 'member', avatar: '', skills: '', joinDate: '' });
    setFormError('');
    setEditMode(false);
    setSelectedId(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowModal(true);
  };

  const handleOpenEdit = (m) => {
    setForm({
      name: m.name,
      email: m.email,
      password: '', // Don't show password
      project: m.project,
      role: m.role,
      avatar: m.avatar || '',
      skills: m.skills || '',
      joinDate: m.joinDate || ''
    });
    setSelectedId(m.id);
    setEditMode(true);
    setShowModal(true);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setFormError('');

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await uploadAvatar(formData);
      setForm({ ...form, avatar: res.data.path });
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to upload image.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    // EMCY email rule (client-side mirror of the server check)
    const emailCheck = validateEmcyEmail(form.email);
    if (!emailCheck.ok) {
      setFormError(emailCheck.error);
      return;
    }

    try {
      if (editMode) {
        const updateData = { ...form, email: emailCheck.email };
        if (!updateData.password) delete updateData.password;
        await updateUser(selectedId, updateData);
      } else {
        await registerUser({ ...form, email: emailCheck.email });
      }
      setShowModal(false);
      resetForm();
      fetchMembers();
    } catch (err) {
      setFormError(err.response?.data?.message || `Failed to ${editMode ? 'update' : 'add'} member.`);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Remove ${name}? This will also delete their progress data.`)) return;
    try {
      await deleteUser(id);
      showToast(`${name} removed successfully`, 'success');
      fetchMembers();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete.', 'error');
    }
  };

  const handleExportCSV = () => {
    if (members.length === 0) return;
    
    const headers = ['Name', 'Email', 'Major', 'Skills', 'Join Date'];
    const rows = members.map(m => [
      m.name,
      m.email,
      m.project,
      m.skills || '',
      m.joinDate || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `emcy_members_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exporting members list...', 'success');
  };

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.project.toLowerCase().includes(search.toLowerCase()) ||
      (m.skills && m.skills.toLowerCase().includes(search.toLowerCase()))
  );

  const getInitials = (n) => n.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();

  // The owner admin = the admin whose major is EMCY Management
  const isOwnerAdmin = (a) => a.role === 'admin' && (a.project || '').trim().toLowerCase() === OWNER_MAJOR;

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 32 }}>
          <div className="skeleton" style={{ width: 200, height: 40 }} />
          <div className="skeleton" style={{ width: 140, height: 40 }} />
        </div>
        <div className="skeleton" style={{ width: 400, height: 45, marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="glass-card skeleton" style={{ height: 200 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Users size={28} style={{ color: 'var(--accent)' }} />
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Members</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {members.length} members · {admins.length} administrator{admins.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn-secondary" onClick={handleExportCSV}>
            <Download size={18} /> Export CSV
          </button>
          {user.role === 'admin' && (
            <button className="btn-primary" onClick={handleOpenAdd}>
              <Plus size={18} /> Add Member
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 24, position: 'relative', maxWidth: 400 }}>
        <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          className="form-input"
          style={{ paddingLeft: 42, paddingRight: 42 }}
          placeholder="Search by name, major, or skills..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button 
            onClick={() => setSearch('')}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Administrators section — visible to everyone, manageable only by the Owner */}
      {admins.length > 0 && (
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
              <ShieldCheck size={14} style={{ color: 'var(--accent)' }} /> Administrators
            </div>
            {!isOwner && (
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Managed by EMCY Management
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {admins.map((admin) => (
              <div key={admin.id} className="glass-card" style={{ padding: 24, position: 'relative', borderColor: 'var(--border-accent)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                  <div
                    className="avatar"
                    style={{
                      background: admin.avatar ? `url(${resolveUrl(admin.avatar)}) center/cover` : `hsl(${admin.name.charCodeAt(0) * 7 % 360}, 60%, 50%)`,
                      color: '#fff', width: 56, height: 56,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)', border: '2px solid var(--border-accent)'
                    }}
                  >
                    {!admin.avatar && getInitials(admin.name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {admin.name}
                      {isOwnerAdmin(admin) && <Crown size={14} style={{ color: '#b8934a' }} title="Owner" />}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Briefcase size={14} /> {admin.project || '—'}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{admin.email}</div>

                {isOwner && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                    <button
                      className="btn-secondary"
                      style={{ padding: '6px 14px', fontSize: '0.75rem', gap: 6 }}
                      onClick={() => handleOpenEdit(admin)}
                    >
                      <Edit2 size={13} /> Edit
                    </button>
                    {admin.email !== 'admin@emcy.com' && (
                      <button
                        className="btn-danger"
                        style={{ padding: '6px 14px', fontSize: '0.75rem', gap: 6 }}
                        onClick={() => handleDelete(admin.id, admin.name)}
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members Grid */}
      <div className="stagger-children" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
        {filtered.map((member) => (
          <div key={member.id} className="glass-card" style={{ padding: 24, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div
                className="avatar"
                style={{
                  background: member.avatar ? `url(${resolveUrl(member.avatar)}) center/cover` : `hsl(${member.name.charCodeAt(0) * 7 % 360}, 60%, 50%)`,
                  color: '#fff',
                  width: 56,
                  height: 56,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  border: '2px solid var(--border)'
                }}
              >
                {!member.avatar && getInitials(member.name)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 2 }}>{member.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <Briefcase size={14} /> {member.project}
                </div>
                {member.skills && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                    Skills: {member.skills}
                  </div>
                )}
                {member.joinDate && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    Joined: {new Date(member.joinDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                  </div>
                )}
              </div>
              {user.role === 'admin' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn-secondary"
                    style={{ padding: 8, borderRadius: 10, background: 'var(--surface-muted)' }}
                    onClick={() => handleOpenEdit(member)}
                    title="Edit member"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    className="btn-danger"
                    style={{ padding: 8, borderRadius: 10 }}
                    onClick={() => handleDelete(member.id, member.name)}
                    title="Remove member"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span style={{ fontStyle: 'italic' }}>{member.email}</span>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-muted)' }}>
          <Activity size={32} style={{ marginBottom: 16, opacity: 0.5 }} />
          <div>No members found matching your search.</div>
        </div>
      )}

      {/* Member Modal (Add/Edit) */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
                {editMode ? <Edit2 size={24} style={{ color: 'var(--accent)' }} /> : <UserPlus size={24} style={{ color: 'var(--accent)' }} />}
                {editMode ? (form.role === 'admin' ? 'Edit Administrator' : 'Edit Member') : (isOwner ? 'Add Account' : 'Add New Member')}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>

            {formError && (
              <div style={{ background: 'var(--danger-glow)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: '0.85rem', color: 'var(--danger)' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Full Name</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="e.g. Yassine El Amrani"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Email (must be @emcy.ma)</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="member.name@emcy.ma"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                    style={{
                      borderColor: form.email && !emailCheck.ok ? 'var(--danger)' : undefined,
                    }}
                  />
                  {form.email && !emailCheck.ok && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--danger)', marginTop: 6 }}>
                      {EMCY_EMAIL_ERROR}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Major</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="e.g. Computer Science"
                    value={form.project}
                    onChange={(e) => setForm({ ...form, project: e.target.value })}
                    required
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>
                    {editMode ? 'New Password (Optional)' : 'Password'}
                  </label>
                  <input
                    className="form-input"
                    type="password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required={!editMode}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Skills (Optional)</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="e.g. React, Design, Marketing"
                    value={form.skills}
                    onChange={(e) => setForm({ ...form, skills: e.target.value })}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Join Date (Optional)</label>
                  <input
                    className="form-input"
                    type="date"
                    value={form.joinDate}
                    onChange={(e) => setForm({ ...form, joinDate: e.target.value })}
                  />
                </div>
              </div>

              {/* Role management — Owner only (EMCY Management) */}
              {isOwner && (
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>
                    Account Role <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Owner only)</span>
                  </label>
                  <select
                    className="form-input"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              )}


              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>
                  Profile Image
                </label>
                
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div 
                    className="avatar" 
                    style={{ 
                      width: 64, 
                      height: 64, 
                      borderRadius: 12,
                      background: form.avatar ? `url(${resolveUrl(form.avatar)}) center/cover` : 'var(--bg-secondary)',
                      border: '2px solid var(--border)',
                      flexShrink: 0
                    }}
                  >
                    {!form.avatar && <Camera size={24} style={{ opacity: 0.3 }} />}
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <button 
                        type="button" 
                        className="btn-secondary" 
                        style={{ padding: '8px 12px', fontSize: '0.75rem', gap: 6 }}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                      >
                        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                        {uploading ? 'Uploading...' : 'Upload Photo'}
                      </button>
                      {form.avatar && (
                        <button 
                          type="button" 
                          className="btn-danger" 
                          style={{ padding: '8px 12px', fontSize: '0.75rem' }}
                          onClick={() => setForm({ ...form, avatar: '' })}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      accept="image/*" 
                      style={{ display: 'none' }} 
                    />
                    <input
                      className="form-input"
                      type="text"
                      placeholder="Or paste image URL here..."
                      style={{ fontSize: '0.75rem', padding: '8px 12px' }}
                      value={form.avatar}
                      onChange={(e) => setForm({ ...form, avatar: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
                  {editMode ? <Edit2 size={18} /> : <Plus size={18} />}
                  {editMode ? 'Save Changes' : form.role === 'admin' ? 'Create Administrator' : 'Create Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
