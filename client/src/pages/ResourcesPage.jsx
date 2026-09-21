import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { resolveUrl } from '../utils/resolveUrl';
import { getResources, createResource, uploadResource, deleteResource } from '../services/api';
import {
  FolderOpen,
  Plus,
  Trash2,
  Search,
  Link as LinkIcon,
  FileText,
  Image,
  FileArchive,
  File,
  ExternalLink,
  Download,
  X,
  Loader2,
  Upload,
  Globe,
} from 'lucide-react';

// Human-readable label + accent color per category.
// '' is the uncategorized fallback; the All chip is rendered separately and
// only categories actually in use appear as filter chips.
const CATEGORIES = [
  { value: '', label: 'General', color: 'var(--accent)' },
  { value: 'brand', label: 'Brand & Logos', color: '#d97706' },
  { value: 'docs', label: 'Documents & Rules', color: '#0d9488' },
  { value: 'presentations', label: 'Presentations', color: '#c026d3' },
  { value: 'episodes', label: 'Episode Prep', color: '#e11d48' },
  { value: 'media', label: 'Media & Photos', color: '#0284c7' },
  { value: 'tools', label: 'Tools & Links', color: '#6366f1' },
  { value: 'templates', label: 'Templates', color: '#0891b2' },
];

function categoryMeta(value) {
  return CATEGORIES.find((c) => c.value === value) || CATEGORIES[0];
}

