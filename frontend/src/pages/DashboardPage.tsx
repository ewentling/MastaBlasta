import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { postsApi, accountsApi } from '../api';
import { BarChart3, Users, Send, Calendar, Plus, Sparkles, TrendingUp, Zap, Activity } from 'lucide-react';
import { useEffect, useState } from 'react';

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
    { icon: Plus, label: 'Create Post', path: '/post', color: '#7c3aed' },
    { icon: Calendar, label: 'Schedule', path: '/scheduled', color: '#10b981' },
    { icon: Users, label: 'Accounts', path: '/accounts', color: '#f59e0b' },
    { icon: Sparkles, label: 'AI Assistant', path: '/chatbot', color: '#8b5cf6' },
    { icon: TrendingUp, label: 'Analytics', path: '/analytics', color: '#3b82f6' },
  ];

  interface StatCardProps {
    icon: React.ComponentType<{ size?: number }>;
    value: number;
    label: string;
    gradient: string;
  }

  const AnimatedNumber = ({ value }: { value: number }) => {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
      const duration = 1000;
      const steps = 30;
      const stepValue = value / steps;
      const stepDuration = duration / steps;
      let currentStep = 0;

      const timer = setInterval(() => {
        currentStep++;
        if (currentStep <= steps) {
          setDisplayValue(Math.floor(stepValue * currentStep));
        } else {
          setDisplayValue(value);
          clearInterval(timer);
        }
      }, stepDuration);

      return () => clearInterval(timer);
    }, [value]);

    return <>{displayValue}</>;
  };

  const StatCard = ({ icon: Icon, value, label, gradient }: StatCardProps) => (
    <article className="card" role="region" aria-label={label}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ 
          background: gradient,
          padding: '1rem', 
          borderRadius: '1rem',
          color: 'white',
          boxShadow: `0 4px 12px ${gradient.match(/#[0-9a-f]{6}/i)?.[0]}40`,
          transition: 'all 0.3s var(--ease-smooth)'
        }}>
          <Icon size={28} />
        </div>
        <div>
          <div style={{ 
            fontSize: '2.5rem', 
            fontWeight: '700', 
            color: 'var(--color-textPrimary)',
            letterSpacing: '-0.03em',
            lineHeight: '1'
          }}>
            <AnimatedNumber value={value} />
          </div>
          <div style={{ 
            color: 'var(--color-textSecondary)', 
            fontSize: '0.9375rem',
            fontWeight: '500',
            marginTop: '0.25rem'
          }}>{label}</div>
        </div>
      </div>
    </article>
  );

  return (
    <div role="main">
      <header className="page-header">
        <h2>Dashboard</h2>
        <p>Overview of your social media posting activity</p>
      </header>

      {/* Bento Grid Layout */}
      <div className="bento-grid bento-grid-4">
        
        {/* Quick Actions - Full width featured card */}
        <section className="card bento-item-2x" aria-labelledby="quick-actions-heading">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <Zap size={22} style={{ color: 'var(--color-accentPrimary)' }} />
              <h3 id="quick-actions-heading">Quick Actions</h3>
            </div>
          </div>
          <nav style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
            gap: '0.875rem' 
          }}>
            {quickActions.map((action) => (
              <button
                key={action.label}
                className="btn btn-secondary btn-ripple"
                onClick={() => navigate(action.path)}
                aria-label={action.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '1.25rem 1rem',
                  height: 'auto',
                }}
              >
                <div style={{ 
                  background: `linear-gradient(135deg, ${action.color} 0%, ${action.color}dd 100%)`,
                  padding: '0.875rem',
                  borderRadius: '0.875rem',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 4px 12px ${action.color}40`,
                  transition: 'all 0.3s var(--ease-smooth)'
                }}>
                  <action.icon size={24} />
                </div>
                <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>{action.label}</span>
              </button>
            ))}
          </nav>
        </section>

        {/* Stats Cards */}
        <StatCard 
          icon={Users} 
          value={activeAccounts} 
          label="Active Accounts"
          gradient="linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)"
        />

        <StatCard 
          icon={Send} 
          value={publishedPosts} 
          label="Published"
          gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
        />

        <StatCard 
          icon={Calendar} 
          value={scheduledPosts} 
          label="Scheduled"
          gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
        />

        <StatCard 
          icon={BarChart3} 
          value={posts.length} 
          label="Total Posts"
          gradient="linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
        />

        {/* Recent Activity - Takes 2 columns */}
        <section className="card bento-item-2x" aria-labelledby="recent-activity-heading">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <Activity size={22} style={{ color: 'var(--color-accentPrimary)' }} />
              <h3 id="recent-activity-heading">Recent Activity</h3>
            </div>
          </div>
          {recentPosts.length === 0 ? (
            <div className="empty-state">
              <Send size={56} />
              <h3>No posts yet</h3>
              <p>Create your first post to get started!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {recentPosts.map(post => (
                <article 
                  key={post.id} 
                  style={{ 
                    padding: '1rem', 
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '0.75rem',
                    border: '1px solid var(--glass-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem',
                    transition: 'all 0.2s var(--ease-smooth)',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--glass-bg-hover)';
                    e.currentTarget.style.transform = 'translateX(4px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--glass-bg)';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontWeight: '600', 
                      marginBottom: '0.5rem', 
                      color: 'var(--color-textPrimary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {post.content.substring(0, 100)}{post.content.length > 100 ? '...' : ''}
                    </div>
                    <div style={{ 
                      fontSize: '0.875rem', 
                      color: 'var(--color-textSecondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <span>{post.platforms.join(', ')}</span>
                      <span>•</span>
                      <time dateTime={post.created_at}>
                        {new Date(post.created_at).toLocaleDateString()}
                      </time>
                    </div>
                  </div>
                  <div style={{ flexShrink: 0 }}>
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
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
