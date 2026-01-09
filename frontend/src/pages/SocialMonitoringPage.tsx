import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { socialMonitorsApi } from '../api';
import { Plus, Trash2, Eye, RefreshCw, TrendingUp, MessageCircle, ThumbsUp, Share2 } from 'lucide-react';

export default function SocialMonitoringPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [viewingMonitor, setViewingMonitor] = useState<string | null>(null);

  const { data: monitorsData, isLoading } = useQuery({
    queryKey: ['social-monitors'],
    queryFn: () => socialMonitorsApi.getAll(),
  });

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

  const monitors = monitorsData?.monitors || [];

  return (
    <div>
      <div className="page-header">
        <h2>Social Listening & Monitoring</h2>
        <p>Track brand mentions, keywords, and competitor activity</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Active Monitors</h3>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} />
            New Monitor
          </button>
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
                <div style={{ display: 'flex', gap: '0.5rem' }}>
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
