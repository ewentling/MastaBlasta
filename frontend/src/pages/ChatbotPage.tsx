import { useState, useEffect } from 'react';
import axios from 'axios';
import { MessageSquare, Plus, X, Sparkles, BarChart3, TrendingUp } from 'lucide-react';

interface ResponseTemplate {
  id: string;
  name: string;
  template: string;
  category: string;
  platforms: string[];
  sentiment: string;
  keywords: string[];
  auto_reply: boolean;
  created_at: string;
}

interface ChatbotInteraction {
  id: string;
  platform: string;
  message: string;
  response: string;
  sentiment: string;
  auto_replied: boolean;
  template_used?: string;
  timestamp: string;
  user: string;
}

interface ChatbotStats {
  total_interactions: number;
  auto_replies: number;
  manual_replies: number;
  auto_reply_rate: number;
  platform_breakdown: Record<string, number>;
  sentiment_breakdown: Record<string, number>;
  avg_response_time_seconds: number;
}

export default function ChatbotPage() {
  const [activeTab, setActiveTab] = useState<'templates' | 'interactions' | 'stats'>('templates');
  const [templates, setTemplates] = useState<ResponseTemplate[]>([]);
  const [interactions, setInteractions] = useState<ChatbotInteraction[]>([]);
  const [stats, setStats] = useState<ChatbotStats | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [testPlatform, setTestPlatform] = useState('twitter');
  const [suggestions, setSuggestions] = useState<ResponseTemplate[]>([]);

  // Form state for creating new template
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    template: '',
    category: 'general',
    platforms: ['twitter', 'facebook', 'instagram', 'linkedin'],
    sentiment: 'neutral',
    keywords: '',
    auto_reply: false
  });

  useEffect(() => {
    loadTemplates();
    loadInteractions();
    loadStats();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await axios.get('/api/response-templates');
      setTemplates(response.data);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const loadInteractions = async () => {
    try {
      const response = await axios.get('/api/chatbot/interactions?per_page=50');
      setInteractions(response.data.interactions || []);
    } catch (error) {
      console.error('Error loading interactions:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await axios.get('/api/chatbot/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const createTemplate = async () => {
    try {
      await axios.post('/api/response-templates', {
        ...newTemplate,
        keywords: newTemplate.keywords.split(',').map(k => k.trim()).filter(k => k)
      });

      setShowCreateModal(false);
      setNewTemplate({
        name: '',
        template: '',
        category: 'general',
        platforms: ['twitter', 'facebook', 'instagram', 'linkedin'],
        sentiment: 'neutral',
        keywords: '',
        auto_reply: false
      });
      loadTemplates();
    } catch (error) {
      console.error('Error creating template:', error);
    }
  };

  const deleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await axios.delete(`/api/response-templates/${templateId}`);
      loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  const getSuggestions = async () => {
    try {
      const response = await axios.post('/api/chatbot/suggest-response', {
        message: testMessage,
        platform: testPlatform,
        sentiment: 'neutral'
      });
      setSuggestions(response.data.suggestions || []);
    } catch (error) {
      console.error('Error getting suggestions:', error);
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-400 bg-green-900/30 border-green-500/50';
      case 'negative': return 'text-red-400 bg-red-900/30 border-red-500/50';
      case 'urgent': return 'text-orange-400 bg-orange-900/30 border-orange-500/50';
      default: return 'text-blue-400 bg-blue-900/30 border-blue-500/50';
    }
  };

  const togglePlatform = (platform: string) => {
    setNewTemplate(prev => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter(p => p !== platform)
        : [...prev.platforms, platform]
    }));
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <MessageSquare className="icon" />
            Automated Response Templates & Chatbot
          </h1>
          <p className="page-subtitle">AI-powered response suggestions and automated replies</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setShowSuggestModal(true)} className="btn-secondary">
            <Sparkles size={18} />
            Test Suggestions
          </button>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <Plus size={18} />
            Create Template
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          Templates
        </button>
        <button
          className={`tab ${activeTab === 'interactions' ? 'active' : ''}`}
          onClick={() => setActiveTab('interactions')}
        >
          Interactions
        </button>
        <button
          className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          Statistics
        </button>
      </div>

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
          {templates.map(template => (
            <div key={template.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>{template.name}</h3>
                <button onClick={() => deleteTemplate(template.id)} className="icon-button" style={{ color: 'var(--danger-color)' }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <div className={`badge ${getSentimentColor(template.sentiment)}`} style={{ marginBottom: '8px' }}>
                  {template.sentiment}
                </div>
                <div style={{
                  background: 'var(--bg-secondary)',
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  marginBottom: '12px'
                }}>
                  {template.template}
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                {template.platforms.map(platform => (
                  <span key={platform} style={{
                    background: 'var(--accent-color-alpha)',
                    color: 'var(--accent-color)',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    textTransform: 'capitalize'
                  }}>
                    {platform}
                  </span>
                ))}
              </div>

              {template.keywords && template.keywords.length > 0 && (
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Keywords: {template.keywords.join(', ')}
                </div>
              )}

              {template.auto_reply && (
                <div style={{
                  marginTop: '10px',
                  padding: '8px',
                  background: 'var(--success-color-alpha)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: 'var(--success-color)',
                  fontWeight: '600'
                }}>
                  ✓ Auto-reply enabled
                </div>
              )}
            </div>
          ))}

          {templates.length === 0 && (
            <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px' }}>
              <MessageSquare size={48} style={{ color: 'var(--accent-color)', margin: '0 auto 20px' }} />
              <h3 style={{ marginBottom: '10px' }}>No templates yet</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Create response templates to automate customer service
              </p>
              <button onClick={() => setShowCreateModal(true)} className="btn-primary">
                Create First Template
              </button>
            </div>
          )}
        </div>
      )}

      {/* Interactions Tab */}
      {activeTab === 'interactions' && (
        <div className="card">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Time</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Platform</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>User</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Message</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Response</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Type</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Sentiment</th>
                </tr>
              </thead>
              <tbody>
                {interactions.map(interaction => (
                  <tr key={interaction.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {new Date(interaction.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span className="badge">{interaction.platform}</span>
                    </td>
                    <td style={{ padding: '12px' }}>{interaction.user}</td>
                    <td style={{ padding: '12px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {interaction.message}
                    </td>
                    <td style={{ padding: '12px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {interaction.response}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span className={`badge ${interaction.auto_replied ? 'bg-green-900/30 text-green-400' : 'bg-blue-900/30 text-blue-400'}`}>
                        {interaction.auto_replied ? 'Auto' : 'Manual'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span className={`badge ${getSentimentColor(interaction.sentiment)}`}>
                        {interaction.sentiment}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {interactions.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                No interactions recorded yet
              </div>
            )}
          </div>
        </div>
      )}

      {/* Statistics Tab */}
      {activeTab === 'stats' && stats && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
            <div className="stat-card">
              <div className="stat-label">Total Interactions</div>
              <div className="stat-value">{stats.total_interactions.toLocaleString()}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Auto Replies</div>
              <div className="stat-value">{stats.auto_replies.toLocaleString()}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Auto Reply Rate</div>
              <div className="stat-value" style={{ color: 'var(--success-color)' }}>
                {stats.auto_reply_rate}%
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg Response Time</div>
              <div className="stat-value">{stats.avg_response_time_seconds}s</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="card">
              <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <BarChart3 size={20} />
                Platform Breakdown
              </h3>
              {Object.entries(stats.platform_breakdown).map(([platform, count]) => (
                <div key={platform} style={{ marginBottom: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ textTransform: 'capitalize' }}>{platform}</span>
                    <span style={{ fontWeight: '600' }}>{count}</span>
                  </div>
                  <div style={{
                    height: '8px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${(count / stats.total_interactions) * 100}%`,
                      background: 'var(--accent-gradient)',
                      borderRadius: '4px'
                    }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <TrendingUp size={20} />
                Sentiment Breakdown
              </h3>
              {Object.entries(stats.sentiment_breakdown).map(([sentiment, count]) => (
                <div key={sentiment} style={{ marginBottom: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ textTransform: 'capitalize' }}>{sentiment}</span>
                    <span style={{ fontWeight: '600' }}>{count}</span>
                  </div>
                  <div style={{
                    height: '8px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${(count / stats.total_interactions) * 100}%`,
                      background: getSentimentColor(sentiment).includes('green') ? '#10b981' : 
                                 getSentimentColor(sentiment).includes('red') ? '#ef4444' :
                                 getSentimentColor(sentiment).includes('orange') ? '#f59e0b' : '#3b82f6',
                      borderRadius: '4px'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create Template Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Response Template</h2>
              <button onClick={() => setShowCreateModal(false)} className="modal-close">
                <X size={20} />
              </button>
            </div>
            <div className="modal-content">
              <div className="form-group">
                <label>Template Name</label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                  placeholder="e.g., Thank You Response"
                  className="input"
                />
              </div>
              <div className="form-group">
                <label>Response Template</label>
                <textarea
                  value={newTemplate.template}
                  onChange={(e) => setNewTemplate({...newTemplate, template: e.target.value})}
                  placeholder="Thank you for reaching out! We'll get back to you shortly."
                  className="textarea"
                  rows={4}
                />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select
                  value={newTemplate.category}
                  onChange={(e) => setNewTemplate({...newTemplate, category: e.target.value})}
                  className="input"
                >
                  <option value="general">General</option>
                  <option value="support">Support</option>
                  <option value="sales">Sales</option>
                  <option value="feedback">Feedback</option>
                  <option value="complaint">Complaint</option>
                </select>
              </div>
              <div className="form-group">
                <label>Sentiment</label>
                <select
                  value={newTemplate.sentiment}
                  onChange={(e) => setNewTemplate({...newTemplate, sentiment: e.target.value})}
                  className="input"
                >
                  <option value="neutral">Neutral</option>
                  <option value="positive">Positive</option>
                  <option value="negative">Negative</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="form-group">
                <label>Platforms</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {['twitter', 'facebook', 'instagram', 'linkedin'].map(platform => (
                    <label key={platform} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={newTemplate.platforms.includes(platform)}
                        onChange={() => togglePlatform(platform)}
                      />
                      <span style={{ textTransform: 'capitalize' }}>{platform}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Keywords (comma-separated)</label>
                <input
                  type="text"
                  value={newTemplate.keywords}
                  onChange={(e) => setNewTemplate({...newTemplate, keywords: e.target.value})}
                  placeholder="help, support, question"
                  className="input"
                />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={newTemplate.auto_reply}
                    onChange={(e) => setNewTemplate({...newTemplate, auto_reply: e.target.checked})}
                  />
                  Enable auto-reply for this template
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowCreateModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={createTemplate} className="btn-primary">
                Create Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Suggestions Modal */}
      {showSuggestModal && (
        <div className="modal-overlay" onClick={() => setShowSuggestModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Test Response Suggestions</h2>
              <button onClick={() => setShowSuggestModal(false)} className="modal-close">
                <X size={20} />
              </button>
            </div>
            <div className="modal-content">
              <div className="form-group">
                <label>Incoming Message</label>
                <textarea
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Enter a message to test..."
                  className="textarea"
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>Platform</label>
                <select
                  value={testPlatform}
                  onChange={(e) => setTestPlatform(e.target.value)}
                  className="input"
                >
                  <option value="twitter">Twitter</option>
                  <option value="facebook">Facebook</option>
                  <option value="instagram">Instagram</option>
                  <option value="linkedin">LinkedIn</option>
                </select>
              </div>
              <button onClick={getSuggestions} className="btn-primary" style={{ width: '100%', marginBottom: '20px' }}>
                <Sparkles size={18} />
                Get Suggestions
              </button>

              {suggestions.length > 0 && (
                <div>
                  <h3 style={{ marginBottom: '15px' }}>Suggested Responses:</h3>
                  {suggestions.map(suggestion => (
                    <div key={suggestion.id} style={{
                      padding: '15px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '8px',
                      marginBottom: '10px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                        <strong>{suggestion.name}</strong>
                        <span className={`badge ${getSentimentColor(suggestion.sentiment)}`}>
                          {suggestion.sentiment}
                        </span>
                      </div>
                      <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                        {suggestion.template}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
