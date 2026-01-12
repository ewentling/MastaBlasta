import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { postsApi, accountsApi } from '../api';
import { BarChart3, Users, Send, Calendar, Plus, Sparkles, TrendingUp, Zap } from 'lucide-react';

export default function DashboardPage() {
  const navigate = useNavigate();
  
  const { data: postsData } = useQuery({
    queryKey: ['posts'],
    queryFn: () => postsApi.getAll(),
  });

  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.getAll(),
  });

  const posts = postsData?.posts || [];
  const accounts = accountsData?.accounts || [];

  const publishedPosts = posts.filter(p => p.status === 'published').length;
  const scheduledPosts = posts.filter(p => p.status === 'scheduled').length;
  const activeAccounts = accounts.filter(a => a.enabled).length;

  const recentPosts = posts.slice(0, 5);

  const quickActions = [
    { icon: Plus, label: 'Create Post', path: '/create-post', color: '#667eea' },
    { icon: Calendar, label: 'Schedule Post', path: '/create-post', color: '#48bb78' },
    { icon: Users, label: 'Add Account', path: '/accounts', color: '#ed8936' },
    { icon: Sparkles, label: 'AI Assistant', path: '/chatbot', color: '#9f7aea' },
    { icon: TrendingUp, label: 'View Analytics', path: '/analytics', color: '#4299e1' },
  ];

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Overview of your social media posting activity</p>
      </div>

      {/* Quick Actions */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Zap size={20} style={{ color: 'var(--color-accentPrimary)' }} />
            <h3>Quick Actions</h3>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          {quickActions.map((action) => (
            <button
              key={action.label}
              className="btn btn-secondary"
              onClick={() => navigate(action.path)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '1rem',
                height: 'auto',
                backgroundColor: 'var(--color-bgSecondary)',
                border: '2px solid var(--color-borderLight)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = action.color;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-borderLight)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ 
                background: `linear-gradient(135deg, ${action.color} 0%, ${action.color}cc 100%)`,
                padding: '0.75rem',
                borderRadius: '8px',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <action.icon size={24} />
              </div>
              <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
              padding: '1rem', 
              borderRadius: '12px',
              color: 'white'
            }}>
              <Users size={24} />
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#1a202c' }}>
                {activeAccounts}
              </div>
              <div style={{ color: '#718096', fontSize: '0.875rem' }}>Active Accounts</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ 
              background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)', 
              padding: '1rem', 
              borderRadius: '12px',
              color: 'white'
            }}>
              <Send size={24} />
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#1a202c' }}>
                {publishedPosts}
              </div>
              <div style={{ color: '#718096', fontSize: '0.875rem' }}>Published Posts</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ 
              background: 'linear-gradient(135deg, #ed8936 0%, #dd6b20 100%)', 
              padding: '1rem', 
              borderRadius: '12px',
              color: 'white'
            }}>
              <Calendar size={24} />
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#1a202c' }}>
                {scheduledPosts}
              </div>
              <div style={{ color: '#718096', fontSize: '0.875rem' }}>Scheduled Posts</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ 
              background: 'linear-gradient(135deg, #4299e1 0%, #3182ce 100%)', 
              padding: '1rem', 
              borderRadius: '12px',
              color: 'white'
            }}>
              <BarChart3 size={24} />
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#1a202c' }}>
                {posts.length}
              </div>
              <div style={{ color: '#718096', fontSize: '0.875rem' }}>Total Posts</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '2rem' }}>
        <div className="card-header">
          <h3>Recent Activity</h3>
        </div>
        {recentPosts.length === 0 ? (
          <div className="empty-state">
            <Send size={48} />
            <h3>No posts yet</h3>
            <p>Create your first post to get started!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {recentPosts.map(post => (
              <div 
                key={post.id} 
                style={{ 
                  padding: '1rem', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', marginBottom: '0.5rem', color: '#1a202c' }}>
                    {post.content.substring(0, 100)}{post.content.length > 100 ? '...' : ''}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#718096' }}>
                    {post.platforms.join(', ')} • {new Date(post.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  {post.status === 'published' && (
                    <span className="badge badge-success">Published</span>
                  )}
                  {post.status === 'scheduled' && (
                    <span className="badge badge-info">Scheduled</span>
                  )}
                  {post.status === 'publishing' && (
                    <span className="badge badge-warning">Publishing</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
