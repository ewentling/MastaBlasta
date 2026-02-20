import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { urlsApi } from '../api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  Plus, Trash2, BarChart2, Copy, ExternalLink, Check, Search,
  QrCode, Pencil, Link2, MousePointerClick, Users, ArrowUpDown,
  Monitor, Smartphone, Tablet,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────

interface ShortenedURL {
  id: string;
  short_code: string;
  original_url: string;
  final_url: string;
  clicks: number;
  last_clicked: string | null;
  created_at: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
}

type SortKey = 'newest' | 'oldest' | 'most_clicks' | 'az';

// ─── Helpers ────────────────────────────────────────────────────────────────

function shortUrl(code: string) {
  return `${window.location.origin}/u/${code}`;
}

function domainOf(url: string) {
  try { return new URL(url).hostname; } catch { return url; }
}

function faviconUrl(url: string) {
  return `https://www.google.com/s2/favicons?domain=${domainOf(url)}&sz=32`;
}

function qrImageUrl(code: string) {
  const target = encodeURIComponent(shortUrl(code));
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${target}`;
}

const DEVICE_COLORS: Record<string, string> = {
  Desktop: '#6366f1',
  Mobile: '#10b981',
  Tablet: '#f59e0b',
};

const DEVICE_ICONS: Record<string, React.ReactNode> = {
  Desktop: <Monitor size={14} />,
  Mobile: <Smartphone size={14} />,
  Tablet: <Tablet size={14} />,
};

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function URLShortenerPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [statsModal, setStatsModal] = useState<string | null>(null);
  const [editModal, setEditModal] = useState<ShortenedURL | null>(null);
  const [qrModal, setQrModal] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');

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

  const updateMutation = useMutation({
    mutationFn: ({ code, url }: { code: string; url: string }) => urlsApi.update(code, url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shortened-urls'] });
      setEditModal(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: urlsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shortened-urls'] });
      setDeleteConfirm(null);
    },
  });

  const allUrls: ShortenedURL[] = urlsData?.urls ?? [];

  const filteredUrls = useMemo(() => {
    const q = search.toLowerCase();
    let list = q
      ? allUrls.filter(
          (u) =>
            u.short_code.toLowerCase().includes(q) ||
            u.original_url.toLowerCase().includes(q)
        )
      : [...allUrls];

    switch (sort) {
      case 'oldest':
        list.sort((a, b) => a.created_at.localeCompare(b.created_at));
        break;
      case 'most_clicks':
        list.sort((a, b) => b.clicks - a.clicks);
        break;
      case 'az':
        list.sort((a, b) => a.short_code.localeCompare(b.short_code));
        break;
      default: // newest
        list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
    return list;
  }, [allUrls, search, sort]);

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(shortUrl(code));
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const totalClicks = urlsData?.total_clicks ?? 0;
  const totalUnique = urlsData?.total_unique_visitors ?? 0;

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header">
        <h2>URL Shortener & Tracking</h2>
        <p>Shorten URLs with click tracking and UTM parameters</p>
      </div>

      {/* ── Summary Stats Bar ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {[
          { icon: <Link2 size={20} />, label: 'Total Links', value: allUrls.length, color: '#6366f1' },
          { icon: <MousePointerClick size={20} />, label: 'Total Clicks', value: totalClicks, color: '#10b981' },
          { icon: <Users size={20} />, label: 'Unique Visitors', value: totalUnique, color: '#f59e0b' },
        ].map(({ icon, label, value, color }) => (
          <div
            key={label}
            className="card"
            style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}
          >
            <div
              style={{
                width: 40, height: 40, borderRadius: 8,
                backgroundColor: `${color}22`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color,
                flexShrink: 0,
              }}
            >
              {icon}
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-textPrimary)', lineHeight: 1 }}>
                {value}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-textTertiary)', marginTop: '0.25rem' }}>
                {label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── URL List Card ── */}
      <div className="card">
        {/* Toolbar */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            marginBottom: '1.25rem', flexWrap: 'wrap',
          }}
        >
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
            <Search
              size={16}
              style={{
                position: 'absolute', left: '0.75rem', top: '50%',
                transform: 'translateY(-50%)', color: 'var(--color-textTertiary)',
                pointerEvents: 'none',
              }}
            />
            <input
              className="form-input"
              placeholder="Search links…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '2.25rem', margin: 0 }}
            />
          </div>

          {/* Sort */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-textSecondary)', fontSize: '0.875rem' }}>
            <ArrowUpDown size={15} />
            <select
              className="form-input"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              style={{ margin: 0, padding: '0.4rem 0.6rem', fontSize: '0.875rem', width: 'auto' }}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="most_clicks">Most clicks</option>
              <option value="az">A → Z</option>
            </select>
          </div>

          <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ marginLeft: 'auto' }}>
            <Plus size={18} />
            Shorten URL
          </button>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="loading">Loading URLs…</div>
        ) : filteredUrls.length === 0 ? (
          <div className="empty-state">
            <ExternalLink size={48} />
            <h3>{search ? 'No results found' : 'No shortened URLs yet'}</h3>
            <p>{search ? 'Try a different search term' : 'Create your first shortened URL to start tracking clicks'}</p>
            {!search && (
              <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ marginTop: '1rem' }}>
                <Plus size={18} /> Shorten URL
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {filteredUrls.map((url) => (
              <URLCard
                key={url.id}
                url={url}
                copied={copiedCode === url.short_code}
                onCopy={() => copyToClipboard(url.short_code)}
                onStats={() => setStatsModal(url.short_code)}
                onEdit={() => setEditModal(url)}
                onQR={() => setQrModal(url.short_code)}
                onDelete={() => setDeleteConfirm(url.short_code)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showModal && (
        <ShortenURLModal
          onClose={() => setShowModal(false)}
          onSave={(data) => createMutation.mutate(data)}
          saving={createMutation.isPending}
          error={createMutation.error ? String((createMutation.error as any).response?.data?.error ?? createMutation.error) : null}
        />
      )}

      {editModal && (
        <EditURLModal
          url={editModal}
          onClose={() => setEditModal(null)}
          onSave={(newUrl) => updateMutation.mutate({ code: editModal.short_code, url: newUrl })}
          saving={updateMutation.isPending}
        />
      )}

      {statsModal && (
        <StatsModal shortCode={statsModal} onClose={() => setStatsModal(null)} />
      )}

      {qrModal && (
        <QRModal shortCode={qrModal} onClose={() => setQrModal(null)} />
      )}

      {deleteConfirm && (
        <DeleteConfirmModal
          shortCode={deleteConfirm}
          onClose={() => setDeleteConfirm(null)}
          onConfirm={() => deleteMutation.mutate(deleteConfirm)}
          deleting={deleteMutation.isPending}
        />
      )}
    </div>
  );
}

// ─── URL Card ───────────────────────────────────────────────────────────────

function URLCard({
  url, copied, onCopy, onStats, onEdit, onQR, onDelete,
}: {
  url: ShortenedURL;
  copied: boolean;
  onCopy: () => void;
  onStats: () => void;
  onEdit: () => void;
  onQR: () => void;
  onDelete: () => void;
}) {
  const utmTags = [
    url.utm_source && { label: 'source', value: url.utm_source },
    url.utm_medium && { label: 'medium', value: url.utm_medium },
    url.utm_campaign && { label: 'campaign', value: url.utm_campaign },
    url.utm_content && { label: 'content', value: url.utm_content },
    url.utm_term && { label: 'term', value: url.utm_term },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div
      style={{
        padding: '1rem 1.25rem',
        border: '1px solid var(--color-borderLight)',
        borderRadius: '10px',
        backgroundColor: 'var(--color-bgSecondary)',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: '0.75rem',
        alignItems: 'start',
      }}
    >
      {/* Left: info */}
      <div style={{ minWidth: 0 }}>
        {/* Short code + copy */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
          <img
            src={faviconUrl(url.original_url)}
            alt=""
            width={16}
            height={16}
            style={{ borderRadius: 2, flexShrink: 0 }}
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236366f1' stroke-width='2'%3E%3Cpath d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'/%3E%3Cpath d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'/%3E%3C/svg%3E";
            }}
          />
          <code
            style={{
              fontWeight: 700, fontSize: '0.95rem',
              color: 'var(--color-accentPrimary)',
              backgroundColor: 'var(--color-bgTertiary)',
              padding: '0.2rem 0.5rem', borderRadius: 4,
            }}
          >
            /u/{url.short_code}
          </code>
          <button
            className="btn btn-secondary btn-small"
            onClick={onCopy}
            title="Copy short link"
            style={{ padding: '0.2rem 0.45rem' }}
          >
            {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
          </button>
          <a
            href={shortUrl(url.short_code)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-small"
            title="Open link"
            style={{ padding: '0.2rem 0.45rem' }}
          >
            <ExternalLink size={13} />
          </a>
        </div>

        {/* Original URL (truncated) */}
        <div
          style={{
            color: 'var(--color-textSecondary)', fontSize: '0.8rem',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            maxWidth: '100%',
          }}
          title={url.original_url}
        >
          → {url.original_url}
        </div>

        {/* UTM tags */}
        {utmTags.length > 0 && (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            {utmTags.map(({ label, value }) => (
              <span
                key={label}
                className="badge badge-info"
                style={{ fontSize: '0.68rem' }}
              >
                {label}: {value}
              </span>
            ))}
          </div>
        )}

        {/* Footer: click count + dates */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '1rem',
            marginTop: '0.6rem', flexWrap: 'wrap',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <MousePointerClick size={14} style={{ color: 'var(--color-accentPrimary)' }} />
            <strong style={{ color: 'var(--color-textPrimary)' }}>{url.clicks}</strong>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-textTertiary)' }}>clicks</span>
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-textTertiary)' }}>
            Created {new Date(url.created_at).toLocaleDateString()}
          </span>
          {url.last_clicked && (
            <span style={{ fontSize: '0.72rem', color: 'var(--color-textTertiary)' }}>
              · Last clicked {new Date(url.last_clicked).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {/* Right: action buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flexShrink: 0 }}>
        <button className="btn btn-secondary btn-small" onClick={onStats} title="View stats">
          <BarChart2 size={14} /> Stats
        </button>
        <button className="btn btn-secondary btn-small" onClick={onQR} title="QR code">
          <QrCode size={14} /> QR
        </button>
        <button className="btn btn-secondary btn-small" onClick={onEdit} title="Edit destination URL">
          <Pencil size={14} /> Edit
        </button>
        <button className="btn btn-danger btn-small" onClick={onDelete} title="Delete">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Shorten URL Modal ───────────────────────────────────────────────────────

function ShortenURLModal({
  onClose, onSave, saving, error,
}: {
  onClose: () => void;
  onSave: (data: any) => void;
  saving: boolean;
  error: string | null;
}) {
  const [url, setUrl] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [utmContent, setUtmContent] = useState('');
  const [utmTerm, setUtmTerm] = useState('');
  const [showUtm, setShowUtm] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      url,
      custom_code: customCode,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_content: utmContent,
      utm_term: utmTerm,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h3>Shorten URL</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{ padding: '0.75rem', backgroundColor: '#fee2e2', borderRadius: 6, color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem' }}>
                {error}
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Destination URL *</label>
              <input
                type="url"
                className="form-input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/your-long-url"
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Custom Short Code <span style={{ color: 'var(--color-textTertiary)', fontWeight: 400 }}>(optional)</span></label>
              <input
                type="text"
                className="form-input"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value)}
                placeholder="my-link"
                pattern="[a-zA-Z0-9-_]+"
              />
              <p style={{ color: 'var(--color-textTertiary)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                Letters, numbers, hyphens and underscores only. Leave empty for auto-generated code.
              </p>
            </div>

            {/* UTM collapsible */}
            <button
              type="button"
              onClick={() => setShowUtm((v) => !v)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-accentPrimary)', fontSize: '0.875rem',
                fontWeight: 600, padding: 0, marginBottom: showUtm ? '1rem' : 0,
                display: 'flex', alignItems: 'center', gap: '0.35rem',
              }}
            >
              {showUtm ? '▾' : '▸'} UTM Parameters {showUtm ? '' : '(optional)'}
            </button>

            {showUtm && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {[
                  { label: 'Source', value: utmSource, set: setUtmSource, placeholder: 'twitter, newsletter…' },
                  { label: 'Medium', value: utmMedium, set: setUtmMedium, placeholder: 'social, email, cpc…' },
                  { label: 'Campaign', value: utmCampaign, set: setUtmCampaign, placeholder: 'spring_sale…' },
                  { label: 'Content', value: utmContent, set: setUtmContent, placeholder: 'banner_a…' },
                  { label: 'Term', value: utmTerm, set: setUtmTerm, placeholder: 'keyword…' },
                ].map(({ label, value, set, placeholder }) => (
                  <div key={label} className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>{label}</label>
                    <input
                      type="text"
                      className="form-input"
                      value={value}
                      onChange={(e) => set(e.target.value)}
                      placeholder={placeholder}
                      style={{ fontSize: '0.875rem' }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Plus size={18} />
              {saving ? 'Shortening…' : 'Shorten URL'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit URL Modal ──────────────────────────────────────────────────────────

function EditURLModal({
  url, onClose, onSave, saving,
}: {
  url: ShortenedURL;
  onClose: () => void;
  onSave: (newUrl: string) => void;
  saving: boolean;
}) {
  const [newUrl, setNewUrl] = useState(url.original_url);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(newUrl);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h3>Edit Destination URL</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p style={{ color: 'var(--color-textSecondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
              Changing the destination does not affect the short code{' '}
              <code style={{ color: 'var(--color-accentPrimary)' }}>/u/{url.short_code}</code> or its click history.
            </p>
            <div className="form-group">
              <label className="form-label">New Destination URL *</label>
              <input
                type="url"
                className="form-input"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || newUrl === url.original_url}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ────────────────────────────────────────────────────

function DeleteConfirmModal({
  shortCode, onClose, onConfirm, deleting,
}: {
  shortCode: string;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h3>Delete Short Link</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--color-textSecondary)' }}>
            Permanently delete{' '}
            <code style={{ color: 'var(--color-accentPrimary)' }}>/u/{shortCode}</code>?
            All click history will be lost and this short code will stop redirecting.
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={deleting}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={deleting}>
            <Trash2 size={16} />
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── QR Code Modal ───────────────────────────────────────────────────────────

function QRModal({ shortCode, onClose }: { shortCode: string; onClose: () => void }) {
  const link = shortUrl(shortCode);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 320, textAlign: 'center' }}>
        <div className="modal-header">
          <h3>QR Code</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <img
            src={qrImageUrl(shortCode)}
            alt={`QR code for /u/${shortCode}`}
            width={200}
            height={200}
            style={{ borderRadius: 8, border: '1px solid var(--color-borderLight)' }}
          />
          <code style={{ fontSize: '0.8rem', color: 'var(--color-textSecondary)', wordBreak: 'break-all' }}>
            {link}
          </code>
          <a
            href={qrImageUrl(shortCode)}
            download={`qr-${shortCode}.png`}
            className="btn btn-primary"
          >
            Download QR
          </a>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Stats Modal ─────────────────────────────────────────────────────────────

function StatsModal({ shortCode, onClose }: { shortCode: string; onClose: () => void }) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['url-stats', shortCode],
    queryFn: () => urlsApi.getStats(shortCode),
  });

  const clicksChartData = stats?.clicks_by_date
    ? Object.entries(stats.clicks_by_date as Record<string, number>)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-14) // last 14 days
        .map(([date, count]) => ({ date: date.slice(5), clicks: count }))
    : [];

  const deviceData = stats?.devices
    ? Object.entries(stats.devices as Record<string, number>)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name, value }))
    : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700 }}>
        <div className="modal-header">
          <h3>Stats: /u/{shortCode}</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {isLoading ? (
            <div className="loading">Loading stats…</div>
          ) : (
            <>
              {/* Original URL */}
              <div style={{ marginBottom: '1.25rem', padding: '0.75rem', backgroundColor: 'var(--color-bgTertiary)', borderRadius: 6 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-textTertiary)', marginBottom: '0.25rem' }}>Destination URL</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-textPrimary)', wordBreak: 'break-all' }}>{stats?.original_url}</div>
              </div>

              {/* KPI tiles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {[
                  { label: 'Total Clicks', value: stats?.total_clicks ?? 0, color: '#6366f1' },
                  { label: 'Unique Visitors', value: stats?.unique_visitors ?? 0, color: '#10b981' },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    style={{ padding: '1rem', backgroundColor: 'var(--color-bgTertiary)', borderRadius: 8, textAlign: 'center' }}
                  >
                    <div style={{ fontSize: '2rem', fontWeight: 700, color }}>{value}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-textSecondary)' }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Clicks over time chart */}
              {clicksChartData.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--color-textPrimary)' }}>
                    Clicks Over Time (last 14 days)
                  </h4>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={clicksChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="clicks" fill="#6366f1" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Device breakdown */}
              {deviceData.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  <div>
                    <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--color-textPrimary)' }}>
                      Device Breakdown
                    </h4>
                    <ResponsiveContainer width="100%" height={140}>
                      <PieChart>
                        <Pie data={deviceData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={3}>
                          {deviceData.map((entry) => (
                            <Cell key={entry.name} fill={DEVICE_COLORS[entry.name] ?? '#94a3b8'} />
                          ))}
                        </Pie>
                        <Legend formatter={(v) => <span style={{ fontSize: '0.75rem' }}>{v}</span>} />
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Device list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
                    {deviceData.map(({ name, value }) => {
                      const total = stats?.total_clicks || 1;
                      return (
                        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                          <span style={{ color: DEVICE_COLORS[name], display: 'flex', alignItems: 'center' }}>
                            {DEVICE_ICONS[name]}
                          </span>
                          <span style={{ color: 'var(--color-textPrimary)', flex: 1 }}>{name}</span>
                          <span style={{ color: 'var(--color-textSecondary)', fontWeight: 600 }}>{value}</span>
                          <span style={{ color: 'var(--color-textTertiary)', fontSize: '0.75rem' }}>
                            ({Math.round((value / total) * 100)}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Top referrers */}
              {stats?.top_referers && stats.top_referers.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--color-textPrimary)' }}>
                    Top Referrers
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {stats.top_referers.map(([referer, count]: [string, number]) => (
                      <div
                        key={referer}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '0.5rem 0.75rem',
                          backgroundColor: 'var(--color-bgTertiary)',
                          borderRadius: 4, fontSize: '0.85rem',
                        }}
                      >
                        <span style={{ color: 'var(--color-textPrimary)', wordBreak: 'break-all' }}>{referer}</span>
                        <span style={{ color: 'var(--color-textSecondary)', flexShrink: 0, marginLeft: '1rem' }}>{count} clicks</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
