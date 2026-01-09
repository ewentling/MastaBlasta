import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart2, TrendingUp, Users, Eye, Heart, MessageCircle, Share2 } from 'lucide-react';
import * as api from '../api';

export default function AnalyticsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState(30);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  // Fetch dashboard analytics
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['analytics-dashboard', selectedPeriod],
    queryFn: () => fetch(`/api/analytics/dashboard?days=${selectedPeriod}`).then(res => res.json())
  });

  // Fetch individual post analytics if selected
  const { data: postAnalytics, isLoading: postLoading } = useQuery({
    queryKey: ['post-analytics', selectedPostId],
    queryFn: () => selectedPostId ? fetch(`/api/analytics/posts/${selectedPostId}`).then(res => res.json()) : null,
    enabled: !!selectedPostId
  });

  return (
    <div>
      <div className="page-header">
        <h2>Post Performance Analytics</h2>
        <p>Track engagement metrics across all platforms</p>
      </div>

      {/* Period Selector */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {[7, 30, 90].map(days => (
            <button
              key={days}
              className={`btn ${selectedPeriod === days ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedPeriod(days)}
            >
              Last {days} days
            </button>
          ))}
        </div>
      </div>

      {dashboardLoading ? (
        <div className="loading">Loading analytics...</div>
      ) : dashboardData ? (
        <>
          {/* Summary Cards */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                <div style={{ 
                  padding: '0.75rem', 
                  borderRadius: '8px', 
                  backgroundColor: 'var(--color-accentPrimary)', 
                  color: 'white' 
                }}>
                  <BarChart2 size={24} />
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-textSecondary)' }}>Total Posts</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-textPrimary)' }}>
                    {dashboardData.summary.total_posts}
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                <div style={{ 
                  padding: '0.75rem', 
                  borderRadius: '8px', 
                  backgroundColor: '#8b5cf6', 
                  color: 'white' 
                }}>
                  <Eye size={24} />
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-textSecondary)' }}>Total Impressions</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-textPrimary)' }}>
                    {dashboardData.summary.total_impressions.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                <div style={{ 
                  padding: '0.75rem', 
                  borderRadius: '8px', 
                  backgroundColor: '#ec4899', 
                  color: 'white' 
                }}>
                  <Heart size={24} />
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-textSecondary)' }}>Total Engagement</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-textPrimary)' }}>
                    {dashboardData.summary.total_engagement.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                <div style={{ 
                  padding: '0.75rem', 
                  borderRadius: '8px', 
                  backgroundColor: '#10b981', 
                  color: 'white' 
                }}>
                  <TrendingUp size={24} />
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-textSecondary)' }}>Avg Engagement Rate</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-textPrimary)' }}>
                    {dashboardData.summary.avg_engagement_rate}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Platform Breakdown */}
          <div className="card" style={{ marginBottom: '2rem' }}>
            <div className="card-header">
              <h3>Platform Performance</h3>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                {Object.entries(dashboardData.platform_breakdown).map(([platform, data]: [string, any]) => (
                  <div 
                    key={platform}
                    style={{
                      padding: '1rem',
                      border: '1px solid var(--color-borderLight)',
                      borderRadius: '8px',
                      backgroundColor: 'var(--color-bgSecondary)'
                    }}
                  >
                    <div style={{ 
                      fontWeight: '600', 
                      textTransform: 'capitalize', 
                      marginBottom: '0.75rem',
                      color: 'var(--color-textPrimary)'
                    }}>
                      {platform}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-textSecondary)', marginBottom: '0.25rem' }}>
                      <Eye size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                      {data.impressions.toLocaleString()} impressions
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-textSecondary)', marginBottom: '0.25rem' }}>
                      <Heart size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                      {data.engagement.toLocaleString()} engagement
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-textSecondary)' }}>
                      <BarChart2 size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                      {data.posts} posts
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Performing Posts */}
          <div className="card">
            <div className="card-header">
              <h3>Top Performing Posts</h3>
            </div>
            <div style={{ padding: '1.5rem' }}>
              {dashboardData.top_posts.length === 0 ? (
                <div className="empty-state">
                  <p>No published posts yet</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {dashboardData.top_posts.map((post: any, index: number) => (
                    <div
                      key={post.post_id}
                      style={{
                        padding: '1rem',
                        border: '1px solid var(--color-borderLight)',
                        borderRadius: '8px',
                        backgroundColor: 'var(--color-bgSecondary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onClick={() => setSelectedPostId(post.post_id)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-accentPrimary)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-borderLight)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.5rem', 
                            marginBottom: '0.5rem' 
                          }}>
                            <span style={{ 
                              fontWeight: '700', 
                              fontSize: '1.25rem', 
                              color: 'var(--color-accentPrimary)' 
                            }}>
                              #{index + 1}
                            </span>
                            <span style={{ fontSize: '0.875rem', color: 'var(--color-textTertiary)' }}>
                              Post ID: {post.post_id.substring(0, 8)}
                            </span>
                          </div>
                          <div style={{ 
                            display: 'flex', 
                            gap: '1.5rem', 
                            fontSize: '0.875rem', 
                            color: 'var(--color-textSecondary)' 
                          }}>
                            <span>
                              <Eye size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                              {post.impressions.toLocaleString()} impressions
                            </span>
                            <span>
                              <Heart size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                              {post.engagement.toLocaleString()} engagement
                            </span>
                            <span>
                              <TrendingUp size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                              {post.engagement_rate}% rate
                            </span>
                          </div>
                        </div>
                        <button 
                          className="btn btn-secondary btn-small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPostId(post.post_id);
                          }}
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}

      {/* Post Detail Modal */}
      {selectedPostId && postAnalytics && (
        <div className="modal-overlay" onClick={() => setSelectedPostId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh' }}>
            <div className="modal-header">
              <h3>Post Analytics</h3>
              <button className="close-button" onClick={() => setSelectedPostId(null)}>×</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Overall Metrics */}
              <div style={{ marginBottom: '2rem' }}>
                <h4 style={{ marginBottom: '1rem', color: 'var(--color-textPrimary)' }}>Overall Performance</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  <div style={{ 
                    padding: '1rem', 
                    backgroundColor: 'var(--color-bgSecondary)', 
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--color-accentPrimary)' }}>
                      {postAnalytics.totals.impressions.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-textSecondary)' }}>Total Impressions</div>
                  </div>
                  <div style={{ 
                    padding: '1rem', 
                    backgroundColor: 'var(--color-bgSecondary)', 
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--color-accentPrimary)' }}>
                      {postAnalytics.totals.engagement.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-textSecondary)' }}>Total Engagement</div>
                  </div>
                  <div style={{ 
                    padding: '1rem', 
                    backgroundColor: 'var(--color-bgSecondary)', 
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--color-accentPrimary)' }}>
                      {postAnalytics.totals.engagement_rate}%
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-textSecondary)' }}>Engagement Rate</div>
                  </div>
                </div>
              </div>

              {/* Platform Breakdown */}
              <div style={{ marginBottom: '2rem' }}>
                <h4 style={{ marginBottom: '1rem', color: 'var(--color-textPrimary)' }}>Platform Breakdown</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {Object.entries(postAnalytics.platforms).map(([platform, data]: [string, any]) => (
                    <div
                      key={platform}
                      style={{
                        padding: '1rem',
                        border: '1px solid var(--color-borderLight)',
                        borderRadius: '8px',
                        backgroundColor: 'var(--color-bgSecondary)'
                      }}
                    >
                      <div style={{ 
                        fontWeight: '600', 
                        textTransform: 'capitalize', 
                        marginBottom: '0.75rem',
                        color: 'var(--color-textPrimary)',
                        fontSize: '1.125rem'
                      }}>
                        {platform}
                      </div>
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(3, 1fr)', 
                        gap: '1rem',
                        fontSize: '0.875rem'
                      }}>
                        <div>
                          <div style={{ color: 'var(--color-textSecondary)' }}>Impressions</div>
                          <div style={{ fontWeight: '600', color: 'var(--color-textPrimary)' }}>
                            {data.impressions.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--color-textSecondary)' }}>Reach</div>
                          <div style={{ fontWeight: '600', color: 'var(--color-textPrimary)' }}>
                            {data.reach.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--color-textSecondary)' }}>Engagement Rate</div>
                          <div style={{ fontWeight: '600', color: 'var(--color-textPrimary)' }}>
                            {data.engagement_rate}%
                          </div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--color-textSecondary)' }}>
                            <Heart size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                            Likes
                          </div>
                          <div style={{ fontWeight: '600', color: 'var(--color-textPrimary)' }}>
                            {data.likes.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--color-textSecondary)' }}>
                            <MessageCircle size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                            Comments
                          </div>
                          <div style={{ fontWeight: '600', color: 'var(--color-textPrimary)' }}>
                            {data.comments.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--color-textSecondary)' }}>
                            <Share2 size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                            Shares
                          </div>
                          <div style={{ fontWeight: '600', color: 'var(--color-textPrimary)' }}>
                            {data.shares.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Demographics */}
              {postAnalytics.demographics && (
                <div>
                  <h4 style={{ marginBottom: '1rem', color: 'var(--color-textPrimary)' }}>Audience Demographics</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
                    {/* Age Groups */}
                    <div style={{ 
                      padding: '1rem', 
                      border: '1px solid var(--color-borderLight)', 
                      borderRadius: '8px',
                      backgroundColor: 'var(--color-bgSecondary)'
                    }}>
                      <div style={{ fontWeight: '600', marginBottom: '0.75rem', color: 'var(--color-textPrimary)' }}>
                        Age Groups
                      </div>
                      {Object.entries(postAnalytics.demographics.age_groups).map(([age, percentage]: [string, any]) => (
                        <div key={age} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{ color: 'var(--color-textSecondary)' }}>{age}</span>
                          <span style={{ fontWeight: '600', color: 'var(--color-textPrimary)' }}>{percentage}%</span>
                        </div>
                      ))}
                    </div>

                    {/* Top Locations */}
                    <div style={{ 
                      padding: '1rem', 
                      border: '1px solid var(--color-borderLight)', 
                      borderRadius: '8px',
                      backgroundColor: 'var(--color-bgSecondary)'
                    }}>
                      <div style={{ fontWeight: '600', marginBottom: '0.75rem', color: 'var(--color-textPrimary)' }}>
                        Top Locations
                      </div>
                      {postAnalytics.demographics.top_locations.map((location: any) => (
                        <div key={location.country} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{ color: 'var(--color-textSecondary)' }}>{location.country}</span>
                          <span style={{ fontWeight: '600', color: 'var(--color-textPrimary)' }}>{location.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedPostId(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
