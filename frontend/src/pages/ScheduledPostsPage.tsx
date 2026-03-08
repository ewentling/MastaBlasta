import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { isSameDay, addDays } from 'date-fns';
import { accountsApi, postsApi, mediaApi, api } from '../api';
import { useAI } from '../contexts/AIContext';
import { PlatformPreviews } from '../components/PlatformPreviews';
import {
  Calendar, Trash2, Check, X, Edit2, Plus, Clock, ChevronDown,
  Sparkles, Hash, Upload, Image as ImageIcon, ExternalLink, AlertTriangle, Search, Copy, CheckSquare, Square,
} from 'lucide-react';
import {
  formatDateTime, toDateTimeLocalValue, getMinDateTime, toISOString, isInPast,
} from '../utils/timezone';

type SortKey = 'soonest' | 'latest' | 'newest' | 'oldest';

const PLATFORM_EMOJI: Record<string, string> = {
  twitter: '🐦', facebook: '📘', instagram: '📷', linkedin: '💼',
  threads: '🧵', bluesky: '🦋', youtube: '▶️', reddit: '🤖', tiktok: '🎵', pinterest: '📌',
};

// ─── Post Form (shared by Create & Edit modals) ──────────────────────────────

interface PostFormProps {
  initial?: { content: string; account_ids: string[]; scheduled_time: string; media?: string[] };
  onSubmit: (data: { content: string; account_ids: string[]; scheduled_time: string; media: string[] }) => void;
  isPending: boolean;
  submitLabel: string;
  onCancel: () => void;
}

