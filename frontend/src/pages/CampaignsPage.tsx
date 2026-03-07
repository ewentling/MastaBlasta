import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Briefcase, Plus, Calendar, Target, Tag, Edit2, Trash2, ChevronRight, X, Eye, AlertCircle, CheckCircle } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  goals: Record<string, unknown> | null;
  tags: string[] | null;
  color: string | null;
  post_count: number;
  created_at: string | null;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

export default function CampaignsPage() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active',
    start_date: '',
    end_date: '',
    color: '#3b82f6',
    tags: ''
  });

  const showToast = (message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/v2/campaigns');
      setCampaigns(response.data.campaigns || []);
    } catch (error) {
      console.error('Error loading campaigns:', error);
      showToast('Failed to load campaigns', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        status: formData.status,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        color: formData.color,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : null
      };

      if (editingCampaign) {
        await api.put(`/api/v2/campaigns/${editingCampaign.id}`, payload);
        showToast('Campaign updated successfully', 'success');
      } else {
        await api.post('/api/v2/campaigns', payload);
        showToast('Campaign created successfully', 'success');
      }

      setShowModal(false);
      setEditingCampaign(null);
      setFormData({
        name: '',
        description: '',
        status: 'active',
        start_date: '',
        end_date: '',
        color: '#3b82f6',
        tags: ''
      });
      loadCampaigns();
    } catch (error) {
      console.error('Error saving campaign:', error);
      showToast('Failed to save campaign', 'error');
    }
  };

  const handleDelete = async (campaignId: string) => {
    try {
      await api.delete(`/api/v2/campaigns/${campaignId}`);
      showToast('Campaign deleted successfully', 'success');
      setDeleteConfirm(null);
      loadCampaigns();
    } catch (error) {
      console.error('Error deleting campaign:', error);
      showToast('Failed to delete campaign', 'error');
    }
  };

  const openEditModal = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setFormData({
      name: campaign.name,
      description: campaign.description || '',
      status: campaign.status,
      start_date: campaign.start_date?.split('T')[0] || '',
      end_date: campaign.end_date?.split('T')[0] || '',
      color: campaign.color || '#3b82f6',
      tags: campaign.tags?.join(', ') || ''
    });
    setShowModal(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#22c55e';
      case 'paused': return '#f59e0b';
      case 'completed': return '#6366f1';
      case 'draft': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getCampaignProgress = (campaign: Campaign): number => {
    if (!campaign.start_date || !campaign.end_date) return 0;
    const start = new Date(campaign.start_date).getTime();
    const end = new Date(campaign.end_date).getTime();
    const now = Date.now();
    if (now < start) return 0;
    if (now > end) return 100;
    return Math.round(((now - start) / (end - start)) * 100);
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
            <Briefcase size={32} />
            Campaigns
          </h1>
          <p>Organize your posts into campaigns for better tracking</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingCampaign(null);
            setFormData({
              name: '',
              description: '',
              status: 'active',
              start_date: '',
              end_date: '',
              color: '#3b82f6',
              tags: ''
            });
            setShowModal(true);
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={18} />
          New Campaign
        </button>
      </div>

      {loading ? (
        <div className="loading-state">Loading campaigns...</div>
      ) : campaigns.length === 0 ? (
        <div className="empty-state">
          <Briefcase size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
          <h3>No Campaigns Yet</h3>
          <p>Create your first campaign to organize related posts together</p>
          <button
            className="btn btn-primary"
            onClick={() => setShowModal(true)}
            style={{ marginTop: '16px' }}
          >
            Create Campaign
          </button>
        </div>
      ) : (
        <div className="campaigns-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '20px'
        }}>
          {campaigns.map(campaign => (
            <div
              key={campaign.id}
              className="campaign-card"
              style={{
                backgroundColor: 'var(--card-bg)',
                borderRadius: '12px',
                padding: '20px',
                border: `2px solid ${campaign.color || '#3b82f6'}40`,
                borderLeft: `4px solid ${campaign.color || '#3b82f6'}`
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>{campaign.name}</h3>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor: `${getStatusColor(campaign.status)}20`,
                      color: getStatusColor(campaign.status)
                    }}
                  >
                    {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => openEditModal(campaign)}
                    className="icon-button"
                    title="Edit"
                    style={{ padding: '8px', borderRadius: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(campaign.id)}
                    className="icon-button"
                    title="Delete"
                    style={{ padding: '8px', borderRadius: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {campaign.description && (
                <p style={{ margin: '12px 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
                  {campaign.description}
                </p>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '16px' }}>
                {(campaign.start_date || campaign.end_date) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <Calendar size={14} />
                    {campaign.start_date?.split('T')[0]} - {campaign.end_date?.split('T')[0] || 'Ongoing'}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <Target size={14} />
                  {campaign.post_count} posts
                </div>
              </div>

              {/* Progress bar for campaigns with dates */}
              {campaign.start_date && campaign.end_date && campaign.status === 'active' && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    <span>Progress</span>
                    <span>{getCampaignProgress(campaign)}%</span>
                  </div>
                  <div style={{ height: '6px', backgroundColor: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${getCampaignProgress(campaign)}%`,
                      height: '100%',
                      backgroundColor: campaign.color || '#3b82f6',
                      borderRadius: '3px',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              )}

              {campaign.tags && campaign.tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
                  {campaign.tags.map((tag, i) => (
                    <span
                      key={i}
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      <Tag size={10} style={{ marginRight: '4px', display: 'inline' }} />
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* View Posts button */}
              {campaign.post_count > 0 && (
                <button
                  onClick={() => navigate(`/scheduled?campaign=${campaign.id}`)}
                  className="btn btn-secondary"
                  style={{ marginTop: '16px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Eye size={16} />
                  View {campaign.post_count} Post{campaign.post_count !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Delete Campaign</h2>
              <button className="close-btn" onClick={() => setDeleteConfirm(null)}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '16px' }}>
                Are you sure you want to delete this campaign? Posts in this campaign will not be deleted, but they will no longer be associated with this campaign.
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
                Delete Campaign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>{editingCampaign ? 'Edit Campaign' : 'Create Campaign'}</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>
                    Campaign Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Summer Sale 2024"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--input-bg)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Campaign goals and details..."
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--input-bg)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>
                      End Date
                    </label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--input-bg)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--input-bg)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>
                      Color
                    </label>
                    <input
                      type="color"
                      value={formData.color}
                      onChange={e => setFormData({ ...formData, color: e.target.value })}
                      style={{
                        width: '100%',
                        height: '42px',
                        padding: '4px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--input-bg)',
                        cursor: 'pointer'
                      }}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={e => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="e.g., sale, summer, promotion"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--input-bg)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 20px', borderTop: '1px solid var(--border-color)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingCampaign ? 'Save Changes' : 'Create Campaign'}
                </button>
              </div>
            </form>
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
