import { useState, useEffect } from 'react';
import { api } from '../api';
import { Briefcase, Plus, Calendar, Target, Tag, Edit2, Trash2, ChevronRight, X } from 'lucide-react';

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

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active',
    start_date: '',
    end_date: '',
    color: '#3b82f6',
    tags: ''
  });

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
      } else {
        await api.post('/api/v2/campaigns', payload);
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
      alert('Failed to save campaign');
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

  return (
    <div className="page-container">
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
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => openEditModal(campaign)}
                    className="icon-button"
                    title="Edit"
                    style={{ padding: '8px', borderRadius: '8px', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <Edit2 size={16} />
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
            </div>
          ))}
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
    </div>
  );
}
