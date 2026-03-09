import { useState, useEffect } from 'react';
import { api } from '../api';
import { Repeat, Plus, Trash2, X, Play, Pause, Clock, Calendar, FileText, Sparkles, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

interface RecycleSchedule {
  id: string;
  post_id: string;
  post_content: string | null;
  recycle_interval_days: number;
  next_recycle_at: string | null;
  max_recycles: number;
  current_recycle_count: number;
  modify_content: boolean;
  modification_type: string;
  is_active: boolean;
}

interface Post {
  id: string;
  content: string;
  status: string;
  created_at: string;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

const MODIFICATION_TYPES = [
  { value: 'ai_rewrite', label: 'AI Rewrite', description: 'Use AI to completely rewrite the content while keeping the same message' },
  { value: 'paraphrase', label: 'Paraphrase', description: 'Keep the same structure but change the wording' },
  { value: 'add_context', label: 'Add Context', description: 'Add timely context or updates to the original content' },
  { value: 'none', label: 'No Changes', description: 'Repost the exact same content' },
];

export default function ContentRecyclingPage() {
  const [schedules, setSchedules] = useState<RecycleSchedule[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [formData, setFormData] = useState({
    post_id: '',
    recycle_interval_days: 30,
    max_recycles: 0,
    modify_content: true,
    modification_type: 'ai_rewrite'
  });

  const showToast = (message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [schedulesRes, postsRes] = await Promise.all([
        api.get('/v2/recycle-schedules'),
        api.get('/posts?status=published')
      ]);
      setSchedules(schedulesRes.data.schedules || []);
      setPosts(postsRes.data.posts || []);
    } catch (error) {
      console.error('Error loading data:', error);
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.post_id) {
      showToast('Please select a post', 'error');
      return;
    }

    try {
      await api.post('/v2/recycle-schedules', formData);
      showToast('Recycle schedule created successfully', 'success');
      setShowModal(false);
      setFormData({
        post_id: '',
        recycle_interval_days: 30,
        max_recycles: 0,
        modify_content: true,
        modification_type: 'ai_rewrite'
      });
      loadData();
    } catch (error) {
      console.error('Error creating schedule:', error);
      showToast('Failed to create schedule', 'error');
    }
  };

  const handleDelete = async (scheduleId: string) => {
    try {
      await api.delete(`/v2/recycle-schedules/${scheduleId}`);
      showToast('Schedule deleted successfully', 'success');
      setDeleteConfirm(null);
      loadData();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      showToast('Failed to delete schedule', 'error');
    }
  };

  const getModificationLabel = (type: string) => {
    return MODIFICATION_TYPES.find(m => m.value === type)?.label || type;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Not scheduled';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getProgressPercentage = (current: number, max: number) => {
    if (max === 0) return 0; // Unlimited
    return Math.round((current / max) * 100);
  };

  // Filter out posts that already have schedules
  const availablePosts = posts.filter(p => !schedules.some(s => s.post_id === p.id));

  return (
    <div className="page-container">
      {/* Toast notifications */}
      <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: toast.type === 'success' ? '#22c55e' : '#ef4444',
              color: 'white',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              animation: 'slideIn 0.3s ease'
            }}
          >
            {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            {toast.message}
          </div>
        ))}
      </div>

      <div className="page-header">
        <div>
          <h1>
            <Repeat size={32} />
            Content Recycling
          </h1>
          <p>Automatically reshare your best-performing evergreen content</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={18} />
          New Schedule
        </button>
      </div>

      {/* Info Banner */}
      <div style={{
        padding: '16px 20px',
        borderRadius: '10px',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px'
      }}>
        <Sparkles size={24} style={{ color: '#3b82f6', flexShrink: 0, marginTop: '2px' }} />
        <div>
          <h4 style={{ margin: '0 0 4px 0', color: '#3b82f6' }}>Content Recycling</h4>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
            Schedule your best posts to be automatically reshared at regular intervals. 
            Use AI to refresh the content each time while keeping your core message intact.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">Loading schedules...</div>
      ) : schedules.length === 0 ? (
        <div className="empty-state">
          <Repeat size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
          <h3>No Recycling Schedules</h3>
          <p>Set up content recycling to automatically reshare your evergreen posts</p>
          <button
            className="btn btn-primary"
            onClick={() => setShowModal(true)}
            style={{ marginTop: '16px' }}
          >
            Create Your First Schedule
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
          gap: '20px'
        }}>
          {schedules.map(schedule => (
            <div
              key={schedule.id}
              className="card"
              style={{
                backgroundColor: 'var(--card-bg)',
                borderRadius: '12px',
                padding: '20px',
                border: schedule.is_active ? '2px solid rgba(34, 197, 94, 0.3)' : '1px solid var(--color-borderLight)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        backgroundColor: schedule.is_active ? 'rgba(34, 197, 94, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                        color: schedule.is_active ? '#22c55e' : '#6b7280'
                      }}
                    >
                      {schedule.is_active ? <Play size={12} /> : <Pause size={12} />}
                      {schedule.is_active ? 'Active' : 'Paused'}
                    </span>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      backgroundColor: 'rgba(139, 92, 246, 0.2)',
                      color: '#8b5cf6'
                    }}>
                      Every {schedule.recycle_interval_days} days
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setDeleteConfirm(schedule.id)}
                  title="Delete schedule"
                  style={{ padding: '8px', borderRadius: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Post Content Preview */}
              <div style={{
                padding: '14px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-secondary)',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <FileText size={14} style={{ color: 'var(--text-secondary)' }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Original Post</span>
                </div>
                <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5' }}>
                  {schedule.post_content || 'Content not available'}
                </p>
              </div>

              {/* Settings */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div style={{
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-secondary)'
                }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Content Modification
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
                    {schedule.modify_content ? (
                      <>
                        <RefreshCw size={14} style={{ color: '#3b82f6' }} />
                        {getModificationLabel(schedule.modification_type)}
                      </>
                    ) : (
                      'No changes'
                    )}
                  </div>
                </div>
                <div style={{
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-secondary)'
                }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Next Recycle
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', fontSize: '13px' }}>
                    <Calendar size={14} style={{ color: '#10b981' }} />
                    {formatDate(schedule.next_recycle_at)}
                  </div>
                </div>
              </div>

              {/* Progress */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Recycle Progress</span>
                  <span style={{ fontWeight: '600' }}>
                    {schedule.current_recycle_count} / {schedule.max_recycles === 0 ? '∞' : schedule.max_recycles}
                  </span>
                </div>
                {schedule.max_recycles > 0 && (
                  <div style={{ height: '6px', backgroundColor: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${getProgressPercentage(schedule.current_recycle_count, schedule.max_recycles)}%`,
                      height: '100%',
                      backgroundColor: '#10b981',
                      borderRadius: '3px',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Schedule Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h2>Create Recycling Schedule</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                    Select Post *
                  </label>
                  {availablePosts.length === 0 ? (
                    <div style={{
                      padding: '16px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                      color: '#f59e0b',
                      fontSize: '14px'
                    }}>
                      No available posts. All published posts already have recycling schedules.
                    </div>
                  ) : (
                    <select
                      value={formData.post_id}
                      onChange={e => setFormData({ ...formData, post_id: e.target.value })}
                      required
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--input-bg)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      <option value="">Choose a post...</option>
                      {availablePosts.map(post => (
                        <option key={post.id} value={post.id}>
                          {post.content.substring(0, 60)}{post.content.length > 60 ? '...' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                      Recycle Every (days)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={formData.recycle_interval_days}
                      onChange={e => setFormData({ ...formData, recycle_interval_days: parseInt(e.target.value) })}
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--input-bg)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                      Max Recycles (0 = unlimited)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formData.max_recycles}
                      onChange={e => setFormData({ ...formData, max_recycles: parseInt(e.target.value) })}
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--input-bg)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.modify_content}
                      onChange={e => setFormData({ ...formData, modify_content: e.target.checked })}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span style={{ fontWeight: '600' }}>Modify content on each recycle</span>
                  </label>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px', marginLeft: '28px' }}>
                    When enabled, content will be refreshed each time it's recycled
                  </p>
                </div>

                {formData.modify_content && (
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                      Modification Type
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {MODIFICATION_TYPES.filter(m => m.value !== 'none').map(mod => (
                        <label
                          key={mod.value}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '12px',
                            padding: '14px',
                            borderRadius: '10px',
                            backgroundColor: formData.modification_type === mod.value ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-secondary)',
                            border: formData.modification_type === mod.value ? '2px solid #3b82f6' : '2px solid transparent',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <input
                            type="radio"
                            name="modification_type"
                            value={mod.value}
                            checked={formData.modification_type === mod.value}
                            onChange={e => setFormData({ ...formData, modification_type: e.target.value })}
                            style={{ marginTop: '2px' }}
                          />
                          <div>
                            <div style={{ fontWeight: '600', marginBottom: '2px' }}>{mod.label}</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{mod.description}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 20px', borderTop: '1px solid var(--border-color)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={availablePosts.length === 0}>
                  Create Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Delete Schedule</h2>
              <button className="close-btn" onClick={() => setDeleteConfirm(null)}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '16px' }}>
                Are you sure you want to delete this recycling schedule? The original post will not be deleted.
              </p>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 20px', borderTop: '1px solid var(--border-color)' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleDelete(deleteConfirm)}
                style={{ backgroundColor: '#ef4444' }}
              >
                Delete Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
