import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import {
  TrendingUp, RefreshCw, Hash, Copy, Check, Filter, ChevronDown,
  ExternalLink, Sparkles,
} from 'lucide-react';

interface Trend {
  keyword: string;
  hashtag: string | null;
  platform: string;
  volume: number | null;
  rank: number | null;
  category: string | null;
  location: string;
}

const PLATFORM_COLORS: Record<string, string> = {
  twitter: '#1DA1F2',
  instagram: '#E4405F',
  tiktok: '#000000',
  linkedin: '#0A66C2',
};

const CATEGORY_COLORS: Record<string, string> = {
  Technology: '#3b82f6',
  Business: '#10b981',
  Social: '#8b5cf6',
  Lifestyle: '#f59e0b',
  Entertainment: '#ec4899',
  News: '#ef4444',
};

export default function TrendingPage() {
  const queryClient = useQueryClient();
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  // Fetch trending
  const { data: trendingData, isLoading, refetch } = useQuery({
    queryKey: ['trending', selectedPlatform, selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedPlatform) params.append('platform', selectedPlatform);
      if (selectedCategory) params.append('category', selectedCategory);
      params.append('limit', '50');
      
      const res = await api.get(`/v2/trending?${params.toString()}`);
      return res.data;
    },
  });

  // Refresh trending mutation
  const refreshTrending = useMutation({
    mutationFn: async () => {
      const res = await api.post('/v2/trending/refresh');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trending'] });
    },
  });

  const trends: Trend[] = trendingData?.trends || [];

  // Group by platform
  const trendsByPlatform = trends.reduce((acc, trend) => {
    if (!acc[trend.platform]) acc[trend.platform] = [];
    acc[trend.platform].push(trend);
    return acc;
  }, {} as Record<string, Trend[]>);

  // Get unique categories
  const categories = [...new Set(trends.map(t => t.category).filter(Boolean))] as string[];

  const copyHashtag = (tag: string) => {
    navigator.clipboard.writeText(tag);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 2000);
  };

  const formatVolume = (volume: number | null) => {
    if (!volume) return '—';
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
    return volume.toString();
  };

  return (
    <div className="trending-page">
      <div className="page-header">
        <div className="header-content">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={28} /> Trending Keywords
          </h1>
          <p style={{ color: 'var(--color-textSecondary)', marginTop: '0.25rem' }}>
            Discover trending topics and hashtags across social platforms
          </p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-primary"
            onClick={() => refreshTrending.mutate()}
            disabled={refreshTrending.isPending}
          >
            <RefreshCw size={16} className={refreshTrending.isPending ? 'animate-spin' : ''} />
            {refreshTrending.isPending ? 'Refreshing...' : 'Refresh Trends'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
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
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="linkedin">LinkedIn</option>
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--color-textSecondary)' }} />
        </div>

        <div style={{ position: 'relative' }}>
          <select
            value={selectedCategory || ''}
            onChange={e => setSelectedCategory(e.target.value || null)}
            style={{
              padding: '0.5rem 2rem 0.5rem 0.75rem', borderRadius: '0.375rem',
              border: '1px solid var(--color-borderLight)', background: 'var(--color-surface)',
              color: 'var(--color-textPrimary)', appearance: 'none', cursor: 'pointer',
            }}
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--color-textSecondary)' }} />
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-textSecondary)' }}>
          Loading trends...
        </div>
      ) : trends.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '3rem', color: 'var(--color-textSecondary)',
          background: 'var(--color-surface)', borderRadius: '0.75rem',
          border: '1px solid var(--color-borderLight)',
        }}>
          <TrendingUp size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <p>No trending data available</p>
          <p style={{ fontSize: '0.875rem' }}>Click "Refresh Trends" to fetch the latest trending topics</p>
        </div>
      ) : selectedPlatform ? (
        /* Single Platform View */
        <div style={{
          background: 'var(--color-surface)', borderRadius: '0.75rem',
          border: '1px solid var(--color-borderLight)', overflow: 'hidden',
        }}>
          <div style={{
            padding: '1rem', borderBottom: '1px solid var(--color-borderLight)',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: PLATFORM_COLORS[selectedPlatform] || '#6b7280',
            }} />
            <h3 style={{ margin: 0, textTransform: 'capitalize' }}>{selectedPlatform}</h3>
            <span style={{ color: 'var(--color-textSecondary)', fontSize: '0.875rem' }}>
              ({trends.length} trends)
            </span>
          </div>
          <div className="trends-list">
            {trends.map((trend, index) => (
              <div
                key={`${trend.platform}-${trend.keyword}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem',
                  borderBottom: index < trends.length - 1 ? '1px solid var(--color-borderLight)' : 'none',
                }}
              >
                <div style={{
                  width: '28px', textAlign: 'center', fontWeight: 700,
                  color: trend.rank && trend.rank <= 3 ? 'var(--color-primary)' : 'var(--color-textSecondary)',
                }}>
                  #{trend.rank || index + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-textPrimary)' }}>
                      {trend.keyword}
                    </span>
                    {trend.category && (
                      <span style={{
                        padding: '0.125rem 0.375rem', borderRadius: '0.25rem', fontSize: '0.625rem',
                        background: CATEGORY_COLORS[trend.category] || '#6b7280', color: 'white',
                      }}>
                        {trend.category}
                      </span>
                    )}
                  </div>
                  {trend.hashtag && (
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-textSecondary)', marginTop: '0.125rem' }}>
                      {trend.hashtag}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', minWidth: '80px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--color-textPrimary)' }}>
                    {formatVolume(trend.volume)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-textSecondary)' }}>
                    posts
                  </div>
                </div>
                {trend.hashtag && (
                  <button
                    onClick={() => copyHashtag(trend.hashtag!)}
                    style={{
                      background: 'none', border: 'none', padding: '0.375rem',
                      color: copiedTag === trend.hashtag ? '#10b981' : 'var(--color-textSecondary)',
                      cursor: 'pointer',
                    }}
                    title="Copy hashtag"
                  >
                    {copiedTag === trend.hashtag ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Multi-Platform Grid View */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
          {Object.entries(trendsByPlatform).map(([platform, platformTrends]) => (
            <div
              key={platform}
              style={{
                background: 'var(--color-surface)', borderRadius: '0.75rem',
                border: '1px solid var(--color-borderLight)', overflow: 'hidden',
              }}
            >
              <div style={{
                padding: '1rem', borderBottom: '1px solid var(--color-borderLight)',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: `${PLATFORM_COLORS[platform] || '#6b7280'}10`,
              }}>
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: PLATFORM_COLORS[platform] || '#6b7280',
                }} />
                <h3 style={{ margin: 0, textTransform: 'capitalize' }}>{platform}</h3>
              </div>
              <div className="trends-list">
                {platformTrends.slice(0, 10).map((trend, index) => (
                  <div
                    key={trend.keyword}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.625rem 1rem',
                      borderBottom: index < Math.min(platformTrends.length, 10) - 1 ? '1px solid var(--color-borderLight)' : 'none',
                    }}
                  >
                    <div style={{
                      width: '24px', textAlign: 'center', fontSize: '0.875rem', fontWeight: 600,
                      color: index < 3 ? 'var(--color-primary)' : 'var(--color-textSecondary)',
                    }}>
                      {index + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 500, color: 'var(--color-textPrimary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {trend.hashtag || trend.keyword}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-textSecondary)' }}>
                      {formatVolume(trend.volume)}
                    </div>
                    {trend.hashtag && (
                      <button
                        onClick={() => copyHashtag(trend.hashtag!)}
                        style={{
                          background: 'none', border: 'none', padding: '0.25rem',
                          color: copiedTag === trend.hashtag ? '#10b981' : 'var(--color-textSecondary)',
                          cursor: 'pointer',
                        }}
                      >
                        {copiedTag === trend.hashtag ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tips Section */}
      <div style={{
        marginTop: '2rem', padding: '1.5rem', background: 'var(--color-surface)',
        borderRadius: '0.75rem', border: '1px solid var(--color-borderLight)',
      }}>
        <h3 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={20} /> Tips for Using Trending Topics
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          <div style={{ color: 'var(--color-textSecondary)' }}>
            <strong style={{ color: 'var(--color-textPrimary)' }}>Be Relevant</strong>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem' }}>
              Only use trending hashtags that genuinely relate to your content.
            </p>
          </div>
          <div style={{ color: 'var(--color-textSecondary)' }}>
            <strong style={{ color: 'var(--color-textPrimary)' }}>Mix Popular & Niche</strong>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem' }}>
              Combine high-volume trends with industry-specific hashtags.
            </p>
          </div>
          <div style={{ color: 'var(--color-textSecondary)' }}>
            <strong style={{ color: 'var(--color-textPrimary)' }}>Timing Matters</strong>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem' }}>
              Post while topics are still trending for maximum visibility.
            </p>
          </div>
          <div style={{ color: 'var(--color-textSecondary)' }}>
            <strong style={{ color: 'var(--color-textPrimary)' }}>Platform Specific</strong>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem' }}>
              What's trending on Twitter may not be popular on LinkedIn.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
