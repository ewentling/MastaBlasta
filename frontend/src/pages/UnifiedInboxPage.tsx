import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import {
  Inbox, MessageCircle, AtSign, Bell, Archive, Check, CheckCheck,
  Filter, RefreshCw, ChevronDown, ExternalLink, MoreHorizontal,
} from 'lucide-react';

interface InboxItem {
  id: string;
  item_type: string;
  platform: string;
  account_name: string | null;
  content: string | null;
  author_name: string | null;
  author_username: string | null;
  author_avatar: string | null;
  related_post_id: string | null;
  is_read: boolean;
  is_replied: boolean;
  sentiment: string | null;
  received_at: string;
}

interface InboxStats {
  total: number;
  unread: number;
  by_type: Record<string, number>;
  by_platform: Record<string, number>;
}

const ITEM_TYPE_ICONS: Record<string, React.ReactNode> = {
  comment: <MessageCircle size={16} />,
  mention: <AtSign size={16} />,
  dm: <Inbox size={16} />,
  reply: <MessageCircle size={16} />,
};

const PLATFORM_COLORS: Record<string, string> = {
  twitter: '#1DA1F2',
  facebook: '#1877F2',
  instagram: '#E4405F',
  linkedin: '#0A66C2',
  threads: '#000000',
  bluesky: '#0085FF',
  youtube: '#FF0000',
  tiktok: '#000000',
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: '#10b981',
  neutral: '#6b7280',
  negative: '#ef4444',
};

