import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Sparkles, TrendingUp, Award, Plus, X, ChevronDown, ChevronUp,
  Lightbulb, BarChart2, BookOpen, Clock, CheckCircle, Circle,
  Info, Target, Zap
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface PostVersion {
  id: string;
  original_post_id: string;
  version_name: string;
  content: string;
  platforms: string[];
  hashtags: string[];
  cta: string;
  created_at: string;
  status: string;
  results?: {
    impressions: number;
    engagement: number;
    clicks: number;
    shares: number;
    comments: number;
    likes: number;
    engagement_rate: number;
    winner: boolean;
  };
}

const PLATFORMS = ['twitter', 'facebook', 'instagram', 'linkedin', 'threads', 'bluesky', 'youtube', 'reddit', 'tiktok', 'pinterest'];

const STATUS_STEPS = [
  { key: 'draft', label: 'Draft', icon: Circle, desc: 'Version created, not yet live' },
  { key: 'testing', label: 'Testing', icon: BarChart2, desc: 'Published and collecting data' },
  { key: 'winner', label: 'Winner', icon: Award, desc: 'Best performer — use this one!' },
];

const AB_TIPS = [
  { icon: Target, text: 'Test one variable at a time (headline, CTA, tone, length, emoji use)' },
  { icon: Clock, text: 'Run tests for at least 48–72 hours to gather statistically meaningful data' },
  { icon: Zap, text: 'Aim for at least 100 impressions per version before declaring a winner' },
  { icon: CheckCircle, text: 'Apply the winning version to future posts and iterate from there' },
];

function MetricBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontWeight: '600', color: 'var(--text-color)' }}>{value.toLocaleString()}</span>
      </div>
      <div style={{ height: '6px', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px', transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

export default function ABTestingPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  const [versions, setVersions] = useState<PostVersion[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<any[]>([]);

  const [newVersion, setNewVersion] = useState({
    version_name: '',
    content: '',
    hashtags: '',
    cta: '',
    platforms: [] as string[],
  });

  useEffect(() => { loadPosts(); }, []);
  useEffect(() => { if (selectedPost) loadVersions(selectedPost); }, [selectedPost]);

  const loadPosts = async () => {
    try {
      const response = await axios.get('/api/posts');
      const postsData = response.data.posts || response.data;
      setPosts(postsData);
      if (postsData.length > 0 && !selectedPost) setSelectedPost(postsData[0].id);
    } catch (error) {
      console.error('Error loading posts:', error);
    }
  };

  const loadVersions = async (postId: string) => {
    try {
      const response = await axios.get(`/api/post-versions/${postId}`);
      setVersions(response.data);
    } catch (error) {
      console.error('Error loading versions:', error);
    }
  };

  const createVersion = async () => {
    if (!selectedPost) return;
    try {
      const selectedPostData = posts.find(p => p.id === selectedPost);
      const platforms = newVersion.platforms.length > 0
        ? newVersion.platforms
        : (selectedPostData?.platforms || ['twitter']);
      await axios.post('/api/post-versions', {
        original_post_id: selectedPost,
        version_name: newVersion.version_name,
        content: newVersion.content,
        platforms,
        hashtags: newVersion.hashtags.split(',').map(h => h.trim()).filter(h => h),
        cta: newVersion.cta,
      });
      setShowCreateModal(false);
      setNewVersion({ version_name: '', content: '', hashtags: '', cta: '', platforms: [] });
      loadVersions(selectedPost);
    } catch (error) {
      console.error('Error creating version:', error);
    }
  };

  const publishVersion = async (versionId: string) => {
    try {
      await axios.post(`/api/post-versions/${versionId}/publish`);
      if (selectedPost) loadVersions(selectedPost);
    } catch (error) {
      console.error('Error publishing version:', error);
    }
  };

  const markAsWinner = async (versionId: string) => {
    try {
      await axios.post(`/api/post-versions/${versionId}/winner`);
      if (selectedPost) loadVersions(selectedPost);
    } catch (error) {
      console.error('Error marking winner:', error);
    }
  };

  const toggleCompareSelection = (versionId: string) => {
    setSelectedForCompare(prev =>
      prev.includes(versionId) ? prev.filter(id => id !== versionId) : [...prev, versionId]
    );
  };

  const compareVersions = async () => {
    if (selectedForCompare.length < 2) return;
    try {
      const response = await axios.post('/api/ab-tests/compare', { version_ids: selectedForCompare });
      setComparisonData(response.data);
      setShowCompareModal(true);
    } catch (error) {
      console.error('Error comparing versions:', error);
    }
  };

  const togglePlatform = (p: string) => {
    setNewVersion(prev => ({
      ...prev,
      platforms: prev.platforms.includes(p) ? prev.platforms.filter(x => x !== p) : [...prev.platforms, p],
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'winner': return { text: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)' };
      case 'testing': return { text: '#3b82f6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.4)' };
      case 'archived': return { text: '#6b7280', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.4)' };
      default: return { text: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.4)' };
    }
  };

  // Compute per-metric maxes for relative bar widths
  const maxes = {
    impressions: Math.max(1, ...versions.map(v => v.results?.impressions || 0)),
    engagement: Math.max(1, ...versions.map(v => v.results?.engagement || 0)),
    clicks: Math.max(1, ...versions.map(v => v.results?.clicks || 0)),
    shares: Math.max(1, ...versions.map(v => v.results?.shares || 0)),
  };

  // Recharts data for compare modal
  const chartData = comparisonData.map(item => ({
    name: item.version?.version_name || 'Version',
    Impressions: item.results?.impressions || 0,
    Engagement: item.results?.engagement || 0,
    Clicks: item.results?.clicks || 0,
    Shares: item.results?.shares || 0,
  }));

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Sparkles className="icon" />
            A/B Testing &amp; Post Versioning
          </h1>
          <p className="page-subtitle">Create variants, measure what works, and apply the winning formula</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {selectedForCompare.length >= 2 && (
            <button onClick={compareVersions} className="btn btn-primary">
              <TrendingUp size={16} />
              Compare ({selectedForCompare.length})
            </button>
          )}
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
            <Plus size={16} />
            Create Version
          </button>
        </div>
      </div>

      {/* How it works guide */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.08))',
        border: '1px solid rgba(99,102,241,0.25)',
        borderRadius: '12px',
        marginBottom: '24px',
        overflow: 'hidden',
      }}>
        <button
          onClick={() => setShowGuide(g => !g)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px', background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-color)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '600', fontSize: '15px' }}>
            <BookOpen size={18} style={{ color: '#818cf8' }} />
            How A/B Testing Works
          </div>
          {showGuide ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {showGuide && (
          <div style={{ padding: '0 20px 20px' }}>
            {/* Status lifecycle */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {STATUS_STEPS.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '180px' }}>
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      background: 'var(--bg-secondary)', borderRadius: '10px',
                      padding: '12px 16px', flex: 1, textAlign: 'center',
                    }}>
                      <Icon size={22} style={{ color: '#818cf8', marginBottom: '6px' }} />
                      <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '4px' }}>{step.label}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{step.desc}</div>
                    </div>
                    {i < STATUS_STEPS.length - 1 && (
                      <div style={{ fontSize: '20px', color: 'var(--text-secondary)', flexShrink: 0 }}>→</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Tips grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
              {AB_TIPS.map((tip, i) => {
                const Icon = tip.icon;
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                    background: 'var(--bg-secondary)', borderRadius: '8px', padding: '10px 14px',
                  }}>
                    <Icon size={16} style={{ color: '#818cf8', flexShrink: 0, marginTop: '1px' }} />
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{tip.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '20px' }}>
        {/* Post selection sidebar */}
        <div>
          <div className="card" style={{ marginBottom: '16px' }}>
            <h3 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Select Base Post
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {posts.length === 0 && (
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '8px 0' }}>
                  No posts yet. Publish a post first to test variations.
                </p>
              )}
              {posts.map(post => (
                <button
                  key={post.id}
                  onClick={() => setSelectedPost(post.id)}
                  style={{
                    padding: '10px 12px', borderRadius: '8px', border: '1px solid',
                    borderColor: selectedPost === post.id ? '#818cf8' : 'var(--border-color)',
                    background: selectedPost === post.id ? 'rgba(99,102,241,0.12)' : 'transparent',
                    color: 'var(--text-color)', cursor: 'pointer', textAlign: 'left', fontSize: '13px',
                    lineHeight: '1.4',
                  }}
                >
                  {post.content?.substring(0, 60)}{post.content?.length > 60 ? '…' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Tips card */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Lightbulb size={16} style={{ color: '#fbbf24' }} />
              <span style={{ fontWeight: '600', fontSize: '14px' }}>What to Test</span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                '📝 Different headlines or opening hooks',
                '😀 With vs. without emojis',
                '#️⃣ Different hashtag sets',
                '📣 Different calls-to-action',
                '📏 Short copy vs. long copy',
                '🖼️ Image vs. no image',
              ].map((tip, i) => (
                <li key={i} style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Versions grid */}
        <div>
          {versions.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
              <Sparkles size={48} style={{ color: '#818cf8', margin: '0 auto 16px' }} />
              <h3 style={{ marginBottom: '8px', fontSize: '20px' }}>No versions yet</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Create at least 2 versions to run an A/B test.
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>
                Example: Version A uses an emotional hook; Version B uses a data-driven headline.
              </p>
              <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
                Create First Version
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
              {versions.map(version => {
                const sc = getStatusColor(version.status);
                const hasResults = version.results && version.status === 'testing';
                return (
                  <div key={version.id} className="card" style={{ position: 'relative' }}>
                    {version.results?.winner && (
                      <div style={{
                        position: 'absolute', top: '12px', right: '12px',
                        background: 'linear-gradient(135deg, #f59e0b, #fcd34d)',
                        color: '#1a1a1a', padding: '4px 12px', borderRadius: '20px',
                        fontSize: '11px', fontWeight: '800', letterSpacing: '0.05em',
                        display: 'flex', alignItems: 'center', gap: '4px',
                      }}>
                        <Award size={12} /> WINNER
                      </div>
                    )}

                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', paddingRight: '80px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>{version.version_name}</h3>
                        <span style={{
                          padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
                          color: sc.text, background: sc.bg, border: `1px solid ${sc.border}`,
                        }}>
                          {version.status}
                        </span>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5', marginBottom: '10px' }}>
                        {version.content}
                      </p>
                      {version.hashtags?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
                          {version.hashtags.map((tag, i) => (
                            <span key={i} style={{
                              background: 'rgba(99,102,241,0.12)', color: '#818cf8',
                              padding: '3px 9px', borderRadius: '12px', fontSize: '11px',
                            }}>#{tag}</span>
                          ))}
                        </div>
                      )}
                      {version.cta && (
                        <p style={{ fontSize: '12px', color: '#818cf8', marginTop: '4px' }}>
                          CTA: {version.cta}
                        </p>
                      )}
                    </div>

                    {hasResults && (
                      <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                          <BarChart2 size={14} style={{ color: '#818cf8' }} />
                          <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                            Engagement Rate:{' '}
                            <span style={{ color: '#818cf8', fontSize: '14px' }}>{version.results!.engagement_rate}%</span>
                          </span>
                        </div>
                        <MetricBar label="Impressions" value={version.results!.impressions} max={maxes.impressions} color="#3b82f6" />
                        <MetricBar label="Engagement" value={version.results!.engagement} max={maxes.engagement} color="#10b981" />
                        <MetricBar label="Clicks" value={version.results!.clicks} max={maxes.clicks} color="#f59e0b" />
                        <MetricBar label="Shares" value={version.results!.shares} max={maxes.shares} color="#8b5cf6" />
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {version.status === 'draft' && (
                        <button onClick={() => publishVersion(version.id)} className="btn btn-secondary" style={{ fontSize: '12px' }}>
                          Publish for Testing
                        </button>
                      )}
                      {version.status === 'testing' && !version.results?.winner && (
                        <button onClick={() => markAsWinner(version.id)} className="btn btn-primary" style={{ fontSize: '12px' }}>
                          <Award size={13} /> Mark Winner
                        </button>
                      )}
                      <button
                        onClick={() => toggleCompareSelection(version.id)}
                        className={selectedForCompare.includes(version.id) ? 'btn btn-primary' : 'btn btn-secondary'}
                        style={{ fontSize: '12px' }}
                      >
                        {selectedForCompare.includes(version.id) ? '✓ Selected' : 'Select'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create Version Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h2>Create New Version</h2>
              <button onClick={() => setShowCreateModal(false)} className="modal-close"><X size={20} /></button>
            </div>
            <div className="modal-content">
              {/* What to vary tip */}
              <div style={{
                background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: '8px', padding: '10px 14px', marginBottom: '16px',
                display: 'flex', alignItems: 'flex-start', gap: '8px',
              }}>
                <Info size={15} style={{ color: '#818cf8', flexShrink: 0, marginTop: '1px' }} />
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Change <strong>one thing</strong> at a time — headline, CTA, hashtags, or tone — so you know exactly what drove the difference.
                </p>
              </div>

              <div className="form-group">
                <label>Version Name <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: '12px' }}>(e.g. "Version A – Emotional Hook")</span></label>
                <input
                  type="text"
                  value={newVersion.version_name}
                  onChange={e => setNewVersion({ ...newVersion, version_name: e.target.value })}
                  placeholder="Version A – Emotional Hook"
                  className="input"
                />
              </div>
              <div className="form-group">
                <label>Content</label>
                <textarea
                  value={newVersion.content}
                  onChange={e => setNewVersion({ ...newVersion, content: e.target.value })}
                  placeholder="Write your post content variant..."
                  className="textarea"
                  rows={5}
                />
                <div style={{ textAlign: 'right', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {newVersion.content.length} characters
                </div>
              </div>
              <div className="form-group">
                <label>Hashtags <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: '12px' }}>(comma-separated)</span></label>
                <input
                  type="text"
                  value={newVersion.hashtags}
                  onChange={e => setNewVersion({ ...newVersion, hashtags: e.target.value })}
                  placeholder="marketing, growth, socialmedia"
                  className="input"
                />
              </div>
              <div className="form-group">
                <label>Call-to-Action (CTA)</label>
                <input
                  type="text"
                  value={newVersion.cta}
                  onChange={e => setNewVersion({ ...newVersion, cta: e.target.value })}
                  placeholder="Click the link to learn more"
                  className="input"
                />
              </div>
              <div className="form-group">
                <label>Platforms <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: '12px' }}>(defaults to base post platforms)</span></label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {PLATFORMS.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePlatform(p)}
                      style={{
                        padding: '5px 14px', borderRadius: '20px', border: '1px solid',
                        borderColor: newVersion.platforms.includes(p) ? '#818cf8' : 'var(--border-color)',
                        background: newVersion.platforms.includes(p) ? 'rgba(99,102,241,0.12)' : 'transparent',
                        color: newVersion.platforms.includes(p) ? '#818cf8' : 'var(--text-secondary)',
                        cursor: 'pointer', fontSize: '12px', textTransform: 'capitalize',
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowCreateModal(false)} className="btn btn-secondary">Cancel</button>
              <button onClick={createVersion} className="btn btn-primary" disabled={!newVersion.version_name || !newVersion.content}>
                Create Version
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compare Modal with recharts */}
      {showCompareModal && (
        <div className="modal-overlay" onClick={() => setShowCompareModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px' }}>
            <div className="modal-header">
              <h2>Version Comparison</h2>
              <button onClick={() => setShowCompareModal(false)} className="modal-close"><X size={20} /></button>
            </div>
            <div className="modal-content">
              {/* Bar Chart */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-secondary)' }}>
                  Performance Overview
                </h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                    <Tooltip
                      contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                      labelStyle={{ fontWeight: '700' }}
                    />
                    <Legend />
                    <Bar dataKey="Impressions" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Engagement" fill="#10b981" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Clicks" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Shares" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Comparison table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '13px' }}>Metric</th>
                      {comparisonData.map((item, i) => (
                        <th key={i} style={{ padding: '10px 12px', textAlign: 'center', fontSize: '13px' }}>
                          {item.version?.version_name}
                          {item.results?.winner && <span style={{ marginLeft: '6px', color: '#f59e0b' }}>🏆</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { key: 'impressions', label: 'Impressions' },
                      { key: 'engagement', label: 'Engagement' },
                      { key: 'engagement_rate', label: 'Engagement Rate', fmt: (v: number) => `${v}%` },
                      { key: 'clicks', label: 'Clicks' },
                      { key: 'shares', label: 'Shares' },
                      { key: 'comments', label: 'Comments' },
                      { key: 'likes', label: 'Likes' },
                    ].map(({ key, label, fmt }) => {
                      const vals = comparisonData.map(item => item.results?.[key] ?? null);
                      const maxVal = Math.max(0, ...vals.filter((v): v is number => v !== null));
                      return (
                        <tr key={key} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: '600', fontSize: '13px' }}>{label}</td>
                          {comparisonData.map((item, i) => {
                            const val = item.results?.[key];
                            const isMax = val !== null && val === maxVal && maxVal > 0;
                            return (
                              <td key={i} style={{
                                padding: '10px 12px', textAlign: 'center', fontSize: '14px',
                                fontWeight: isMax ? '700' : '400',
                                color: isMax ? '#10b981' : 'var(--text-color)',
                              }}>
                                {val != null ? (fmt ? fmt(val) : val.toLocaleString()) : 'N/A'}
                                {isMax && <span style={{ marginLeft: '4px' }}>↑</span>}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{
                marginTop: '16px', padding: '12px 16px', background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.25)', borderRadius: '8px',
                fontSize: '13px', color: 'var(--text-secondary)',
              }}>
                <strong style={{ color: '#10b981' }}>📊 Reading the results:</strong> Green numbers &amp; ↑ indicate the best performer per metric. Focus on engagement rate (engagement ÷ impressions) as the primary signal.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