// Pick an icon + color from the file extension
function fileIconMeta(fileName = '') {
  const ext = fileName.split('.').pop().toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico'].includes(ext)) {
    return { Icon: Image, color: '#d97706' };
  }
  if (ext === 'pdf') return { Icon: FileText, color: '#dc2626' };
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return { Icon: FileArchive, color: '#6366f1' };
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'csv'].includes(ext)) {
    return { Icon: FileText, color: '#0d9488' };
  }
  return { Icon: File, color: 'var(--text-muted)' };
}

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ResourcesPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isAdmin = user?.role === 'admin';

  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Add-resource modal state (admin only)
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState('link'); // 'link' | 'file'
  const [form, setForm] = useState({ title: '', description: '', url: '', category: '' });
  const [selectedFile, setSelectedFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const fileInputRef = useRef(null);

  const fetchResources = () => {
    getResources()
      .then((res) => setResources(res.data.resources))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchResources();
  }, []);

  const resetForm = () => {
    setForm({ title: '', description: '', url: '', category: '' });
    setSelectedFile(null);
    setMode('link');
    setSaving(false);
  };

  const handleOpenModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mode === 'link') {
      if (!form.title.trim() || !form.url.trim()) {
        showToast('Title and URL are required.', 'error');
        return;
      }
    } else if (!form.title.trim() || !selectedFile) {
      showToast('Title and a file are required.', 'error');
      return;
    }

    setSaving(true);
    try {
      if (mode === 'link') {
        await createResource({
          title: form.title,
          description: form.description,
          url: form.url,
          category: form.category,
        });
        showToast('Link resource added.', 'success');
      } else {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('title', form.title);
        formData.append('description', form.description);
        formData.append('category', form.category);
        await uploadResource(formData);
        showToast('File uploaded to resources.', 'success');
      }
      setShowModal(false);
      resetForm();
      fetchResources();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save resource.', 'error');
      setSaving(false);
    }
  };

  const handleDelete = async (resource) => {
    if (!confirm(`Delete "${resource.title}"? This cannot be undone.`)) return;
    setDeletingId(resource.id);
    try {
      await deleteResource(resource.id);
      showToast('Resource deleted.', 'success');
      fetchResources();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete resource.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  // Search + category filtering
  const filtered = resources.filter((r) => {
    const matchesCategory = !categoryFilter || r.category === categoryFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      r.title?.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q) ||
      r.fileName?.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  // Chip counts - All counts everything; a category chip only shows when in use
  const countFor = (value) =>
    value === '' ? resources.length : resources.filter((r) => r.category === value).length;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'var(--accent-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--accent)',
            }}
          >
            <FolderOpen size={26} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.7rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Resources</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: 2 }}>
              Everything the team needs - logos, presentations, episode notes, documents and links, in one place.
            </p>
          </div>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={handleOpenModal}>
            <Plus size={18} /> Add Resource
          </button>
        )}
      </div>

      {/* Search + category chips */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 420 }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
          />
          <input
            className="form-input"
            placeholder="Search resources..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 40 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[{ value: '', label: 'All' }, ...CATEGORIES.filter((cat) => cat.value && countFor(cat.value) > 0)].map((cat) => {
            const active = categoryFilter === cat.value;
            const color = cat.value ? cat.color : 'var(--accent)';
            return (
              <button
                key={cat.value || 'all'}
                onClick={() => setCategoryFilter(cat.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '7px 14px',
                  borderRadius: 20,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: `1px solid ${active ? color : 'var(--border)'}`,
                  background: active ? color : 'var(--bg-card)',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                {cat.label}
                <span style={{ fontSize: '0.66rem', fontWeight: 800, opacity: active ? 0.85 : 0.55 }}>{countFor(cat.value)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '30vh' }}>
          <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card" style={{ padding: '52px 24px', textAlign: 'center', border: '1px dashed var(--border)' }}>
          <FolderOpen size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 14px' }} />
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8 }}>
            {resources.length === 0 ? 'No Resources Yet' : 'Nothing Matches Your Filters'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: 380, margin: '0 auto' }}>
            {resources.length === 0
              ? isAdmin
                ? 'Click "Add Resource" to upload your first file or share a link.'
                : 'Resources shared by the admins will appear here. Check back soon!'
              : 'Try a different search term or category.'}
          </p>
        </div>
      ) : (
        <div className="stagger-children" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {filtered.map((resource) => {
            const cat = categoryMeta(resource.category);
            const isFile = resource.type === 'file';
            const ext = isFile && resource.fileName ? resource.fileName.split('.').pop().toLowerCase() : '';
            const { Icon: FileIcon, color: fileColor } = isFile
              ? fileIconMeta(resource.fileName)
              : { Icon: Globe, color: 'var(--accent)' };
            const href = isFile ? resolveUrl(resource.filePath) : resource.url;
            const thumbSrc =
              isFile && ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext) ? resolveUrl(resource.filePath) : null;

            return (
              <div
                key={resource.id}
                className="glass-card"
                style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                {/* Icon + category */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      background: 'var(--accent-soft)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <FileIcon size={21} style={{ color: fileColor }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: 20,
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        background: 'var(--bg-secondary)',
                        color: cat.color,
                        border: '1px solid var(--border)',
                      }}
                    >
                      {cat.label}
                    </span>
                    {isAdmin && (
                      <button
                        className="btn-danger"
                        style={{ padding: 7, borderRadius: 9 }}
                        onClick={() => handleDelete(resource)}
                        disabled={deletingId === resource.id}
                        title="Delete resource"
                      >
                        {deletingId === resource.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Image preview */}
                {thumbSrc && (
                  <div
                    style={{
                      height: 130,
                      borderRadius: 12,
                      overflow: 'hidden',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={thumbSrc}
                      alt={resource.title}
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </div>
                )}

                {/* Body */}
                <div style={{ flex: 1 }}>
                  <h3
                    style={{
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      marginBottom: 4,
                      wordBreak: 'break-word',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {resource.title}
                  </h3>
                  {resource.description && (
                    <p
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.5,
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {resource.description}
                    </p>
                  )}
                  {!isFile && resource.url && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6, wordBreak: 'break-all' }}>
                      {resource.url}
                    </div>
                  )}
                  {isFile && resource.fileSize != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontSize: '0.6rem',
                          fontWeight: 800,
                          letterSpacing: '0.06em',
                          background: 'var(--accent-soft)',
                          color: fileColor,
                          border: '1px solid var(--border)',
                          flexShrink: 0,
                        }}
                      >
                        {ext ? ext.toUpperCase() : 'FILE'}
                      </span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resource.fileName}</span>
                      <span style={{ flexShrink: 0 }}>· {formatFileSize(resource.fileSize)}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                  style={{ justifyContent: 'center', textDecoration: 'none', fontSize: '0.8rem' }}
                >
                  {isFile ? (
                    <>
                      <Download size={15} /> Open / Download
                    </>
                  ) : (
                    <>
                      <ExternalLink size={15} /> Open Link
                    </>
                  )}
                </a>

                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  Added by {resource.uploadedByName || 'Admin'} ·{' '}
                  {new Date(resource.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Resource Modal (admin only) */}
      {showModal && isAdmin && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Plus size={24} style={{ color: 'var(--accent)' }} /> Add Resource
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>

            {/* Link / File toggle */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                background: 'var(--bg-secondary)',
                padding: 6,
                borderRadius: 12,
                marginBottom: 20,
              }}
            >
              {[
                { value: 'link', label: 'Link', icon: LinkIcon },
                { value: 'file', label: 'File Upload', icon: Upload },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMode(opt.value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '9px 0',
                    borderRadius: 9,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    background: mode === opt.value ? 'var(--bg-card)' : 'transparent',
                    color: mode === opt.value ? 'var(--accent)' : 'var(--text-secondary)',
                    boxShadow: mode === opt.value ? 'var(--shadow-sm)' : 'none',
                  }}
                >
                  <opt.icon size={15} /> {opt.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Title</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder={mode === 'link' ? 'e.g. Canvas Login' : 'e.g. EMCY Logo Pack 2026'}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>

              {mode === 'link' ? (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>URL</label>
                  <input
                    className="form-input"
                    type="url"
                    placeholder="https://..."
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    required
                  />
                </div>
              ) : (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>File</label>
                  <input
                    className="form-input"
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => setSelectedFile(e.target.files[0] || null)}
                    required
                    style={{ padding: '10px 12px', fontSize: '0.8rem' }}
                  />
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 6 }}>
                    Any document, image or archive up to 25MB (PDF, PNG, ZIP...).
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>
                  Description <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span>
                </label>
                <textarea
                  className="form-input"
                  placeholder="What is this resource for?"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  style={{ minHeight: 70, resize: 'vertical', paddingTop: 12 }}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Category</label>
                <select
                  className="form-input"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value || 'all'} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <Loader2 size={16} className="animate-spin" /> : mode === 'link' ? <LinkIcon size={16} /> : <Upload size={16} />}
                  {saving ? 'Saving...' : mode === 'link' ? 'Add Link' : 'Upload File'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
