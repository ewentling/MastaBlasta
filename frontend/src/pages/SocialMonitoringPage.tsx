import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tantml:invoke name="@tanstack/react-query';
import { socialMonitorsApi } from '../api';
import { Plus, Trash2, Eye, RefreshCw, TrendingUp, MessageCircle, ThumbsUp, Share2, MessageSquare, BarChart3, Power, PowerOff } from 'lucide-react';
import axios from 'axios';

export default function SocialMonitoringPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [viewingMonitor, setViewingMonitor] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'monitors' | 'templates' | 'interactions' | 'stats'>('monitors');
  const [templates, setTemplates] = useState<any[]>([]);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  const [selectedMonitors, setSelectedMonitors] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const { data: monitorsData, isLoading } = useQuery({
    queryKey: ['social-monitors'],
    queryFn: () => socialMonitorsApi.getAll(),
  });

  useEffect(() => {
    if (activeTab === 'templates') {
      loadTemplates();
    } else if (activeTab === 'interactions') {
      loadInteractions();
    } else if (activeTab === 'stats') {
      loadStats();
    }
  }, [activeTab]);

  const loadTemplates = async () => {
    try {
      const response = await axios.get('/api/response-templates');
      setTemplates(response.data);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const loadInteractions = async () => {
    try {
      const response = await axios.get('/api/chatbot/interactions?per_page=50');
      setInteractions(response.data.interactions || []);
    } catch (error) {
      console.error('Error loading interactions:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await axios.get('/api/chatbot/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const createMutation = useMutation({
    mutationFn: socialMonitorsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-monitors'] });
      setShowModal(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: socialMonitorsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-monitors'] });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: socialMonitorsApi.refresh,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-monitors'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const response = await axios.put(`/api/social-monitors/${id}`, { active });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-monitors'] });
    },
  });

  const monitors = monitorsData?.monitors || [];

  const toggleSelectMonitor = (id: string) => {
    const newSelected = new Set(selectedMonitors);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedMonitors(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedMonitors.size === monitors.length) {
      setSelectedMonitors(new Set());
    } else {
      setSelectedMonitors(new Set(monitors.map((m: any) => m.id)));
    }
  };

  const handleBulkAction = async (action: 'activate' | 'deactivate' | 'delete') => {
    if (selectedMonitors.size === 0) return;

    const confirmMessage =
      action === 'delete'
        ? `Delete ${selectedMonitors.size} monitor(s)?`
        : `${action === 'activate' ? 'Activate' : 'Deactivate'} ${selectedMonitors.size} monitor(s)?`;

    if (!confirm(confirmMessage)) return;

    setBulkActionLoading(true);

    try {
      const promises = Array.from(selectedMonitors).map(async (id) => {
        if (action === 'delete') {
          return deleteMutation.mutateAsync(id);
        } else {
          return toggleMutation.mutateAsync({ id, active: action === 'activate' });
        }
      });

      await Promise.all(promises);
      setSelectedMonitors(new Set());
    } catch (error) {
      console.error('Bulk action failed:', error);
    } finally {
      setBulkActionLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Social Listening & Monitoring</h2>
        <p>Track brand mentions, keywords, automated responses, and interactions</p>
      </div>

      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem',
        marginBottom: '1.5rem',
        borderBottom: '2px solid var(--color-borderLight)',
      }}>
        <button
          onClick={() => setActiveTab('monitors')}
          style={{
            padding: '0.75rem 1.5rem',
            background: activeTab === 'monitors' ? 'var(--color-bgTertiary)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'monitors' ? '2px solid var(--color-accentPrimary)' : 'none',
            color: activeTab === 'monitors' ? 'var(--color-textPrimary)' : 'var(--color-textSecondary)',
            fontWeight: activeTab === 'monitors' ? '600' : 'normal',
            cursor: 'pointer',
            marginBottom: '-2px',
          }}
        >
          Monitors
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          style={{
            padding: '0.75rem 1.5rem',
            background: activeTab === 'templates' ? 'var(--color-bgTertiary)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'templates' ? '2px solid var(--color-accentPrimary)' : 'none',
            color: activeTab === 'templates' ? 'var(--color-textPrimary)' : 'var(--color-textSecondary)',
            fontWeight: activeTab === 'templates' ? '600' : 'normal',
            cursor: 'pointer',
            marginBottom: '-2px',
          }}
        >
          Templates
        </button>
        <button
          onClick={() => setActiveTab('interactions')}
          style={{
            padding: '0.75rem 1.5rem',
            background: activeTab === 'interactions' ? 'var(--color-bgTertiary)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'interactions' ? '2px solid var(--color-accentPrimary)' : 'none',
            color: activeTab === 'interactions' ? 'var(--color-textPrimary)' : 'var(--color-textSecondary)',
            fontWeight: activeTab === 'interactions' ? '600' : 'normal',
            cursor: 'pointer',
            marginBottom: '-2px',
          }}
        >
          Interactions
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          style={{
            padding: '0.75rem 1.5rem',
            background: activeTab === 'stats' ? 'var(--color-bgTertiary)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'stats' ? '2px solid var(--color-accentPrimary)' : 'none',
            color: activeTab === 'stats' ? 'var(--color-textPrimary)' : 'var(--color-textSecondary)',
            fontWeight: activeTab === 'stats' ? '600' : 'normal',
            cursor: 'pointer',
            marginBottom: '-2px',
          }}
        >
          Statistics
        </button>
      </div>

      {activeTab === 'monitors' && (
        <div className="card">
          <div className="card-header">
            <h3>Active Monitors</h3>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {selectedMonitors.size > 0 && (
                <>
                  <span style={{ fontSize: '0.875rem', color: 'var(--color-textSecondary)', marginRight: '0.5rem' }}>
                    {selectedMonitors.size} selected
                  </span>
                  <button
                    className="btn btn-success btn-small"
                    onClick={() => handleBulkAction('activate')}
                    disabled={bulkActionLoading}
                  >
                    <Power size={16} />
                    Activate
                  </button>
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => handleBulkAction('deactivate')}
                    disabled={bulkActionLoading}
                  >
                    <PowerOff size={16} />
                    Deactivate
                  </button>
                  <button
                    className="btn btn-error btn-small"
                    onClick={() => handleBulkAction('delete')}
                    disabled={bulkActionLoading}
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </>
              )}
              <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                <Plus size={18} />
                New Monitor
              </button>
            </div>
          </div>

        {isLoading ? (
          <div className="loading">Loading monitors...</div>
        ) : monitors.length === 0 ? (
          <div className="empty-state">
            <TrendingUp size={48} />
            <h3>No monitors yet</h3>
            <p>Create your first monitor to track social media conversations</p>
          </div>
        ) : (
          <>
            {monitors.length > 0 && (
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--color-borderLight)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedMonitors.size === monitors.length}
                    onChange={toggleSelectAll}
                    style={{ width: '1rem', height: '1rem' }}
                  />
                  <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>Select All</span>
                </label>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {monitors.map((monitor: any) => (
                <div
                  key={monitor.id}
                  style={{
                    padding: '1.25rem',
                    border: '1px solid var(--color-borderLight)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-bgSecondary)',
                  }}
                >
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div>
                      <input
                        type="checkbox"
                        checked={selectedMonitors.has(monitor.id)}
                        onChange={() => toggleSelectMonitor(monitor.id)}
                        style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <div style={{ fontWeight: '700', fontSize: '1.125rem', color: 'var(--color-textPrimary)' }}>
                            {monitor.name}
                          </div>
                          {monitor.active ? (
                            <span className="badge badge-success">Active</span>
                          ) : (
                            <span className="badge badge-error">Inactive</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                          {monitor.keywords.map((keyword: string) => (
                            <span key={keyword} className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                              {keyword}
                            </span>
                          ))}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--color-textTertiary)' }}>
                          Platforms: {monitor.platforms.join(', ')} • {monitor.result_count} results
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          className={`btn ${monitor.active ? 'btn-secondary' : 'btn-primary'} btn-small`}
                          onClick={() => toggleMutation.mutate({ id: monitor.id, active: !monitor.active })}
                          disabled={toggleMutation.isPending}
                        >
                          {monitor.active ? <PowerOff size={16} /> : <Power size={16} />}
                          {monitor.active ? 'Deactivate' : 'Activate'}
                        </button>
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => setViewingMonitor(monitor.id)}
                  >
                    <Eye size={16} />
                    View Results
                  </button>
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => refreshMutation.mutate(monitor.id)}
                    disabled={refreshMutation.isPending}
                  >
                    <RefreshCw size={16} />
                    Refresh
                  </button>
                  <button
                    className="btn btn-danger btn-small"
                    onClick={() => {
                      if (confirm(`Delete monitor "${monitor.name}"?`)) {
                        deleteMutation.mutate(monitor.id);
                      }
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="card">
          <div className="card-header">
            <h3>Response Templates</h3>
            <button className="btn btn-primary" onClick={() => setShowCreateTemplateModal(true)}>
              <Plus size={18} />
              Create Template
            </button>
          </div>
          {templates.length === 0 ? (
            <div className="empty-state">
              <MessageSquare size={48} />
              <h3>No templates yet</h3>
              <p>Create response templates to automate customer service</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
              {templates.map((template: any) => (
                <div
                  key={template.id}
                  style={{
                    padding: '1rem',
                    border: '1px solid var(--color-borderLight)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-bgSecondary)',
                  }}
                >
                  <div style={{ fontWeight: '600', marginBottom: '0.5rem', color: 'var(--color-textPrimary)' }}>
                    {template.name}
                  </div>
                  <div style={{ marginBottom: '0.5rem', color: 'var(--color-textSecondary)', fontSize: '0.875rem' }}>
                    {template.template}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span className="badge badge-info">{template.category}</span>
                    {template.auto_reply && <span className="badge badge-success">Auto-Reply</span>}
                    {template.platforms.map((platform: string) => (
                      <span key={platform} className="badge badge-secondary">{platform}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Interactions Tab */}
      {activeTab === 'interactions' && (
        <div className="card">
          <div className="card-header">
            <h3>Recent Interactions</h3>
          </div>
          {interactions.length === 0 ? (
            <div className="empty-state">
              <MessageCircle size={48} />
              <h3>No interactions yet</h3>
              <p>Interactions will appear here once your monitors are active</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
              {interactions.map((interaction: any) => (
                <div
                  key={interaction.id}
                  style={{
                    padding: '1rem',
                    border: '1px solid var(--color-borderLight)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-bgSecondary)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: '600', color: 'var(--color-textPrimary)' }}>
                      @{interaction.user} on {interaction.platform}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-textTertiary)' }}>
                      {new Date(interaction.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ marginBottom: '0.5rem', color: 'var(--color-textSecondary)' }}>
                    <strong>Message:</strong> {interaction.message}
                  </div>
                  <div style={{ color: 'var(--color-textSecondary)' }}>
                    <strong>Response:</strong> {interaction.response}
                  </div>
                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                    {interaction.auto_replied && <span className="badge badge-success">Auto-Replied</span>}
                    <span className={`badge ${interaction.sentiment === 'positive' ? 'badge-success' : interaction.sentiment === 'negative' ? 'badge-error' : 'badge-info'}`}>
                      {interaction.sentiment}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Statistics Tab */}
      {activeTab === 'stats' && (
        <div className="card">
          <div className="card-header">
            <h3>Response Statistics</h3>
          </div>
          {!stats ? (
            <div className="loading">Loading statistics...</div>
          ) : (
            <div style={{ padding: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ padding: '1rem', border: '1px solid var(--color-borderLight)', borderRadius: '8px', backgroundColor: 'var(--color-bgTertiary)' }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-textSecondary)', marginBottom: '0.5rem' }}>Total Interactions</div>
                  <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--color-textPrimary)' }}>{stats.total_interactions}</div>
                </div>
                <div style={{ padding: '1rem', border: '1px solid var(--color-borderLight)', borderRadius: '8px', backgroundColor: 'var(--color-bgTertiary)' }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-textSecondary)', marginBottom: '0.5rem' }}>Auto Replies</div>
                  <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--color-textPrimary)' }}>{stats.auto_replies}</div>
                </div>
                <div style={{ padding: '1rem', border: '1px solid var(--color-borderLight)', borderRadius: '8px', backgroundColor: 'var(--color-bgTertiary)' }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-textSecondary)', marginBottom: '0.5rem' }}>Auto-Reply Rate</div>
                  <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--color-textPrimary)' }}>{stats.auto_reply_rate}%</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
                <div>
                  <h4 style={{ marginBottom: '1rem', color: 'var(--color-textPrimary)' }}>Platform Breakdown</h4>
                  {Object.entries(stats.platform_breakdown || {}).map(([platform, count]: [string, any]) => (
                    <div key={platform} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', marginBottom: '0.5rem', borderRadius: '4px', backgroundColor: 'var(--color-bgSecondary)' }}>
                      <span style={{ color: 'var(--color-textPrimary)', textTransform: 'capitalize' }}>{platform}</span>
                      <span style={{ fontWeight: '600', color: 'var(--color-textPrimary)' }}>{count}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <h4 style={{ marginBottom: '1rem', color: 'var(--color-textPrimary)' }}>Sentiment Breakdown</h4>
                  {Object.entries(stats.sentiment_breakdown || {}).map(([sentiment, count]: [string, any]) => (
                    <div key={sentiment} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', marginBottom: '0.5rem', borderRadius: '4px', backgroundColor: 'var(--color-bgSecondary)' }}>
                      <span style={{ color: 'var(--color-textPrimary)', textTransform: 'capitalize' }}>{sentiment}</span>
                      <span style={{ fontWeight: '600', color: 'var(--color-textPrimary)' }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <CreateMonitorModal
          onClose={() => setShowModal(false)}
          onSave={(data) => createMutation.mutate(data)}
        />
      )}

      {viewingMonitor && (
        <MonitorResultsModal
          monitorId={viewingMonitor}
          onClose={() => setViewingMonitor(null)}
        />
      )}
    </div>
  );
}

function CreateMonitorModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: any) => void;
}) {
  const [name, setName] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [enableAutoReply, setEnableAutoReply] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');

  const platforms = ['twitter', 'facebook', 'instagram', 'linkedin'];

  const addKeyword = () => {
    if (keywordInput.trim() && !keywords.includes(keywordInput.trim())) {
      setKeywords([...keywords, keywordInput.trim()]);
      setKeywordInput('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setKeywords(keywords.filter(k => k !== keyword));
  };

  const togglePlatform = (platform: string) => {
    if (selectedPlatforms.includes(platform)) {
      setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
    } else {
      setSelectedPlatforms([...selectedPlatforms, platform]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      keywords,
      platforms: selectedPlatforms,
      auto_reply_enabled: enableAutoReply,
      auto_reply_message: enableAutoReply ? replyMessage : undefined,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Create Monitor</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Monitor Name *</label>
              <input
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Brand Mentions, Competitor Tracking, etc."
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Keywords *</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  className="form-input"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addKeyword();
                    }
                  }}
                  placeholder="Enter keyword and press Enter"
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={addKeyword}
                  style={{ minWidth: 'auto' }}
                >
                  <Plus size={18} />
                </button>
              </div>
              {keywords.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                  {keywords.map(keyword => (
                    <span
                      key={keyword}
                      className="badge badge-info"
                      style={{
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                      onClick={() => removeKeyword(keyword)}
                    >
                      {keyword} ×
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Platforms *</label>
              <div className="checkbox-group">
                {platforms.map(platform => (
                  <label key={platform} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedPlatforms.includes(platform)}
                      onChange={() => togglePlatform(platform)}
                    />
                    <span>{platform.charAt(0).toUpperCase() + platform.slice(1)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="checkbox-label" style={{ marginBottom: '1rem' }}>
                <input
                  type="checkbox"
                  checked={enableAutoReply}
                  onChange={(e) => setEnableAutoReply(e.target.checked)}
                />
                <span>Enable Auto-Reply</span>
              </label>
              {enableAutoReply && (
                <div>
                  <label className="form-label">Reply Message *</label>
                  <textarea
                    className="form-textarea"
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Enter your automatic reply message..."
                    required={enableAutoReply}
                    style={{ minHeight: '100px' }}
                  />
                  <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--color-textSecondary)' }}>
                    This message will be automatically sent as a reply to comments matching your keywords.
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={keywords.length === 0 || selectedPlatforms.length === 0}
            >
              <Plus size={18} />
              Create Monitor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MonitorResultsModal({
  monitorId,
  onClose,
}: {
  monitorId: string;
  onClose: () => void;
}) {
  const [sentimentFilter, setSentimentFilter] = useState<string>('');
  const [platformFilter, setPlatformFilter] = useState<string>('');

  const { data: resultsData, isLoading } = useQuery({
    queryKey: ['monitor-results', monitorId, sentimentFilter, platformFilter],
    queryFn: () => socialMonitorsApi.getResults(monitorId, {
      sentiment: sentimentFilter || undefined,
      platform: platformFilter || undefined,
    }),
  });

  const results = resultsData?.results || [];

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return '#48bb78';
      case 'negative':
        return '#f56565';
      default:
        return 'var(--color-textSecondary)';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh' }}>
        <div className="modal-header">
          <h3>Monitor Results</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">Sentiment</label>
              <select
                className="form-select"
                value={sentimentFilter}
                onChange={(e) => setSentimentFilter(e.target.value)}
              >
                <option value="">All</option>
                <option value="positive">Positive</option>
                <option value="neutral">Neutral</option>
                <option value="negative">Negative</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="form-label">Platform</label>
              <select
                className="form-select"
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
              >
                <option value="">All</option>
                <option value="twitter">Twitter</option>
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
                <option value="linkedin">LinkedIn</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="loading">Loading results...</div>
          ) : results.length === 0 ? (
            <div className="empty-state">
              <MessageCircle size={48} />
              <h3>No results found</h3>
              <p>Try adjusting your filters or refresh the monitor</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {results.map((result: any) => (
                <div
                  key={result.id}
                  style={{
                    padding: '1rem',
                    border: '1px solid var(--color-borderLight)',
                    borderRadius: '8px',
                    backgroundColor: result.read ? 'var(--color-bgTertiary)' : 'var(--color-bgSecondary)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ fontWeight: '600', color: 'var(--color-textPrimary)' }}>
                        {result.author}
                      </span>
                      <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                        {result.platform}
                      </span>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: getSentimentColor(result.sentiment),
                          fontWeight: '600'
                        }}
                      >
                        {result.sentiment}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-textTertiary)' }}>
                      {new Date(result.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <p style={{ margin: '0.5rem 0', fontSize: '0.875rem', color: 'var(--color-textPrimary)' }}>
                    {result.content}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--color-textTertiary)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <ThumbsUp size={14} /> {result.engagement.likes}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Share2 size={14} /> {result.engagement.shares}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <MessageCircle size={14} /> {result.engagement.comments}
                      </span>
                    </div>
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-small"
                      style={{ fontSize: '0.75rem' }}
                    >
                      View Post
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
