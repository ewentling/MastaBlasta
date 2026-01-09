import { useState, useEffect } from 'react';
import axios from 'axios';
import { Sparkles, TrendingUp, Award, Copy, Plus, X } from 'lucide-react';

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

export default function ABTestingPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  const [versions, setVersions] = useState<PostVersion[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<any[]>([]);

  // Form state for creating new version
  const [newVersion, setNewVersion] = useState({
    version_name: '',
    content: '',
    hashtags: '',
    cta: ''
  });

  useEffect(() => {
    loadPosts();
  }, []);

  useEffect(() => {
    if (selectedPost) {
      loadVersions(selectedPost);
    }
  }, [selectedPost]);

  const loadPosts = async () => {
    try {
      const response = await axios.get('/api/posts');
      setPosts(response.data);
      if (response.data.length > 0 && !selectedPost) {
        setSelectedPost(response.data[0].id);
      }
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
      await axios.post('/api/post-versions', {
        original_post_id: selectedPost,
        version_name: newVersion.version_name,
        content: newVersion.content,
        platforms: selectedPostData?.platforms || ['twitter'],
        hashtags: newVersion.hashtags.split(',').map(h => h.trim()).filter(h => h),
        cta: newVersion.cta
      });

      setShowCreateModal(false);
      setNewVersion({ version_name: '', content: '', hashtags: '', cta: '' });
      loadVersions(selectedPost);
    } catch (error) {
      console.error('Error creating version:', error);
    }
  };

  const publishVersion = async (versionId: string) => {
    try {
      await axios.post(`/api/post-versions/${versionId}/publish`);
      if (selectedPost) {
        loadVersions(selectedPost);
      }
    } catch (error) {
      console.error('Error publishing version:', error);
    }
  };

  const markAsWinner = async (versionId: string) => {
    try {
      await axios.post(`/api/post-versions/${versionId}/winner`);
      if (selectedPost) {
        loadVersions(selectedPost);
      }
    } catch (error) {
      console.error('Error marking winner:', error);
    }
  };

  const toggleCompareSelection = (versionId: string) => {
    setSelectedForCompare(prev => 
      prev.includes(versionId) 
        ? prev.filter(id => id !== versionId)
        : [...prev, versionId]
    );
  };

  const compareVersions = async () => {
    if (selectedForCompare.length < 2) {
      alert('Please select at least 2 versions to compare');
      return;
    }

    try {
      const response = await axios.post('/api/ab-tests/compare', {
        version_ids: selectedForCompare
      });
      setComparisonData(response.data);
      setShowCompareModal(true);
    } catch (error) {
      console.error('Error comparing versions:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'winner': return 'text-green-400 bg-green-900/30 border-green-500/50';
      case 'testing': return 'text-blue-400 bg-blue-900/30 border-blue-500/50';
      case 'archived': return 'text-gray-400 bg-gray-900/30 border-gray-500/50';
      default: return 'text-yellow-400 bg-yellow-900/30 border-yellow-500/50';
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Sparkles className="icon" />
            A/B Testing & Post Versioning
          </h1>
          <p className="page-subtitle">Test different versions and find what works best</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {selectedForCompare.length >= 2 && (
            <button onClick={compareVersions} className="btn-primary">
              <TrendingUp size={18} />
              Compare Selected ({selectedForCompare.length})
            </button>
          )}
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <Plus size={18} />
            Create Version
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '20px' }}>
        {/* Post selection sidebar */}
        <div className="card">
          <h3 style={{ marginBottom: '15px', fontSize: '16px', fontWeight: '600' }}>Select Post</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {posts.map(post => (
              <button
                key={post.id}
                onClick={() => setSelectedPost(post.id)}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: selectedPost === post.id ? 'var(--accent-color)' : 'var(--border-color)',
                  background: selectedPost === post.id ? 'var(--accent-color-alpha)' : 'transparent',
                  color: 'var(--text-color)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '14px'
                }}
              >
                {post.content.substring(0, 50)}...
              </button>
            ))}
          </div>
        </div>

        {/* Versions grid */}
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
            {versions.map(version => (
              <div key={version.id} className="card" style={{ position: 'relative' }}>
                {version.results?.winner && (
                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: 'linear-gradient(135deg, #ffd700, #ffed4e)',
                    color: '#000',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <Award size={14} />
                    WINNER
                  </div>
                )}

                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>{version.version_name}</h3>
                    <span className={`badge ${getStatusColor(version.status)}`}>
                      {version.status}
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '12px' }}>
                    {version.content}
                  </p>
                  {version.hashtags && version.hashtags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                      {version.hashtags.map((tag, i) => (
                        <span key={i} style={{
                          background: 'var(--accent-color-alpha)',
                          color: 'var(--accent-color)',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '12px'
                        }}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {version.cta && (
                    <p style={{ fontSize: '13px', color: 'var(--accent-color)', marginTop: '8px' }}>
                      CTA: {version.cta}
                    </p>
                  )}
                </div>

                {version.results && version.status === 'testing' && (
                  <div style={{
                    background: 'var(--bg-secondary)',
                    padding: '12px',
                    borderRadius: '8px',
                    marginBottom: '12px'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                      <div>
                        <div style={{ color: 'var(--text-secondary)' }}>Impressions</div>
                        <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-color)' }}>
                          {version.results.impressions.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-secondary)' }}>Engagement</div>
                        <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-color)' }}>
                          {version.results.engagement}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-secondary)' }}>Engagement Rate</div>
                        <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--accent-color)' }}>
                          {version.results.engagement_rate}%
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-secondary)' }}>Clicks</div>
                        <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-color)' }}>
                          {version.results.clicks}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {version.status === 'draft' && (
                    <button onClick={() => publishVersion(version.id)} className="btn-secondary">
                      Publish for Testing
                    </button>
                  )}
                  {version.status === 'testing' && !version.results?.winner && (
                    <button onClick={() => markAsWinner(version.id)} className="btn-primary" style={{ fontSize: '13px' }}>
                      <Award size={14} />
                      Mark as Winner
                    </button>
                  )}
                  <button
                    onClick={() => toggleCompareSelection(version.id)}
                    className={selectedForCompare.includes(version.id) ? 'btn-primary' : 'btn-secondary'}
                    style={{ fontSize: '13px' }}
                  >
                    {selectedForCompare.includes(version.id) ? '✓ Selected' : 'Select to Compare'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {versions.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
              <Sparkles size={48} style={{ color: 'var(--accent-color)', margin: '0 auto 20px' }} />
              <h3 style={{ marginBottom: '10px' }}>No versions yet</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Create different versions to A/B test your content
              </p>
              <button onClick={() => setShowCreateModal(true)} className="btn-primary">
                Create First Version
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create Version Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Version</h2>
              <button onClick={() => setShowCreateModal(false)} className="modal-close">
                <X size={20} />
              </button>
            </div>
            <div className="modal-content">
              <div className="form-group">
                <label>Version Name</label>
                <input
                  type="text"
                  value={newVersion.version_name}
                  onChange={(e) => setNewVersion({...newVersion, version_name: e.target.value})}
                  placeholder="e.g., Version A - Emotional Hook"
                  className="input"
                />
              </div>
              <div className="form-group">
                <label>Content</label>
                <textarea
                  value={newVersion.content}
                  onChange={(e) => setNewVersion({...newVersion, content: e.target.value})}
                  placeholder="Write your post content..."
                  className="textarea"
                  rows={4}
                />
              </div>
              <div className="form-group">
                <label>Hashtags (comma-separated)</label>
                <input
                  type="text"
                  value={newVersion.hashtags}
                  onChange={(e) => setNewVersion({...newVersion, hashtags: e.target.value})}
                  placeholder="marketing, socialmedia, growth"
                  className="input"
                />
              </div>
              <div className="form-group">
                <label>Call-to-Action (CTA)</label>
                <input
                  type="text"
                  value={newVersion.cta}
                  onChange={(e) => setNewVersion({...newVersion, cta: e.target.value})}
                  placeholder="e.g., Click the link to learn more"
                  className="input"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowCreateModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={createVersion} className="btn-primary">
                Create Version
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compare Modal */}
      {showCompareModal && (
        <div className="modal-overlay" onClick={() => setShowCompareModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1000px' }}>
            <div className="modal-header">
              <h2>Version Comparison</h2>
              <button onClick={() => setShowCompareModal(false)} className="modal-close">
                <X size={20} />
              </button>
            </div>
            <div className="modal-content">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Metric</th>
                      {comparisonData.map((item, i) => (
                        <th key={i} style={{ padding: '12px', textAlign: 'center' }}>
                          {item.version.version_name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px', fontWeight: '600' }}>Impressions</td>
                      {comparisonData.map((item, i) => (
                        <td key={i} style={{ padding: '12px', textAlign: 'center' }}>
                          {item.results?.impressions?.toLocaleString() || 'N/A'}
                        </td>
                      ))}
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px', fontWeight: '600' }}>Engagement</td>
                      {comparisonData.map((item, i) => (
                        <td key={i} style={{ padding: '12px', textAlign: 'center' }}>
                          {item.results?.engagement || 'N/A'}
                        </td>
                      ))}
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px', fontWeight: '600' }}>Engagement Rate</td>
                      {comparisonData.map((item, i) => (
                        <td key={i} style={{ padding: '12px', textAlign: 'center', fontWeight: '700', color: 'var(--accent-color)' }}>
                          {item.results?.engagement_rate ? `${item.results.engagement_rate}%` : 'N/A'}
                        </td>
                      ))}
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px', fontWeight: '600' }}>Clicks</td>
                      {comparisonData.map((item, i) => (
                        <td key={i} style={{ padding: '12px', textAlign: 'center' }}>
                          {item.results?.clicks || 'N/A'}
                        </td>
                      ))}
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px', fontWeight: '600' }}>Shares</td>
                      {comparisonData.map((item, i) => (
                        <td key={i} style={{ padding: '12px', textAlign: 'center' }}>
                          {item.results?.shares || 'N/A'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ padding: '12px', fontWeight: '600' }}>Comments</td>
                      {comparisonData.map((item, i) => (
                        <td key={i} style={{ padding: '12px', textAlign: 'center' }}>
                          {item.results?.comments || 'N/A'}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
