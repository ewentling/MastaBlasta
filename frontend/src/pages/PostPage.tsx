import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { accountsApi, postsApi } from '../api';
import { Send, Check, X, Sparkles, Hash, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAI } from '../contexts/AIContext';

export default function PostPage() {
  const navigate = useNavigate();
  const { llmConfig, optimizeContent, suggestHashtags, suggestPostingTime } = useAI();
  const [content, setContent] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<{
    optimized?: string;
    hashtags?: string[];
    postingTime?: string;
  }>({});
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isGettingHashtags, setIsGettingHashtags] = useState(false);
  const [isGettingTime, setIsGettingTime] = useState(false);

  const { data: accountsData, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.getAll(),
  });

  const postMutation = useMutation({
    mutationFn: postsApi.create,
    onSuccess: () => {
      setResult({ success: true, message: 'Post published successfully!' });
      setTimeout(() => {
        setContent('');
        setSelectedAccounts([]);
        setResult(null);
      }, 3000);
    },
    onError: (error: any) => {
      setResult({ 
        success: false, 
        message: error.response?.data?.error || 'Failed to publish post' 
      });
      setTimeout(() => setResult(null), 5000);
    },
  });

  const accounts = accountsData?.accounts?.filter(a => a.enabled) || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAccounts.length === 0) {
      setResult({ success: false, message: 'Please select at least one account' });
      setTimeout(() => setResult(null), 3000);
      return;
    }
    postMutation.mutate({ content, account_ids: selectedAccounts });
  };

  const toggleAccount = (accountId: string) => {
    setSelectedAccounts(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const charCount = content.length;
  const maxChars = 280; // Twitter limit as reference
  const isAIEnabled = llmConfig?.enabled && llmConfig?.apiKey;

  const handleOptimizeContent = async () => {
    if (!content.trim()) {
      setResult({ success: false, message: 'Please enter some content first' });
      setTimeout(() => setResult(null), 3000);
      return;
    }

    setIsOptimizing(true);
    try {
      const optimized = await optimizeContent(content);
      setAiSuggestions(prev => ({ ...prev, optimized }));
      setResult({ success: true, message: 'Content optimized!' });
      setTimeout(() => setResult(null), 3000);
    } catch (error: any) {
      setResult({ success: false, message: error.message || 'Failed to optimize content' });
      setTimeout(() => setResult(null), 5000);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleSuggestHashtags = async () => {
    if (!content.trim()) {
      setResult({ success: false, message: 'Please enter some content first' });
      setTimeout(() => setResult(null), 3000);
      return;
    }

    setIsGettingHashtags(true);
    try {
      const hashtags = await suggestHashtags(content);
      setAiSuggestions(prev => ({ ...prev, hashtags }));
      setResult({ success: true, message: 'Hashtags suggested!' });
      setTimeout(() => setResult(null), 3000);
    } catch (error: any) {
      setResult({ success: false, message: error.message || 'Failed to suggest hashtags' });
      setTimeout(() => setResult(null), 5000);
    } finally {
      setIsGettingHashtags(false);
    }
  };

  const handleSuggestTime = async () => {
    const platforms = accounts
      .filter(acc => selectedAccounts.includes(acc.id))
      .map(acc => acc.platform)
      .join(', ');
    
    if (!platforms) {
      setResult({ success: false, message: 'Please select at least one account first' });
      setTimeout(() => setResult(null), 3000);
      return;
    }

    setIsGettingTime(true);
    try {
      const postingTime = await suggestPostingTime(platforms);
      setAiSuggestions(prev => ({ ...prev, postingTime }));
      setResult({ success: true, message: 'Posting time suggested!' });
      setTimeout(() => setResult(null), 3000);
    } catch (error: any) {
      setResult({ success: false, message: error.message || 'Failed to suggest posting time' });
      setTimeout(() => setResult(null), 5000);
    } finally {
      setIsGettingTime(false);
    }
  };

  const applyOptimized = () => {
    if (aiSuggestions.optimized) {
      setContent(aiSuggestions.optimized);
      setAiSuggestions(prev => ({ ...prev, optimized: undefined }));
    }
  };

  const applyHashtags = () => {
    if (aiSuggestions.hashtags) {
      setContent(prev => `${prev}\n\n${aiSuggestions.hashtags!.join(' ')}`);
      setAiSuggestions(prev => ({ ...prev, hashtags: undefined }));
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Create Post</h2>
        <p>Publish content to multiple platforms instantly</p>
      </div>

      {result && (
        <div className={`alert ${result.success ? 'alert-success' : 'alert-error'}`}>
          {result.success ? <Check size={20} /> : <X size={20} />}
          <span>{result.message}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="card-header">
            <h3>Post Content</h3>
          </div>

          <div className="form-group">
            <label className="form-label">Message</label>
            <textarea
              className="form-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind?"
              required
              style={{ minHeight: '150px' }}
            />
            <div style={{ 
              marginTop: '0.5rem', 
              fontSize: '0.875rem', 
              color: charCount > maxChars ? '#f56565' : '#718096',
              textAlign: 'right'
            }}>
              {charCount} characters
              {charCount > maxChars && ' (exceeds Twitter limit)'}
            </div>
            
            {/* AI Suggestions Buttons */}
            {isAIEnabled && (
              <div style={{ 
                marginTop: '1rem', 
                display: 'flex', 
                gap: '0.5rem',
                flexWrap: 'wrap'
              }}>
                <button
                  type="button"
                  onClick={handleOptimizeContent}
                  disabled={isOptimizing || !content.trim()}
                  className="btn btn-secondary"
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                    padding: '0.5rem 1rem',
                  }}
                >
                  <Sparkles size={16} />
                  {isOptimizing ? 'Optimizing...' : 'Optimize Content'}
                </button>
                <button
                  type="button"
                  onClick={handleSuggestHashtags}
                  disabled={isGettingHashtags || !content.trim()}
                  className="btn btn-secondary"
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                    padding: '0.5rem 1rem',
                  }}
                >
                  <Hash size={16} />
                  {isGettingHashtags ? 'Suggesting...' : 'Suggest Hashtags'}
                </button>
                <button
                  type="button"
                  onClick={handleSuggestTime}
                  disabled={isGettingTime || selectedAccounts.length === 0}
                  className="btn btn-secondary"
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                    padding: '0.5rem 1rem',
                  }}
                >
                  <Clock size={16} />
                  {isGettingTime ? 'Suggesting...' : 'Best Time to Post'}
                </button>
              </div>
            )}

            {/* AI Suggestions Display */}
            {(aiSuggestions.optimized || aiSuggestions.hashtags || aiSuggestions.postingTime) && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                background: 'var(--color-bgTertiary)',
                borderRadius: '8px',
                border: '1px solid var(--color-borderLight)',
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  marginBottom: '0.75rem',
                  color: 'var(--color-accentPrimary)',
                  fontWeight: '600',
                }}>
                  <Sparkles size={18} />
                  AI Suggestions
                </div>

                {aiSuggestions.optimized && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ 
                      fontSize: '0.875rem', 
                      color: 'var(--color-textSecondary)',
                      marginBottom: '0.5rem' 
                    }}>
                      Optimized Content:
                    </div>
                    <div style={{ 
                      padding: '0.75rem',
                      background: 'var(--color-bgSecondary)',
                      borderRadius: '6px',
                      color: 'var(--color-textPrimary)',
                      fontSize: '0.875rem',
                      marginBottom: '0.5rem',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {aiSuggestions.optimized}
                    </div>
                    <button
                      type="button"
                      onClick={applyOptimized}
                      className="btn btn-primary"
                      style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                    >
                      Use This Version
                    </button>
                  </div>
                )}

                {aiSuggestions.hashtags && aiSuggestions.hashtags.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ 
                      fontSize: '0.875rem', 
                      color: 'var(--color-textSecondary)',
                      marginBottom: '0.5rem' 
                    }}>
                      Suggested Hashtags:
                    </div>
                    <div style={{ 
                      padding: '0.75rem',
                      background: 'var(--color-bgSecondary)',
                      borderRadius: '6px',
                      marginBottom: '0.5rem',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}>
                      {aiSuggestions.hashtags.map((tag, idx) => (
                        <span
                          key={idx}
                          style={{
                            padding: '0.25rem 0.75rem',
                            background: 'var(--color-accentGradient)',
                            borderRadius: '20px',
                            color: 'white',
                            fontSize: '0.875rem',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={applyHashtags}
                      className="btn btn-primary"
                      style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                    >
                      Add to Post
                    </button>
                  </div>
                )}

                {aiSuggestions.postingTime && (
                  <div>
                    <div style={{ 
                      fontSize: '0.875rem', 
                      color: 'var(--color-textSecondary)',
                      marginBottom: '0.5rem' 
                    }}>
                      Optimal Posting Time:
                    </div>
                    <div style={{ 
                      padding: '0.75rem',
                      background: 'var(--color-bgSecondary)',
                      borderRadius: '6px',
                      color: 'var(--color-textPrimary)',
                      fontSize: '0.875rem',
                    }}>
                      {aiSuggestions.postingTime}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Media URLs (Optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="https://example.com/image.jpg"
              disabled
            />
            <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#718096' }}>
              Media upload coming soon
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Select Accounts</h3>
            <div style={{ fontSize: '0.875rem', color: '#718096' }}>
              {selectedAccounts.length} selected
            </div>
          </div>

          {isLoading ? (
            <div className="loading">Loading accounts...</div>
          ) : accounts.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔗</div>
              <h3>No accounts available</h3>
              <p>Add platform accounts first</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate('/accounts')}
                style={{ marginTop: '1rem' }}
              >
                Go to Accounts
              </button>
            </div>
          ) : (
            <div className="checkbox-group">
              {accounts.map(account => {
                const platformEmoji: Record<string, string> = {
                  twitter: '🐦',
                  facebook: '📘',
                  instagram: '📷',
                  linkedin: '💼',
                };

                return (
                  <label
                    key={account.id}
                    className="checkbox-label"
                    style={{
                      border: selectedAccounts.includes(account.id) 
                        ? '2px solid #667eea' 
                        : '1px solid #e2e8f0',
                      padding: '1rem',
                      borderRadius: '8px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedAccounts.includes(account.id)}
                      onChange={() => toggleAccount(account.id)}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                        {platformEmoji[account.platform]} {account.name}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#718096' }}>
                        {account.platform} {account.username && `• @${account.username}`}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/')}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={postMutation.isPending || accounts.length === 0}
          >
            <Send size={18} />
            {postMutation.isPending ? 'Publishing...' : 'Publish Now'}
          </button>
        </div>
      </form>
    </div>
  );
}
