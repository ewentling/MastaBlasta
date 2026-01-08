import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { urlsApi } from '../api';
import { Plus, Trash2, BarChart2, Copy, ExternalLink, Check } from 'lucide-react';

export default function URLShortenerPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [statsModal, setStatsModal] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const { data: urlsData, isLoading } = useQuery({
    queryKey: ['shortened-urls'],
    queryFn: () => urlsApi.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: urlsApi.shorten,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shortened-urls'] });
      setShowModal(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: urlsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shortened-urls'] });
    },
  });

  const urls = urlsData?.urls || [];

  const copyToClipboard = (shortUrl: string, code: string) => {
    navigator.clipboard.writeText(shortUrl);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div>
      <div className="page-header">
        <h2>URL Shortener & Tracking</h2>
        <p>Shorten URLs with click tracking and UTM parameters</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Shortened URLs</h3>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} />
            Shorten URL
          </button>
        </div>

        {isLoading ? (
          <div className="loading">Loading URLs...</div>
        ) : urls.length === 0 ? (
          <div className="empty-state">
            <ExternalLink size={48} />
            <h3>No shortened URLs yet</h3>
            <p>Create your first shortened URL to start tracking clicks</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {urls.map((url: any) => (
              <div
                key={url.id}
                style={{
                  padding: '1.25rem',
                  border: '1px solid var(--color-borderLight)',
                  borderRadius: '8px',
                  backgroundColor: 'var(--color-bgSecondary)',
                }}
              >
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <code style={{ 
                      fontWeight: '700', 
                      fontSize: '1rem', 
                      color: 'var(--color-accentPrimary)',
                      backgroundColor: 'var(--color-bgTertiary)',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px'
                    }}>
                      /u/{url.short_code}
                    </code>
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => copyToClipboard(`${window.location.origin}/u/${url.short_code}`, url.short_code)}
                      style={{ padding: '0.25rem 0.5rem' }}
                    >
                      {copiedCode === url.short_code ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                  <div style={{ color: 'var(--color-textSecondary)', fontSize: '0.875rem', wordBreak: 'break-all' }}>
                    → {url.original_url}
                  </div>
                  {(url.utm_source || url.utm_medium || url.utm_campaign) && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {url.utm_source && (
                        <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                          source: {url.utm_source}
                        </span>
                      )}
                      {url.utm_medium && (
                        <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                          medium: {url.utm_medium}
                        </span>
                      )}
                      {url.utm_campaign && (
                        <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                          campaign: {url.utm_campaign}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-textTertiary)' }}>
                    {url.clicks} clicks
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => setStatsModal(url.short_code)}
                    >
                      <BarChart2 size={16} />
                      Stats
                    </button>
                    <button
                      className="btn btn-danger btn-small"
                      onClick={() => {
                        if (confirm(`Delete shortened URL /${url.short_code}?`)) {
                          deleteMutation.mutate(url.short_code);
                        }
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <ShortenURLModal
          onClose={() => setShowModal(false)}
          onSave={(data) => createMutation.mutate(data)}
        />
      )}

      {statsModal && (
        <StatsModal
          shortCode={statsModal}
          onClose={() => setStatsModal(null)}
        />
      )}
    </div>
  );
}

function ShortenURLModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: any) => void;
}) {
  const [url, setUrl] = useState('');
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [customCode, setCustomCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      url,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      custom_code: customCode,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Shorten URL</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Original URL *</label>
              <input
                type="url"
                className="form-input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/your-long-url"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Custom Short Code (Optional)</label>
              <input
                type="text"
                className="form-input"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value)}
                placeholder="my-link"
                pattern="[a-zA-Z0-9-_]+"
              />
              <p style={{ color: 'var(--color-textTertiary)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                Leave empty for auto-generated code
              </p>
            </div>

            <div style={{ 
              borderTop: '1px solid var(--color-borderLight)', 
              paddingTop: '1rem', 
              marginTop: '1rem',
              marginBottom: '1rem'
            }}>
              <div style={{ fontWeight: '600', marginBottom: '1rem', color: 'var(--color-textPrimary)' }}>
                UTM Parameters (Optional)
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">UTM Source</label>
              <input
                type="text"
                className="form-input"
                value={utmSource}
                onChange={(e) => setUtmSource(e.target.value)}
                placeholder="twitter, newsletter, etc."
              />
            </div>

            <div className="form-group">
              <label className="form-label">UTM Medium</label>
              <input
                type="text"
                className="form-input"
                value={utmMedium}
                onChange={(e) => setUtmMedium(e.target.value)}
                placeholder="social, email, cpc, etc."
              />
            </div>

            <div className="form-group">
              <label className="form-label">UTM Campaign</label>
              <input
                type="text"
                className="form-input"
                value={utmCampaign}
                onChange={(e) => setUtmCampaign(e.target.value)}
                placeholder="spring_sale, product_launch, etc."
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Plus size={18} />
              Shorten URL
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StatsModal({
  shortCode,
  onClose,
}: {
  shortCode: string;
  onClose: () => void;
}) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['url-stats', shortCode],
    queryFn: () => urlsApi.getStats(shortCode),
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        <div className="modal-header">
          <h3>URL Statistics: /{shortCode}</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {isLoading ? (
            <div className="loading">Loading stats...</div>
          ) : (
            <>
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-textSecondary)', marginBottom: '0.5rem' }}>
                  Original URL
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-textPrimary)', wordBreak: 'break-all' }}>
                  {stats?.original_url}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ 
                  padding: '1rem', 
                  backgroundColor: 'var(--color-bgTertiary)', 
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--color-accentPrimary)' }}>
                    {stats?.total_clicks || 0}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-textSecondary)' }}>Total Clicks</div>
                </div>
                <div style={{ 
                  padding: '1rem', 
                  backgroundColor: 'var(--color-bgTertiary)', 
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--color-accentPrimary)' }}>
                    {stats?.unique_visitors || 0}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-textSecondary)' }}>Unique Visitors</div>
                </div>
              </div>

              {stats?.top_referers && stats.top_referers.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--color-textPrimary)' }}>
                    Top Referrers
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {stats.top_referers.map(([referer, count]: [string, number]) => (
                      <div
                        key={referer}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '0.5rem',
                          backgroundColor: 'var(--color-bgTertiary)',
                          borderRadius: '4px',
                          fontSize: '0.875rem',
                        }}
                      >
                        <span style={{ color: 'var(--color-textPrimary)' }}>{referer}</span>
                        <span style={{ color: 'var(--color-textSecondary)' }}>{count} clicks</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stats?.clicks_by_date && Object.keys(stats.clicks_by_date).length > 0 && (
                <div>
                  <h4 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--color-textPrimary)' }}>
                    Clicks by Date
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {Object.entries(stats.clicks_by_date).sort().reverse().map(([date, count]) => (
                      <div
                        key={date}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '0.5rem',
                          backgroundColor: 'var(--color-bgTertiary)',
                          borderRadius: '4px',
                          fontSize: '0.875rem',
                        }}
                      >
                        <span style={{ color: 'var(--color-textPrimary)' }}>{date}</span>
                        <span style={{ color: 'var(--color-textSecondary)' }}>{count} clicks</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
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