function PostForm({ initial, onSubmit, isPending, submitLabel, onCancel }: PostFormProps) {
  const { llmConfig, optimizeContent, suggestHashtags, suggestPostingTime } = useAI();
  const isAIEnabled = !!(llmConfig?.enabled && llmConfig?.apiKey);

  const { data: accountsData } = useQuery({ queryKey: ['accounts'], queryFn: () => accountsApi.getAll() });
  const accounts = accountsData?.accounts?.filter(a => a.enabled) || [];

  const [content, setContent] = useState(initial?.content ?? '');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(initial?.account_ids ?? []);
  const [scheduledTime, setScheduledTime] = useState(initial?.scheduled_time ?? '');
  // Pre-populate existing media URLs when editing a post
  const [uploadedMedia, setUploadedMedia] = useState<{ id: string; url: string; filename: string }[]>(
    (initial?.media ?? []).map((url, i) => ({ id: `existing-${i}`, url, filename: url.split('/').pop() || `media-${i}` }))
  );
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<{
    optimized?: string; hashtags?: string[]; postingTime?: string;
  }>({});
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isGettingHashtags, setIsGettingHashtags] = useState(false);
  const [isGettingTime, setIsGettingTime] = useState(false);

  const charCount = content.length;
  const maxChars = 280;

  const toggleAccount = (id: string) =>
    setSelectedAccounts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime'];
    const bad = files.filter(f => !validTypes.includes(f.type));
    if (bad.length) { setError('Only images (JPEG, PNG, GIF, WebP) and videos (MP4, MOV) are allowed'); return; }
    const oversized = files.filter(f => f.size > 50 * 1024 * 1024);
    if (oversized.length) { setError('Files must be smaller than 50MB'); return; }
    setMediaFiles(prev => [...prev, ...files]);
    setUploadingMedia(true);
    try {
      for (const file of files) {
        const result = await mediaApi.upload(file);
        setUploadedMedia(prev => [...prev, { id: result.media_id, url: result.url, filename: result.filename }]);
      }
    } catch {
      setError('Failed to upload media');
    } finally {
      setUploadingMedia(false);
    }
  };

  const removeMedia = (i: number) => {
    // Capture the current count before either setter runs to avoid a stale
    // closure if the two state updates are batched differently.
    const currentMediaFilesCount = mediaFiles.length;
    setMediaFiles(prev => prev.filter((_, idx) => idx !== i));
    // uploadedMedia may contain existing media (from editing) followed by newly
    // uploaded media. mediaFiles contains only newly selected files. Compute the
    // correct index into uploadedMedia using the captured count.
    setUploadedMedia(prev => {
      const existingCount = prev.length - currentMediaFilesCount;
      const targetIndex = existingCount + i;
      return prev.filter((_, idx) => idx !== targetIndex);
    });
  };

  const handleOptimize = async () => {
    if (!content.trim()) return;
    setIsOptimizing(true);
    try {
      const optimized = await optimizeContent(content);
      setAiSuggestions(prev => ({ ...prev, optimized }));
    }
    catch (e: any) { setError(e.message); }
    finally { setIsOptimizing(false); }
  };

  const handleHashtags = async () => {
    if (!content.trim()) return;
    setIsGettingHashtags(true);
    try {
      const hashtags = await suggestHashtags(content);
      setAiSuggestions(prev => ({ ...prev, hashtags }));
    }
    catch (e: any) { setError(e.message); }
    finally { setIsGettingHashtags(false); }
  };

  const handleBestTime = async () => {
    if (!selectedAccounts.length) return;
    const platforms = accounts.filter(a => selectedAccounts.includes(a.id)).map(a => a.platform).join(', ');
    setIsGettingTime(true);
    try {
      const postingTime = await suggestPostingTime(platforms);
      setAiSuggestions(prev => ({ ...prev, postingTime }));
    }
    catch (e: any) { setError(e.message); }
    finally { setIsGettingTime(false); }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedAccounts.length) { setError('Please select at least one account'); return; }
    if (!scheduledTime) { setError('Please select a schedule date and time'); return; }
    if (isInPast(scheduledTime)) { setError('Scheduled time must be in the future'); return; }
    onSubmit({ content, account_ids: selectedAccounts, scheduled_time: toISOString(new Date(scheduledTime)), media: uploadedMedia.map(m => m.url) });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '1.25rem' }}>
        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Content */}
        <div className="form-group">
          <label className="form-label">Post Content <span style={{ color: '#ef4444' }}>*</span></label>
          <textarea
            className="form-textarea"
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="What would you like to post?"
            required
            style={{ minHeight: '130px' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-textSecondary)' }}>
              {charCount > maxChars && <span style={{ color: '#ef4444' }}>⚠ Exceeds Twitter 280-char limit</span>}
            </div>
            <div style={{ fontSize: '0.75rem', color: charCount > maxChars ? '#ef4444' : 'var(--color-textSecondary)' }}>
              {charCount} / {maxChars}
            </div>
          </div>

          {/* AI Buttons */}
          {isAIEnabled && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
              <button type="button" onClick={handleOptimize} disabled={isOptimizing || !content.trim()} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Sparkles size={13} /> {isOptimizing ? 'Optimizing…' : 'Optimize'}
              </button>
              <button type="button" onClick={handleHashtags} disabled={isGettingHashtags || !content.trim()} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Hash size={13} /> {isGettingHashtags ? 'Suggesting…' : 'Hashtags'}
              </button>
              <button type="button" onClick={handleBestTime} disabled={isGettingTime || !selectedAccounts.length} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Clock size={13} /> {isGettingTime ? 'Thinking…' : 'Best Time'}
              </button>
            </div>
          )}

          {/* AI Suggestions panel */}
          {(aiSuggestions.optimized || aiSuggestions.hashtags?.length || aiSuggestions.postingTime) && (
            <div style={{ marginTop: '0.75rem', padding: '0.875rem', background: 'var(--color-bgTertiary)', borderRadius: '8px', border: '1px solid var(--color-borderLight)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--color-accentPrimary)', fontWeight: '600', fontSize: '0.875rem' }}>
                <Sparkles size={15} /> AI Suggestions
              </div>
              {aiSuggestions.optimized && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-textSecondary)', marginBottom: '0.4rem' }}>Optimized Content:</div>
                  <div style={{ padding: '0.625rem', background: 'var(--color-bgSecondary)', borderRadius: '6px', fontSize: '0.8rem', whiteSpace: 'pre-wrap', marginBottom: '0.4rem' }}>{aiSuggestions.optimized}</div>
                  <button type="button" onClick={() => { setContent(aiSuggestions.optimized!); setAiSuggestions(p => ({ ...p, optimized: undefined })); }} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>Use This</button>
                </div>
              )}
              {aiSuggestions.hashtags?.length && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-textSecondary)', marginBottom: '0.4rem' }}>Suggested Hashtags:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.4rem' }}>
                    {aiSuggestions.hashtags.map((tag, i) => (
                      <span key={i} style={{ padding: '0.2rem 0.65rem', background: 'var(--color-accentGradient)', borderRadius: '20px', color: 'white', fontSize: '0.78rem' }}>{tag}</span>
                    ))}
                  </div>
                  <button type="button" onClick={() => { setContent(p => `${p}\n\n${aiSuggestions.hashtags!.join(' ')}`); setAiSuggestions(p => ({ ...p, hashtags: undefined })); }} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>Add to Post</button>
                </div>
              )}
              {aiSuggestions.postingTime && (
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-textSecondary)', marginBottom: '0.4rem' }}>Optimal Posting Time:</div>
                  <div style={{ padding: '0.625rem', background: 'var(--color-bgSecondary)', borderRadius: '6px', fontSize: '0.8rem' }}>{aiSuggestions.postingTime}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Media upload */}
        <div className="form-group">
          <label className="form-label">Media <span style={{ color: 'var(--color-textSecondary)', fontWeight: 400, fontSize: '0.8rem' }}>(optional)</span></label>
          <div
            style={{ border: '2px dashed var(--color-borderLight)', borderRadius: '8px', padding: '1rem', textAlign: 'center', cursor: 'pointer' }}
            onClick={() => document.getElementById('sched-media-upload')?.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--color-accentPrimary)'; }}
            onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--color-borderLight)'; }}
            onDrop={e => {
              e.preventDefault(); e.currentTarget.style.borderColor = 'var(--color-borderLight)';
              const files = Array.from(e.dataTransfer.files);
              if (!files.length) return;
              const input = document.getElementById('sched-media-upload') as HTMLInputElement;
              const dt = new DataTransfer(); files.forEach(f => dt.items.add(f)); input.files = dt.files;
              handleFileSelect({ target: input } as any);
            }}
          >
            <input id="sched-media-upload" type="file" multiple accept="image/*,video/*" onChange={handleFileSelect} style={{ display: 'none' }} disabled={uploadingMedia} />
            <Upload size={24} style={{ color: 'var(--color-accentPrimary)', margin: '0 auto 0.4rem' }} />
            <div style={{ fontSize: '0.825rem', color: 'var(--color-textPrimary)', fontWeight: '600' }}>
              {uploadingMedia ? 'Uploading…' : 'Click or drag-drop'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-textSecondary)' }}>JPEG, PNG, GIF, WebP, MP4, MOV • max 50MB</div>
          </div>
          {mediaFiles.length > 0 && (
            <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px,1fr))', gap: '0.75rem' }}>
              {mediaFiles.map((file, i) => (
                <div key={i} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--color-borderLight)', aspectRatio: '1' }}>
                  {file.type.startsWith('image/') ? (
                    <img src={URL.createObjectURL(file)} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bgSecondary)' }}>
                      <ImageIcon size={24} style={{ color: 'var(--color-textSecondary)' }} />
                    </div>
                  )}
                  <button type="button" onClick={() => removeMedia(i)} style={{ position: 'absolute', top: '3px', right: '3px', background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '4px', padding: '3px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trash2 size={12} style={{ color: 'white' }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Account selection */}
        <div className="form-group">
          <label className="form-label">Accounts <span style={{ color: '#ef4444' }}>*</span></label>
          {accounts.length === 0 ? (
            <div style={{ color: 'var(--color-textSecondary)', fontSize: '0.875rem' }}>No accounts connected. Add accounts first.</div>
          ) : (
            <div className="checkbox-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {accounts.map(account => (
                <label key={account.id} className="checkbox-label" style={{ border: selectedAccounts.includes(account.id) ? '2px solid #818cf8' : '1px solid var(--color-borderLight)', padding: '0.625rem', borderRadius: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={selectedAccounts.includes(account.id)} onChange={() => toggleAccount(account.id)} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>
                      {PLATFORM_EMOJI[account.platform] || '🌐'} {account.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-textSecondary)' }}>
                      {account.platform}{account.username && ` • @${account.username}`}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Schedule time */}
        <div className="form-group">
          <label className="form-label">Schedule Date &amp; Time <span style={{ color: '#ef4444' }}>*</span></label>
          <input
            type="datetime-local"
            className="form-input"
            value={scheduledTime}
            onChange={e => setScheduledTime(e.target.value)}
            min={getMinDateTime()}
            required
            style={{ maxWidth: '320px' }}
          />
          {scheduledTime && (
            <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--color-textSecondary)' }}>
              Will publish: {formatDateTime.full(scheduledTime)}
            </div>
          )}
        </div>

        {/* Platform Previews */}
        {content && selectedAccounts.length > 0 && (
          <PlatformPreviews content={content} selectedAccounts={selectedAccounts} accounts={accounts} />
        )}
      </div>

      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={isPending || !content.trim() || !selectedAccounts.length}>
          <Calendar size={16} />
          {isPending ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ScheduledPostsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editPost, setEditPost] = useState<any | null>(null);
  const [clonePost, setClonePost] = useState<any | null>(null);
  const [deletePost, setDeletePost] = useState<any | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('soonest');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [platformFilter, setPlatformFilter] = useState('all');
  
  // Bulk selection state
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [showBulkReschedule, setShowBulkReschedule] = useState(false);
  const [bulkRescheduleTime, setBulkRescheduleTime] = useState('');
  const [bulkRescheduleOffset, setBulkRescheduleOffset] = useState(0); // hours offset

  const { data: postsData, isLoading } = useQuery({
    queryKey: ['posts', 'scheduled'],
    queryFn: () => postsApi.getAll('scheduled'),
  });

  const scheduleMutation = useMutation({
    mutationFn: postsApi.schedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setShowCreateModal(false);
      setClonePost(null);
      flash(true, 'Post scheduled successfully!');
    },
    onError: (e: any) => flash(false, e.response?.data?.error || 'Failed to schedule post'),
  });
  
  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (postIds: string[]) => {
      const res = await api.post('/v2/bulk/posts/delete', { post_ids: postIds });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setSelectedPosts(new Set());
      flash(true, `Deleted ${data.successful?.length || 0} posts`);
    },
    onError: () => flash(false, 'Failed to delete posts'),
  });
  
  // Bulk reschedule mutation
  const bulkRescheduleMutation = useMutation({
    mutationFn: async (reschedules: { id: string; scheduled_time: string }[]) => {
      const res = await api.post('/v2/bulk/posts/reschedule', { reschedules });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setSelectedPosts(new Set());
      setShowBulkReschedule(false);
      flash(true, `Rescheduled ${data.successful?.length || 0} posts`);
    },
    onError: () => flash(false, 'Failed to reschedule posts'),
  });
  
  const togglePostSelection = (postId: string) => {
    setSelectedPosts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };
  
  const toggleSelectAll = () => {
    if (selectedPosts.size === posts.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(posts.map((p: any) => p.id)));
    }
  };
  
  const handleBulkDelete = () => {
    if (selectedPosts.size === 0) return;
    if (confirm(`Delete ${selectedPosts.size} selected posts?`)) {
      bulkDeleteMutation.mutate(Array.from(selectedPosts));
    }
  };
  
  const handleBulkReschedule = () => {
    if (selectedPosts.size === 0 || !bulkRescheduleTime) return;
    
    const baseTime = new Date(bulkRescheduleTime);
    const reschedules = Array.from(selectedPosts).map((id, index) => ({
      id,
      scheduled_time: new Date(baseTime.getTime() + index * bulkRescheduleOffset * 60 * 60 * 1000).toISOString(),
    }));
    
    bulkRescheduleMutation.mutate(reschedules);
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => postsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setEditPost(null);
      flash(true, 'Post updated successfully!');
    },
    onError: (e: any) => flash(false, e.response?.data?.error || 'Failed to update post'),
  });

  const deleteMutation = useMutation({
    mutationFn: postsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setDeletePost(null);
      flash(true, 'Scheduled post cancelled');
    },
  });

  const flash = (success: boolean, message: string) => {
    setResult({ success, message });
    setTimeout(() => setResult(null), 3500);
  };

  const rawPosts = postsData?.posts || [];
  const posts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let copy = q
      ? rawPosts.filter(
        (p: any) =>
          p.content.toLowerCase().includes(q) ||
          (p.platforms || []).some((platformName: string) => platformName.toLowerCase().includes(q))
      )
      : [...rawPosts];
    if (platformFilter !== 'all') {
      copy = copy.filter((p: any) => (p.platforms || []).some((pn: string) => pn.toLowerCase() === platformFilter));
    }
    switch (sortKey) {
      case 'soonest': return copy.sort((a: any, b: any) => new Date(a.scheduled_for!).getTime() - new Date(b.scheduled_for!).getTime());
      case 'latest': return copy.sort((a: any, b: any) => new Date(b.scheduled_for!).getTime() - new Date(a.scheduled_for!).getTime());
      case 'newest': return copy.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case 'oldest': return copy.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      default: return copy;
    }
  }, [rawPosts, sortKey, searchQuery]);

  const SORT_LABELS: Record<SortKey, string> = {
    soonest: '⏰ Soonest first',
    latest: '🕰 Latest first',
    newest: '🆕 Newest created',
    oldest: '📅 Oldest created',
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h2>Scheduled Posts</h2>
          <p>Manage upcoming posts — editable, sortable, and linked to your calendar</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/calendar')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem' }}
          >
            <ExternalLink size={15} />
            Calendar View
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Plus size={16} />
            Schedule Post
          </button>
        </div>
      </div>

      {result && (
        <div className={`alert ${result.success ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: '1rem' }}>
          {result.success ? <Check size={18} /> : <X size={18} />}
          <span>{result.message}</span>
        </div>
      )}

      <div className="card">
        {/* Toolbar */}
        <div className="card-header" style={{ marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>
            Upcoming Posts <span style={{ color: 'var(--color-textSecondary)', fontWeight: 400, fontSize: '0.875rem' }}>({posts.length}{searchQuery ? ` of ${rawPosts.length}` : ''})</span>
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginLeft: 'auto' }}>
            {/* Search input */}
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-textSecondary)', pointerEvents: 'none' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search posts…"
                style={{
                  paddingLeft: '2rem', paddingRight: searchQuery ? '2rem' : '0.75rem',
                  paddingTop: '0.4rem', paddingBottom: '0.4rem',
                  background: 'var(--color-bgSecondary)', border: '1px solid var(--color-borderLight)',
                  borderRadius: '8px', color: 'var(--color-textPrimary)', fontSize: '0.875rem', width: '180px',
                  outline: 'none',
                }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-textSecondary)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  <X size={13} />
                </button>
              )}
            </div>
            {/* Sort dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowSortDropdown(d => !d)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem' }}
              >
                {SORT_LABELS[sortKey]}
                <ChevronDown size={14} />
              </button>
              {showSortDropdown && (
                <div style={{
                  position: 'absolute', right: 0, top: '110%', zIndex: 100,
                  background: 'var(--color-bgSecondary)', border: '1px solid var(--color-borderLight)',
                  borderRadius: '8px', overflow: 'hidden', minWidth: '180px', boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                }}>
                  {(Object.entries(SORT_LABELS) as [SortKey, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => { setSortKey(key); setShowSortDropdown(false); }}
                      style={{
                        display: 'block', width: '100%', padding: '0.6rem 1rem', textAlign: 'left',
                        background: sortKey === key ? 'rgba(99,102,241,0.1)' : 'transparent',
                        border: 'none', color: 'var(--color-textPrimary)', cursor: 'pointer', fontSize: '0.875rem',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Platform filter chips — shown when posts from multiple platforms exist */}
        {rawPosts.length > 0 && (() => {
          const platforms = Array.from(new Set(rawPosts.flatMap((p: any) => p.platforms || []))) as string[];
          if (platforms.length < 2) return null;
          return (
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <button onClick={() => setPlatformFilter('all')} className={`btn btn-small ${platformFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}>All</button>
              {platforms.map(p => (
                <button key={p} onClick={() => setPlatformFilter(platformFilter === p ? 'all' : p)} className={`btn btn-small ${platformFilter === p ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', textTransform: 'capitalize' }}>
                  {PLATFORM_EMOJI[p] || '🌐'} {p}
                </button>
              ))}
            </div>
          );
        })()}

        {/* Bulk Actions Bar */}
        {posts.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem',
            padding: '0.75rem 1rem', background: selectedPosts.size > 0 ? 'rgba(99, 102, 241, 0.1)' : 'var(--color-bgSecondary)',
            borderRadius: '0.5rem', border: '1px solid', borderColor: selectedPosts.size > 0 ? 'var(--color-primary)' : 'var(--color-borderLight)',
          }}>
            <button
              onClick={toggleSelectAll}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-textPrimary)', fontSize: '0.875rem',
              }}
            >
              {selectedPosts.size === posts.length ? <CheckSquare size={18} /> : <Square size={18} />}
              {selectedPosts.size === posts.length ? 'Deselect All' : 'Select All'}
            </button>
            
            {selectedPosts.size > 0 && (
              <>
                <span style={{ color: 'var(--color-textSecondary)', fontSize: '0.875rem' }}>
                  {selectedPosts.size} selected
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowBulkReschedule(true)}
                    style={{ fontSize: '0.8rem', padding: '0.375rem 0.75rem' }}
                  >
                    <Clock size={14} /> Reschedule
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleteMutation.isPending}
                    style={{ fontSize: '0.8rem', padding: '0.375rem 0.75rem', color: '#ef4444', borderColor: '#ef4444' }}
                  >
                    <Trash2 size={14} /> {bulkDeleteMutation.isPending ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="loading">Loading scheduled posts…</div>
        ) : rawPosts.length === 0 ? (
          <div className="empty-state">
            <Calendar size={48} />
            <h3>No scheduled posts</h3>
            <p>Schedule a post to publish it at a specific time</p>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)} style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Plus size={16} /> Schedule First Post
            </button>
          </div>
        ) : posts.length === 0 && searchQuery ? (
          <div className="empty-state">
            <Search size={40} />
            <h3>No posts match "{searchQuery}"</h3>
            <p>Try a different keyword or <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: 'var(--color-accentPrimary)', cursor: 'pointer', fontSize: 'inherit', textDecoration: 'underline', padding: 0 }}>clear the search</button></p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {posts.map((post: any) => {
              const scheduledDate = new Date(post.scheduled_for!);
              const now = new Date();
              const isToday = isSameDay(scheduledDate, now);
              const isTomorrow = isSameDay(scheduledDate, addDays(now, 1));
              const dayLabel = isToday ? '📅 Today' : isTomorrow ? '📅 Tomorrow' : null;

              return (
                <div
                  key={post.id}
                  style={{
                    padding: '1.125rem 1.25rem',
                    border: '1px solid',
                    borderColor: selectedPosts.has(post.id) ? 'var(--color-primary)' : 'var(--color-borderLight)',
                    borderRadius: '10px',
                    background: selectedPosts.has(post.id) ? 'rgba(99, 102, 241, 0.05)' : 'var(--color-bgSecondary)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                    {/* Selection checkbox */}
                    <button
                      onClick={() => togglePostSelection(post.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem',
                        color: selectedPosts.has(post.id) ? 'var(--color-primary)' : 'var(--color-textSecondary)',
                        flexShrink: 0,
                      }}
                    >
                      {selectedPosts.has(post.id) ? <CheckSquare size={20} /> : <Square size={20} />}
                    </button>
                    
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Content preview */}
                      <div style={{ fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.9rem', lineHeight: '1.4', color: 'var(--color-textPrimary)' }}>
                        {post.content.length > 140 ? `${post.content.substring(0, 140)}…` : post.content}
                      </div>

                      {/* Meta row */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--color-textSecondary)', marginBottom: '0.75rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Clock size={13} />
                          {dayLabel && <strong style={{ color: 'var(--color-accentPrimary)' }}>{dayLabel} — </strong>}
                          {formatDateTime.full(post.scheduled_for!)}
                        </span>
                      </div>

                      {/* Platform badges */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                        {(post.platforms || []).map((p: string) => (
                          <span key={p} className="badge badge-info" style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}>
                            {PLATFORM_EMOJI[p] || '🌐'} {p}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => setClonePost(post)}
                        title="Duplicate post"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
                      >
                        <Copy size={14} /> Duplicate
                      </button>
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => setEditPost(post)}
                        title="Edit post"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
                      >
                        <Edit2 size={14} /> Edit
                      </button>
                      <button
                        className="btn btn-danger btn-small"
                        onClick={() => setDeletePost(post)}
                        title="Cancel post"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
                      >
                        <Trash2 size={14} /> Cancel
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px', width: '95vw' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={18} /> Schedule New Post
              </h3>
              <button className="close-button" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <PostForm
              onSubmit={data => scheduleMutation.mutate(data as any)}
              isPending={scheduleMutation.isPending}
              submitLabel="Schedule Post"
              onCancel={() => setShowCreateModal(false)}
            />
          </div>
        </div>
      )}

      {/* Clone Modal */}
      {clonePost && (
        <div className="modal-overlay" onClick={() => setClonePost(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px', width: '95vw' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Copy size={18} /> Duplicate Post
              </h3>
              <button className="close-button" onClick={() => setClonePost(null)}>×</button>
            </div>
            <PostForm
              initial={{
                content: clonePost.content,
                account_ids: clonePost.account_ids || [],
                scheduled_time: '',
                media: clonePost.media || [],
              }}
              onSubmit={data => scheduleMutation.mutate(data as any)}
              isPending={scheduleMutation.isPending}
              submitLabel="Schedule Duplicate"
              onCancel={() => setClonePost(null)}
            />
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editPost && (
        <div className="modal-overlay" onClick={() => setEditPost(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px', width: '95vw' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit2 size={18} /> Edit Scheduled Post
              </h3>
              <button className="close-button" onClick={() => setEditPost(null)}>×</button>
            </div>
            <PostForm
              initial={{
                content: editPost.content,
                account_ids: editPost.account_ids || [],
                scheduled_time: toDateTimeLocalValue(editPost.scheduled_for!),
                media: editPost.media || [],
              }}
              onSubmit={data => updateMutation.mutate({ id: editPost.id, data: { content: data.content, account_ids: data.account_ids, scheduled_time: data.scheduled_time, media: data.media } })}
              isPending={updateMutation.isPending}
              submitLabel="Save Changes"
              onCancel={() => setEditPost(null)}
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletePost && (
        <div className="modal-overlay" onClick={() => setDeletePost(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
                <AlertTriangle size={18} /> Cancel Scheduled Post?
              </h3>
              <button className="close-button" onClick={() => setDeletePost(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '1.25rem' }}>
              <p style={{ color: 'var(--color-textSecondary)', marginBottom: '1rem' }}>
                This will permanently cancel the post scheduled for <strong>{formatDateTime.full(deletePost.scheduled_for!)}</strong>.
              </p>
              <div style={{ padding: '0.75rem', background: 'var(--color-bgSecondary)', borderRadius: '8px', fontSize: '0.875rem', marginBottom: '1rem', color: 'var(--color-textPrimary)' }}>
                "{deletePost.content.substring(0, 100)}{deletePost.content.length > 100 ? '…' : ''}"
              </div>
              <p style={{ fontSize: '0.8rem', color: '#ef4444' }}>This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeletePost(null)}>Keep It</button>
              <button
                className="btn btn-danger"
                onClick={() => deleteMutation.mutate(deletePost.id)}
                disabled={deleteMutation.isPending}
                style={{ background: '#ef4444', color: 'white', border: 'none' }}
              >
                <Trash2 size={15} />
                {deleteMutation.isPending ? 'Cancelling…' : 'Cancel Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Reschedule Modal */}
      {showBulkReschedule && (
        <div className="modal-overlay" onClick={() => setShowBulkReschedule(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={18} /> Bulk Reschedule
              </h3>
              <button className="close-button" onClick={() => setShowBulkReschedule(false)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '1.25rem' }}>
              <p style={{ color: 'var(--color-textSecondary)', marginBottom: '1rem' }}>
                Reschedule {selectedPosts.size} selected post{selectedPosts.size !== 1 ? 's' : ''}.
              </p>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--color-textSecondary)', fontSize: '0.875rem' }}>
                  Start Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={bulkRescheduleTime}
                  onChange={e => setBulkRescheduleTime(e.target.value)}
                  min={getMinDateTime()}
                  style={{
                    width: '100%', padding: '0.5rem', borderRadius: '0.375rem',
                    border: '1px solid var(--color-borderLight)', background: 'var(--color-bg)',
                    color: 'var(--color-textPrimary)',
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--color-textSecondary)', fontSize: '0.875rem' }}>
                  Stagger posts by (hours)
                </label>
                <input
                  type="number"
                  value={bulkRescheduleOffset}
                  onChange={e => setBulkRescheduleOffset(parseInt(e.target.value) || 0)}
                  min={0}
                  max={168}
                  style={{
                    width: '100%', padding: '0.5rem', borderRadius: '0.375rem',
                    border: '1px solid var(--color-borderLight)', background: 'var(--color-bg)',
                    color: 'var(--color-textPrimary)',
                  }}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--color-textSecondary)', marginTop: '0.25rem' }}>
                  Set to 0 to schedule all at the same time, or stagger them apart.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowBulkReschedule(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleBulkReschedule}
                disabled={bulkRescheduleMutation.isPending || !bulkRescheduleTime}
              >
                <Clock size={15} />
                {bulkRescheduleMutation.isPending ? 'Rescheduling…' : 'Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