export default function UnifiedInboxPage() {
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [page, setPage] = useState(1);

  // Fetch inbox items
  const { data: inboxData, isLoading: loadingInbox, refetch } = useQuery({
    queryKey: ['inbox', selectedType, selectedPlatform, showUnreadOnly, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedType) params.append('type', selectedType);
      if (selectedPlatform) params.append('platform', selectedPlatform);
      if (showUnreadOnly) params.append('is_read', 'false');
      params.append('page', page.toString());
      params.append('per_page', '20');
      
      const res = await api.get(`/v2/inbox?${params.toString()}`);
      return res.data;
    },
  });

  // Fetch inbox stats
  const { data: statsData } = useQuery({
    queryKey: ['inbox-stats'],
    queryFn: async () => {
      const res = await api.get('/v2/inbox/stats');
      return res.data;
    },
  });

  const items: InboxItem[] = inboxData?.items || [];
  const totalPages = inboxData?.pages || 1;
  const stats: InboxStats = statsData || { total: 0, unread: 0, by_type: {}, by_platform: {} };

  // Mark as read mutation
  const markRead = useMutation({
    mutationFn: async (itemId: string) => {
      await api.post(`/v2/inbox/${itemId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-stats'] });
    },
  });

  // Archive mutation
  const archiveItem = useMutation({
    mutationFn: async (itemId: string) => {
      await api.post(`/v2/inbox/${itemId}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-stats'] });
      setSelectedItem(null);
    },
  });

  // Mark all read mutation
  const markAllRead = useMutation({
    mutationFn: async () => {
      await api.post('/v2/inbox/mark-all-read');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-stats'] });
    },
  });

  const handleItemClick = (item: InboxItem) => {
    setSelectedItem(item);
    if (!item.is_read) {
      markRead.mutate(item.id);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="unified-inbox-page">
      <div className="page-header">
        <div className="header-content">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Inbox size={28} /> Unified Inbox
          </h1>
          <p style={{ color: 'var(--color-textSecondary)', marginTop: '0.25rem' }}>
            Manage all your comments, mentions, and messages in one place
          </p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => refetch()}>
            <RefreshCw size={16} /> Refresh
          </button>
          {stats.unread > 0 && (
            <button
              className="btn btn-primary"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck size={16} /> Mark All Read
            </button>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'var(--color-surface)', borderRadius: '0.5rem', padding: '1rem', flex: 1, border: '1px solid var(--color-borderLight)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-textSecondary)', marginBottom: '0.25rem' }}>Total</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-textPrimary)' }}>{stats.total}</div>
        </div>
        <div style={{ background: 'var(--color-surface)', borderRadius: '0.5rem', padding: '1rem', flex: 1, border: '1px solid var(--color-borderLight)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-textSecondary)', marginBottom: '0.25rem' }}>Unread</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: stats.unread > 0 ? '#ef4444' : 'var(--color-textPrimary)' }}>{stats.unread}</div>
        </div>
        <div style={{ background: 'var(--color-surface)', borderRadius: '0.5rem', padding: '1rem', flex: 1, border: '1px solid var(--color-borderLight)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-textSecondary)', marginBottom: '0.25rem' }}>Comments</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-textPrimary)' }}>{stats.by_type?.comment || 0}</div>
        </div>
        <div style={{ background: 'var(--color-surface)', borderRadius: '0.5rem', padding: '1rem', flex: 1, border: '1px solid var(--color-borderLight)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-textSecondary)', marginBottom: '0.25rem' }}>Mentions</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-textPrimary)' }}>{stats.by_type?.mention || 0}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <select
            value={selectedType || ''}
            onChange={e => setSelectedType(e.target.value || null)}
            style={{
              padding: '0.5rem 2rem 0.5rem 0.75rem', borderRadius: '0.375rem',
              border: '1px solid var(--color-borderLight)', background: 'var(--color-surface)',
              color: 'var(--color-textPrimary)', appearance: 'none', cursor: 'pointer',
            }}
          >
            <option value="">All Types</option>
            <option value="comment">Comments</option>
            <option value="mention">Mentions</option>
            <option value="dm">Direct Messages</option>
            <option value="reply">Replies</option>
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--color-textSecondary)' }} />
        </div>
        
        <div style={{ position: 'relative' }}>
          <select
            value={selectedPlatform || ''}
            onChange={e => setSelectedPlatform(e.target.value || null)}
            style={{
              padding: '0.5rem 2rem 0.5rem 0.75rem', borderRadius: '0.375rem',
              border: '1px solid var(--color-borderLight)', background: 'var(--color-surface)',
              color: 'var(--color-textPrimary)', appearance: 'none', cursor: 'pointer',
            }}
          >
            <option value="">All Platforms</option>
            <option value="twitter">Twitter</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
            <option value="linkedin">LinkedIn</option>
            <option value="threads">Threads</option>
            <option value="bluesky">Bluesky</option>
            <option value="youtube">YouTube</option>
            <option value="tiktok">TikTok</option>
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--color-textSecondary)' }} />
        </div>
        
        <button
          onClick={() => setShowUnreadOnly(!showUnreadOnly)}
          style={{
            padding: '0.5rem 0.75rem', borderRadius: '0.375rem',
            border: '1px solid',
            borderColor: showUnreadOnly ? 'var(--color-primary)' : 'var(--color-borderLight)',
            background: showUnreadOnly ? 'var(--color-primary)' : 'var(--color-surface)',
            color: showUnreadOnly ? 'white' : 'var(--color-textPrimary)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem',
          }}
        >
          <Filter size={14} /> Unread Only
        </button>
      </div>

      {/* Main Content */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedItem ? '1fr 400px' : '1fr', gap: '1rem' }}>
        {/* Inbox List */}
        <div className="inbox-list" style={{ background: 'var(--color-surface)', borderRadius: '0.75rem', border: '1px solid var(--color-borderLight)', overflow: 'hidden' }}>
          {loadingInbox ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-textSecondary)' }}>
              Loading...
            </div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-textSecondary)' }}>
              <Inbox size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <p>No messages yet</p>
              <p style={{ fontSize: '0.875rem' }}>When you receive comments, mentions, or messages, they'll appear here</p>
            </div>
          ) : (
            <>
              {items.map(item => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '1rem',
                    borderBottom: '1px solid var(--color-borderLight)', cursor: 'pointer',
                    background: selectedItem?.id === item.id ? 'var(--color-bg)' : item.is_read ? 'transparent' : 'rgba(0, 229, 255, 0.05)',
                    transition: 'background 0.2s',
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                    background: item.author_avatar ? `url(${item.author_avatar}) center/cover` : 'var(--color-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 600,
                  }}>
                    {!item.author_avatar && (item.author_name?.[0] || '?')}
                  </div>
                  
                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: item.is_read ? 400 : 600, color: 'var(--color-textPrimary)' }}>
                        {item.author_name || item.author_username || 'Unknown'}
                      </span>
                      {item.author_username && item.author_name && (
                        <span style={{ color: 'var(--color-textSecondary)', fontSize: '0.875rem' }}>
                          @{item.author_username}
                        </span>
                      )}
                      <span style={{
                        padding: '0.125rem 0.375rem', borderRadius: '0.25rem', fontSize: '0.625rem',
                        background: PLATFORM_COLORS[item.platform] || '#6b7280', color: 'white',
                        textTransform: 'uppercase', fontWeight: 600,
                      }}>
                        {item.platform}
                      </span>
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: '0.25rem',
                        color: 'var(--color-textSecondary)', fontSize: '0.75rem',
                      }}>
                        {ITEM_TYPE_ICONS[item.item_type]}
                        {item.item_type}
                      </span>
                    </div>
                    <p style={{
                      margin: 0, color: 'var(--color-textSecondary)', fontSize: '0.875rem',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {item.content || '(No content)'}
                    </p>
                  </div>
                  
                  {/* Time & Status */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-textSecondary)' }}>
                      {formatTime(item.received_at)}
                    </div>
                    {item.sentiment && (
                      <div style={{
                        marginTop: '0.25rem', fontSize: '0.625rem', padding: '0.125rem 0.375rem',
                        borderRadius: '0.25rem', background: SENTIMENT_COLORS[item.sentiment],
                        color: 'white', textTransform: 'capitalize',
                      }}>
                        {item.sentiment}
                      </div>
                    )}
                    {!item.is_read && (
                      <div style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: '#3b82f6', marginTop: '0.5rem', marginLeft: 'auto',
                      }} />
                    )}
                  </div>
                </div>
              ))}
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '1rem' }}>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn btn-secondary"
                    style={{ padding: '0.375rem 0.75rem' }}
                  >
                    Previous
                  </button>
                  <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.75rem', color: 'var(--color-textSecondary)' }}>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="btn btn-secondary"
                    style={{ padding: '0.375rem 0.75rem' }}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Detail Panel */}
        {selectedItem && (
          <div className="detail-panel" style={{
            background: 'var(--color-surface)', borderRadius: '0.75rem',
            border: '1px solid var(--color-borderLight)', padding: '1.5rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  background: selectedItem.author_avatar ? `url(${selectedItem.author_avatar}) center/cover` : 'var(--color-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 600, fontSize: '1.25rem',
                }}>
                  {!selectedItem.author_avatar && (selectedItem.author_name?.[0] || '?')}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--color-textPrimary)' }}>
                    {selectedItem.author_name || 'Unknown'}
                  </div>
                  {selectedItem.author_username && (
                    <div style={{ color: 'var(--color-textSecondary)', fontSize: '0.875rem' }}>
                      @{selectedItem.author_username}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                style={{ background: 'none', border: 'none', color: 'var(--color-textSecondary)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <span style={{
                padding: '0.25rem 0.5rem', borderRadius: '0.25rem',
                background: PLATFORM_COLORS[selectedItem.platform] || '#6b7280',
                color: 'white', fontSize: '0.75rem', textTransform: 'capitalize',
              }}>
                {selectedItem.platform}
              </span>
              <span style={{
                padding: '0.25rem 0.5rem', borderRadius: '0.25rem',
                background: 'var(--color-bg)', border: '1px solid var(--color-borderLight)',
                color: 'var(--color-textSecondary)', fontSize: '0.75rem',
                display: 'flex', alignItems: 'center', gap: '0.25rem',
              }}>
                {ITEM_TYPE_ICONS[selectedItem.item_type]} {selectedItem.item_type}
              </span>
              {selectedItem.sentiment && (
                <span style={{
                  padding: '0.25rem 0.5rem', borderRadius: '0.25rem',
                  background: SENTIMENT_COLORS[selectedItem.sentiment],
                  color: 'white', fontSize: '0.75rem', textTransform: 'capitalize',
                }}>
                  {selectedItem.sentiment}
                </span>
              )}
            </div>
            
            <div style={{
              background: 'var(--color-bg)', borderRadius: '0.5rem',
              padding: '1rem', marginBottom: '1rem',
              border: '1px solid var(--color-borderLight)',
            }}>
              <p style={{ margin: 0, color: 'var(--color-textPrimary)', whiteSpace: 'pre-wrap' }}>
                {selectedItem.content || '(No content)'}
              </p>
            </div>
            
            <div style={{ fontSize: '0.875rem', color: 'var(--color-textSecondary)', marginBottom: '1.5rem' }}>
              Received: {new Date(selectedItem.received_at).toLocaleString()}
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => {
                  // Would open reply composer - for now just mark as replied
                  alert('Reply feature coming soon!');
                }}
              >
                <MessageCircle size={16} /> Reply
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => archiveItem.mutate(selectedItem.id)}
                disabled={archiveItem.isPending}
              >
                <Archive size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
