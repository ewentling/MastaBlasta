import { useState, useEffect } from 'react';
import { api } from '../api';
import { Zap, Plus, Trash2, X, Play, Pause, Clock, Eye, MessageSquare, ThumbsUp, Share2, Bell, CheckCircle, AlertCircle } from 'lucide-react';

interface AutoEngagementRule {
  id: string;
  name: string;
  is_active: boolean;
  trigger_type: string;
  trigger_threshold: number;
  trigger_platform: string | null;
  action_type: string;
  action_content: string | null;
  times_triggered: number;
  last_triggered_at: string | null;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

const TRIGGER_TYPES = [
  { value: 'likes', label: 'Likes Threshold', icon: ThumbsUp, description: 'When a post reaches X likes' },
  { value: 'comments', label: 'Comments Threshold', icon: MessageSquare, description: 'When a post reaches X comments' },
  { value: 'shares', label: 'Shares Threshold', icon: Share2, description: 'When a post reaches X shares' },
  { value: 'views', label: 'Views Threshold', icon: Eye, description: 'When a post reaches X views' },
];

const ACTION_TYPES = [
  { value: 'notify', label: 'Send Notification', description: 'Send an in-app notification' },
  { value: 'comment', label: 'Auto-Comment', description: 'Automatically post a comment' },
  { value: 'repost', label: 'Repost', description: 'Schedule the post for resharing' },
  { value: 'like', label: 'Auto-Like', description: 'Automatically like related content' },
];

const PLATFORMS = ['all', 'twitter', 'facebook', 'instagram', 'linkedin', 'threads', 'bluesky'];

export default function AutoEngagementPage() {
  const [rules, setRules] = useState<AutoEngagementRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    trigger_type: 'likes',
    trigger_threshold: 100,
    trigger_platform: 'all',
    action_type: 'notify',
    action_content: ''
  });

  const showToast = (message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      setLoading(true);
      const response = await api.get('/v2/auto-engagements');
      setRules(response.data.rules || []);
    } catch (error) {
      console.error('Error loading auto-engagement rules:', error);
      showToast('Failed to load rules', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        trigger_type: formData.trigger_type,
        trigger_threshold: formData.trigger_threshold,
        trigger_platform: formData.trigger_platform === 'all' ? null : formData.trigger_platform,
        action_type: formData.action_type,
        action_content: formData.action_content || null
      };

      await api.post('/v2/auto-engagements', payload);
      showToast('Rule created successfully', 'success');
      setShowModal(false);
      setFormData({
        name: '',
        trigger_type: 'likes',
        trigger_threshold: 100,
        trigger_platform: 'all',
        action_type: 'notify',
        action_content: ''
      });
      loadRules();
    } catch (error) {
      console.error('Error creating rule:', error);
      showToast('Failed to create rule', 'error');
    }
  };

  const handleDelete = async (ruleId: string) => {
    try {
      await api.delete(`/v2/auto-engagements/${ruleId}`);
      showToast('Rule deleted successfully', 'success');
      setDeleteConfirm(null);
      loadRules();
    } catch (error) {
      console.error('Error deleting rule:', error);
      showToast('Failed to delete rule', 'error');
    }
  };

  const getTriggerIcon = (triggerType: string) => {
    const trigger = TRIGGER_TYPES.find(t => t.value === triggerType);
    if (trigger) {
      const Icon = trigger.icon;
      return <Icon size={16} />;
    }
    return <Zap size={16} />;
  };

  const getTriggerLabel = (triggerType: string) => {
    const trigger = TRIGGER_TYPES.find(t => t.value === triggerType);
    return trigger?.label || triggerType;
  };

  const getActionLabel = (actionType: string) => {
    const action = ACTION_TYPES.find(a => a.value === actionType);
    return action?.label || actionType;
  };

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
            <Zap size={32} />
            Auto-Engagement Rules
          </h1>
          <p>Set up automated responses based on post performance</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={18} />
          Create Rule
        </button>
      </div>

      {loading ? (
        <div className="loading-state">Loading rules...</div>
      ) : rules.length === 0 ? (
        <div className="empty-state">
          <Zap size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
          <h3>No Auto-Engagement Rules</h3>
          <p>Create rules to automatically respond when your posts reach certain milestones</p>
          <button
            className="btn btn-primary"
            onClick={() => setShowModal(true)}
            style={{ marginTop: '16px' }}
          >
            Create Your First Rule
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
          gap: '20px'
        }}>
          {rules.map(rule => (
            <div
              key={rule.id}
              className="card"
              style={{
                backgroundColor: 'var(--card-bg)',
                borderRadius: '12px',
                padding: '20px',
                border: rule.is_active ? '2px solid rgba(34, 197, 94, 0.3)' : '1px solid var(--color-borderLight)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px' }}>{rule.name}</h3>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        backgroundColor: rule.is_active ? 'rgba(34, 197, 94, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                        color: rule.is_active ? '#22c55e' : '#6b7280'
                      }}
                    >
                      {rule.is_active ? <Play size={12} /> : <Pause size={12} />}
                      {rule.is_active ? 'Active' : 'Paused'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setDeleteConfirm(rule.id)}
                  title="Delete rule"
                  style={{ padding: '8px', borderRadius: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Trigger */}
              <div style={{ 
                padding: '12px', 
                borderRadius: '8px', 
                backgroundColor: 'var(--bg-secondary)', 
                marginBottom: '12px' 
              }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>WHEN</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {getTriggerIcon(rule.trigger_type)}
                  <span style={{ fontWeight: '600' }}>
                    {getTriggerLabel(rule.trigger_type)} reaches {rule.trigger_threshold}
                    {rule.trigger_type === 'engagement_rate' ? '%' : ''}
                    {rule.trigger_type === 'time_since_post' ? ' hours' : ''}
                  </span>
                </div>
                {rule.trigger_platform && (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Platform: {rule.trigger_platform}
                  </div>
                )}
              </div>

              {/* Action */}
              <div style={{ 
                padding: '12px', 
                borderRadius: '8px', 
                backgroundColor: 'rgba(59, 130, 246, 0.1)', 
                marginBottom: '12px' 
              }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>THEN</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bell size={16} style={{ color: '#3b82f6' }} />
                  <span style={{ fontWeight: '600', color: '#3b82f6' }}>
                    {getActionLabel(rule.action_type)}
                  </span>
                </div>
                {rule.action_content && (
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', fontStyle: 'italic' }}>
                    "{rule.action_content}"
                  </div>
                )}
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Target size={14} />
                  Triggered {rule.times_triggered} times
                </div>
                {rule.last_triggered_at && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={14} />
                    Last: {new Date(rule.last_triggered_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Rule Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h2>Create Auto-Engagement Rule</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                    Rule Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Notify on viral posts"
                    required
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

                <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: 'var(--bg-secondary)', marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Zap size={18} /> Trigger Condition
                  </h4>

                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                      Trigger Type
                    </label>
                    <select
                      value={formData.trigger_type}
                      onChange={e => setFormData({ ...formData, trigger_type: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--input-bg)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      {TRIGGER_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                      {TRIGGER_TYPES.find(t => t.value === formData.trigger_type)?.description}
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                        Threshold
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={formData.trigger_threshold}
                        onChange={e => setFormData({ ...formData, trigger_threshold: parseInt(e.target.value) })}
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
                        Platform
                      </label>
                      <select
                        value={formData.trigger_platform}
                        onChange={e => setFormData({ ...formData, trigger_platform: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--input-bg)',
                          color: 'var(--text-primary)'
                        }}
                      >
                        {PLATFORMS.map(p => (
                          <option key={p} value={p}>{p === 'all' ? 'All Platforms' : p.charAt(0).toUpperCase() + p.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: 'rgba(59, 130, 246, 0.1)', marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#3b82f6' }}>
                    <Bell size={18} /> Action
                  </h4>

                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                      Action Type
                    </label>
                    <select
                      value={formData.action_type}
                      onChange={e => setFormData({ ...formData, action_type: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--input-bg)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      {ACTION_TYPES.map(a => (
                        <option key={a.value} value={a.value}>{a.label}</option>
                      ))}
                    </select>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                      {ACTION_TYPES.find(a => a.value === formData.action_type)?.description}
                    </p>
                  </div>

                  {(formData.action_type === 'auto_reply' || formData.action_type === 'thank_followers') && (
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                        Message Content
                      </label>
                      <textarea
                        value={formData.action_content}
                        onChange={e => setFormData({ ...formData, action_content: e.target.value })}
                        placeholder="Enter the message to send..."
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          resize: 'vertical'
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 20px', borderTop: '1px solid var(--border-color)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Rule
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
              <h2>Delete Rule</h2>
              <button className="close-btn" onClick={() => setDeleteConfirm(null)}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '16px' }}>
                Are you sure you want to delete this auto-engagement rule? This action cannot be undone.
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
                Delete Rule
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
