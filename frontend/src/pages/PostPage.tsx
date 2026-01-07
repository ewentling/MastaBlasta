import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { accountsApi, postsApi } from '../api';
import { Send, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PostPage() {
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

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
