import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tantml:react-query';
import { accountsApi, postsApi } from '../api';
import { Calendar, Trash2, Check, X, Edit2, Save } from 'lucide-react';

export default function ScheduledPostsPage() {
  const queryClient = useQueryClient();
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [newScheduledTime, setNewScheduledTime] = useState<string>('');

  const { data: postsData, isLoading } = useQuery({
    queryKey: ['posts', 'scheduled'],
    queryFn: () => postsApi.getAll('scheduled'),
  });

  const deleteMutation = useMutation({
    mutationFn: postsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setResult({ success: true, message: 'Scheduled post cancelled' });
      setTimeout(() => setResult(null), 3000);
    },
  });

  const updateScheduleMutation = useMutation({
    mutationFn: ({ id, scheduled_time }: { id: string; scheduled_time: string }) =>
      postsApi.schedule({ id, scheduled_time } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setEditingPostId(null);
      setNewScheduledTime('');
      setResult({ success: true, message: 'Schedule updated successfully' });
      setTimeout(() => setResult(null), 3000);
    },
  });

  const handleQuickEdit = (postId: string, currentTime: string) => {
    setEditingPostId(postId);
    setNewScheduledTime(currentTime);
  };

  const handleSaveSchedule = (postId: string) => {
    if (newScheduledTime) {
      updateScheduleMutation.mutate({ id: postId, scheduled_time: newScheduledTime });
    }
  };

  const posts = postsData?.posts || [];

  return (
    <div>
      <div className="page-header">
        <h2>Scheduled Posts</h2>
        <p>Manage your upcoming scheduled posts</p>
      </div>

      {result && (
        <div className={`alert ${result.success ? 'alert-success' : 'alert-error'}`}>
          {result.success ? <Check size={20} /> : <X size={20} />}
          <span>{result.message}</span>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3>Upcoming Posts</h3>
          <button 
            className="btn btn-primary" 
            onClick={() => setShowScheduleModal(true)}
          >
            <Calendar size={18} />
            Schedule New Post
          </button>
        </div>

        {isLoading ? (
          <div className="loading">Loading scheduled posts...</div>
        ) : posts.length === 0 ? (
          <div className="empty-state">
            <Calendar size={48} />
            <h3>No scheduled posts</h3>
            <p>Schedule a post to publish it at a specific time</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {posts.map(post => (
              <div
                key={post.id}
                style={{
                  padding: '1.25rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', marginBottom: '0.75rem', color: '#1a202c' }}>
                      {post.content}
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      gap: '1rem', 
                      fontSize: '0.875rem', 
                      color: '#718096',
                      marginBottom: '0.75rem',
                      alignItems: 'center'
                    }}>
                      {editingPostId === post.id ? (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            📅
                            <input
                              type="datetime-local"
                              value={newScheduledTime}
                              onChange={(e) => setNewScheduledTime(e.target.value)}
                              style={{
                                padding: '0.25rem 0.5rem',
                                border: '1px solid var(--color-borderLight)',
                                borderRadius: '4px',
                                fontSize: '0.875rem'
                              }}
                            />
                            <button
                              className="btn btn-primary btn-small"
                              onClick={() => handleSaveSchedule(post.id)}
                              disabled={updateScheduleMutation.isPending}
                              style={{ padding: '0.25rem 0.5rem' }}
                            >
                              <Save size={14} />
                            </button>
                            <button
                              className="btn btn-secondary btn-small"
                              onClick={() => setEditingPostId(null)}
                              style={{ padding: '0.25rem 0.5rem' }}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            📅 {new Date(post.scheduled_for!).toLocaleString()}
                          </div>
                          <button
                            className="btn btn-secondary btn-small"
                            onClick={() => handleQuickEdit(post.id, new Date(post.scheduled_for!).toISOString().slice(0, 16))}
                            style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            <Edit2 size={12} />
                            Quick Edit
                          </button>
                        </>
                      )}
                      <div>
                        🌐 {post.platforms.join(', ')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {post.platforms.map(platform => (
                        <span key={platform} className="badge badge-info">
                          {platform}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    className="btn btn-danger btn-small"
                    onClick={() => {
                      if (confirm('Cancel this scheduled post?')) {
                        deleteMutation.mutate(post.id);
                      }
                    }}
                  >
                    <Trash2 size={16} />
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showScheduleModal && (
        <SchedulePostModal
          onClose={() => setShowScheduleModal(false)}
          onSuccess={() => {
            setShowScheduleModal(false);
            queryClient.invalidateQueries({ queryKey: ['posts'] });
            setResult({ success: true, message: 'Post scheduled successfully!' });
            setTimeout(() => setResult(null), 3000);
          }}
        />
      )}
    </div>
  );
}

function SchedulePostModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [content, setContent] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.getAll(),
  });

  const scheduleMutation = useMutation({
    mutationFn: postsApi.schedule,
    onSuccess: onSuccess,
  });

  const accounts = accountsData?.accounts?.filter(a => a.enabled) || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const scheduled_time = `${scheduledDate}T${scheduledTime}:00Z`;
    scheduleMutation.mutate({
      content,
      account_ids: selectedAccounts,
      scheduled_time,
    });
  };

  const toggleAccount = (accountId: string) => {
    setSelectedAccounts(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  // Get minimum datetime (now + 5 minutes)
  const minDateTime = new Date(Date.now() + 5 * 60 * 1000);
  const minDate = minDateTime.toISOString().split('T')[0];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h3>Schedule Post</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Post Content</label>
              <textarea
                className="form-textarea"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What would you like to post?"
                required
                style={{ minHeight: '120px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={minDate}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Time (UTC)</label>
                <input
                  type="time"
                  className="form-input"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Select Accounts</label>
              <div className="checkbox-group">
                {accounts.map(account => (
                  <label key={account.id} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedAccounts.includes(account.id)}
                      onChange={() => toggleAccount(account.id)}
                    />
                    <span>{account.name} ({account.platform})</span>
                  </label>
                ))}
              </div>
              {accounts.length === 0 && (
                <div style={{ color: '#718096', fontSize: '0.875rem' }}>
                  No accounts available. Please add accounts first.
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={scheduleMutation.isPending || selectedAccounts.length === 0}
            >
              <Calendar size={18} />
              {scheduleMutation.isPending ? 'Scheduling...' : 'Schedule Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
