import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { accountsApi, postsApi, mediaApi } from '../api';
import { Send, Check, X, Sparkles, Hash, Clock, Upload, Trash2, Image as ImageIcon, Calendar, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAI } from '../contexts/AIContext';
import { PlatformPreviews } from '../components/PlatformPreviews';
import type { CreatePostRequest, SchedulePostRequest } from '../types';
import { getMinDateTime, toISOString, formatDateTime, isInPast } from '../utils/timezone';
import { DRAFT_STORAGE_KEY } from '../utils/constants';

export default function PostPage() {
  const navigate = useNavigate();
  const { llmConfig, optimizeContent, suggestHashtags, suggestPostingTime } = useAI();
  const [content, setContent] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [uploadedMedia, setUploadedMedia] = useState<{ id: string; url: string; filename: string }[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('');
  const [isDraft, setIsDraft] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<{
    optimized?: string;
    hashtags?: string[];
    postingTime?: string;
  }>({});
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isGettingHashtags, setIsGettingHashtags] = useState(false);
  const [isGettingTime, setIsGettingTime] = useState(false);
  const [savedDraft, setSavedDraft] = useState<{ content: string; timestamp: number } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Check for saved auto-draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft?.content?.trim()) {
          setSavedDraft({ content: draft.content, timestamp: draft.timestamp });
        }
      }
    } catch {
      // ignore malformed draft
    }
  }, []);

  const restoreDraft = () => {
    if (savedDraft) {
      setContent(savedDraft.content);
      setSavedDraft(null);
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  };

  const dismissDraft = () => {
    setSavedDraft(null);
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  };

  const { data: accountsData, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.getAll(),
  });

  // Auto-save draft every 30 seconds when there's content
  useEffect(() => {
    const interval = setInterval(() => {
      if (content.trim()) {
        const draft = {
          content,
          account_ids: selectedAccounts,
          media: uploadedMedia.map(m => m.url),
          is_draft: true,
          timestamp: Date.now()
        };
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [content, selectedAccounts, uploadedMedia]);

  const postMutation = useMutation({
    mutationFn: async (data: any) => {
      if (isDraft) {
        // Save as draft
        const draft = { ...data, is_draft: true, id: Date.now().toString() };
        const drafts = JSON.parse(localStorage.getItem('drafts') || '[]');
        drafts.push(draft);
        localStorage.setItem('drafts', JSON.stringify(drafts));
        return Promise.resolve(draft);
      }
      if (isScheduled) {
        return postsApi.schedule(data);
      }
      return postsApi.create(data);
    },
    onSuccess: () => {
      const message = isScheduled ? 'Post scheduled successfully!' : 'Post published successfully!';
      setResult({ success: true, message });
      setTimeout(() => {
        setContent('');
        setSelectedAccounts([]);
        setMediaFiles([]);
        setUploadedMedia([]);
        setIsScheduled(false);
        setScheduledTime('');
        setResult(null);
      }, 3000);
    },
    onError: (error: any) => {
      setResult({
        success: false,
        message: error.response?.data?.error || `Failed to ${isScheduled ? 'schedule' : 'publish'} post`
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

    if (isScheduled && !scheduledTime) {
      setResult({ success: false, message: 'Please select a date and time for scheduling' });
      setTimeout(() => setResult(null), 3000);
      return;
    }

    if (isScheduled && isInPast(scheduledTime)) {
      setResult({ success: false, message: 'Scheduled time must be in the future' });
      setTimeout(() => setResult(null), 3000);
      return;
    }

    // Include uploaded media URLs
    const mediaUrls = uploadedMedia.map(m => m.url);
    const postData: CreatePostRequest | SchedulePostRequest = {
      content,
      account_ids: selectedAccounts,
      media: mediaUrls
    };

    if (isScheduled) {
      (postData as SchedulePostRequest).scheduled_time = toISOString(new Date(scheduledTime));
    }

    postMutation.mutate(postData);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate file types
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime'];
    const invalidFiles = files.filter(f => !validTypes.includes(f.type));

    if (invalidFiles.length > 0) {
      setResult({ success: false, message: 'Only images (JPEG, PNG, GIF, WebP) and videos (MP4, MOV) are allowed' });
      setTimeout(() => setResult(null), 5000);
      return;
    }

    // Check file sizes (max 50MB per file)
    const maxSize = 50 * 1024 * 1024;
    const oversizedFiles = files.filter(f => f.size > maxSize);

    if (oversizedFiles.length > 0) {
      setResult({ success: false, message: 'Files must be smaller than 50MB' });
      setTimeout(() => setResult(null), 5000);
      return;
    }

    setMediaFiles(prev => [...prev, ...files]);

    // Upload files immediately
    setUploadingMedia(true);
    try {
      for (const file of files) {
        const uploadResult = await mediaApi.upload(file);
        setUploadedMedia(prev => [...prev, {
          id: uploadResult.media_id,
          url: uploadResult.url,
          filename: uploadResult.filename
        }]);
      }
      setResult({ success: true, message: `${files.length} file(s) uploaded successfully` });
      setTimeout(() => setResult(null), 3000);
    } catch (error: any) {
      setResult({ success: false, message: error.response?.data?.error || 'Failed to upload media' });
      setTimeout(() => setResult(null), 5000);
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleRemoveMedia = (index: number) => {
    // Revoke object URL to prevent memory leaks
    if (mediaFiles[index]) {
      const objectUrl = URL.createObjectURL(mediaFiles[index]);
      URL.revokeObjectURL(objectUrl);
    }
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
    setUploadedMedia(prev => prev.filter((_, i) => i !== index));
  };

  const toggleAccount = (accountId: string) => {
    setSelectedAccounts(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const allAccountsSelected = accounts.length > 0 && selectedAccounts.length === accounts.length;
  const toggleAllAccounts = () => {
    setSelectedAccounts(allAccountsSelected ? [] : accounts.map(a => a.id));
  };

  const charCount = content.length;
  const trimmedContent = content.trim();
  const wordCount = trimmedContent ? trimmedContent.split(/\s+/).length : 0;

  // Platform-specific character limits
  const PLATFORM_CHAR_LIMITS: Record<string, number> = {
    twitter: 280,
    x: 280,
    bluesky: 300,
    threads: 500,
    reddit: 40000,
    facebook: 63206,
    instagram: 2200,
    linkedin: 3000,
    tiktok: 2200,
    youtube: 5000,
    pinterest: 500,
  };

  // Find the tightest limit among selected platforms (de-duplicated by platform name)
  const selectedPlatforms = Array.from(
    new Set(
      accounts
        .filter(a => selectedAccounts.includes(a.id))
        .map(a => a.platform.toLowerCase())
    )
  );

  const activeLimits = selectedPlatforms
    .filter(p => p in PLATFORM_CHAR_LIMITS)
    .map(p => ({ platform: p, limit: PLATFORM_CHAR_LIMITS[p] }));

  const tightestLimit = activeLimits.length > 0
    ? activeLimits.reduce((min, cur) => cur.limit < min.limit ? cur : min)
    : null;

  const maxChars = tightestLimit?.limit ?? 280;
  const isOverLimit = charCount > maxChars;
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

      {/* Draft restore banner */}
      {savedDraft && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.75rem 1rem', marginBottom: '1rem',
          background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.35)',
          borderRadius: '10px', fontSize: '0.875rem',
        }}>
          <RotateCcw size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <span style={{ flex: 1, color: 'var(--color-textPrimary)' }}>
            You have an unsaved draft.
          </span>
          <button
            type="button"
            onClick={restoreDraft}
            style={{ padding: '0.375rem 0.875rem', background: 'rgba(251,191,36,0.2)', border: '1px solid rgba(251,191,36,0.4)', borderRadius: '6px', color: '#f59e0b', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: '600' }}
          >
            Restore
          </button>
          <button
            type="button"
            onClick={dismissDraft}
            style={{ background: 'none', border: 'none', color: 'var(--color-textSecondary)', cursor: 'pointer', padding: '0.25rem', display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

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
              color: isOverLimit ? '#f56565' : charCount > maxChars * 0.9 ? '#f59e0b' : '#718096',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              {/* Word count on the left */}
              <span style={{ fontSize: '0.75rem', color: 'var(--color-textSecondary)' }}>
                {wordCount} {wordCount === 1 ? 'word' : 'words'}
              </span>
              {/* Char count on the right */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {tightestLimit && (
                  <span style={{ fontSize: '0.75rem', color: isOverLimit ? '#f56565' : 'var(--color-textSecondary)' }}>
                    {tightestLimit.platform} limit:
                  </span>
                )}
                <span style={{ fontWeight: isOverLimit ? '700' : '400' }}>
                  {charCount} / {maxChars}
                  {isOverLimit && ` (${charCount - maxChars} over)`}
                </span>
              </div>
            </div>
            {/* Per-platform limit breakdown (shown when multiple platforms selected) */}
            {activeLimits.length > 1 && (
              <div style={{ marginTop: '0.375rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {activeLimits.map(({ platform, limit }) => (
                  <span
                    key={platform}
                    style={{
                      fontSize: '0.7rem',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      background: charCount > limit ? 'rgba(245,101,101,0.15)' : 'rgba(255,255,255,0.05)',
                      color: charCount > limit ? '#f56565' : 'var(--color-textSecondary)',
                      border: `1px solid ${charCount > limit ? 'rgba(245,101,101,0.3)' : 'rgba(255,255,255,0.1)'}`,
                    }}
                  >
                    {platform}: {limit}
                  </span>
                ))}
              </div>
            )}

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
            <label className="form-label">Media (Optional)</label>
            <div style={{
              border: '2px dashed var(--color-borderLight)',
              borderRadius: '8px',
              padding: '1.5rem',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
              onClick={() => document.getElementById('media-upload')?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = 'var(--color-accentPrimary)';
              }}
              onDragLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-borderLight)';
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = 'var(--color-borderLight)';
                const files = Array.from(e.dataTransfer.files);
                if (files.length > 0) {
                  const input = document.getElementById('media-upload') as HTMLInputElement;
                  const dataTransfer = new DataTransfer();
                  files.forEach(file => dataTransfer.items.add(file));
                  input.files = dataTransfer.files;
                  const changeEvent: React.ChangeEvent<HTMLInputElement> = {
                    target: input,
                    currentTarget: input,
                  } as React.ChangeEvent<HTMLInputElement>;
                  handleFileSelect(changeEvent);
                }
              }}
            >
              <input
                id="media-upload"
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                disabled={uploadingMedia}
              />
              <Upload size={32} style={{ color: 'var(--color-accentPrimary)', marginBottom: '0.5rem' }} />
              <div style={{ color: 'var(--color-textPrimary)', fontWeight: '600', marginBottom: '0.5rem' }}>
                {uploadingMedia ? 'Uploading...' : 'Click to upload or drag and drop'}
              </div>
              <div style={{ color: 'var(--color-textSecondary)', fontSize: '0.875rem' }}>
                Images (JPEG, PNG, GIF, WebP) or Videos (MP4, MOV) • Max 50MB per file
              </div>
            </div>

            {mediaFiles.length > 0 && (
              <div style={{
                marginTop: '1rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                gap: '1rem'
              }}>
                {mediaFiles.map((file, index) => (
                  <div
                    key={index}
                    style={{
                      position: 'relative',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: '1px solid var(--color-borderLight)',
                      aspectRatio: '1',
                    }}
                  >
                    {file.type.startsWith('image/') ? (
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--color-bgSecondary)',
                      }}>
                        <ImageIcon size={32} style={{ color: 'var(--color-textSecondary)' }} />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveMedia(index)}
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        background: 'rgba(0, 0, 0, 0.7)',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Trash2 size={16} style={{ color: 'white' }} />
                    </button>
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'rgba(0, 0, 0, 0.7)',
                      padding: '4px',
                      fontSize: '0.75rem',
                      color: 'white',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                    }}>
                      {file.name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="checkbox-label" style={{ marginBottom: '1rem' }}>
              <input
                type="checkbox"
                checked={isScheduled}
                onChange={(e) => setIsScheduled(e.target.checked)}
              />
              <span>Schedule for later</span>
            </label>

            {isScheduled && (
              <div>
                <label className="form-label">Schedule Date & Time</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  min={getMinDateTime()}
                  required={isScheduled}
                  style={{ maxWidth: '300px' }}
                />
                <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--color-textSecondary)' }}>
                  {scheduledTime && (
                    <>
                      Will be published: {formatDateTime.full(scheduledTime)}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Select Accounts</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.875rem', color: '#718096' }}>
                {selectedAccounts.length} / {accounts.length} selected
              </span>
              {accounts.length > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  onClick={toggleAllAccounts}
                  style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem' }}
                >
                  {allAccountsSelected ? 'Deselect All' : 'Select All'}
                </button>
              )}
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

        {/* Platform Previews */}
        <PlatformPreviews
          content={content}
          selectedAccounts={selectedAccounts}
          accounts={accounts}
        />

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
            {isScheduled ? <Calendar size={18} /> : <Send size={18} />}
            {postMutation.isPending
              ? (isScheduled ? 'Scheduling...' : 'Publishing...')
              : (isScheduled ? 'Schedule Post' : 'Publish Now')}
          </button>
        </div>
      </form>
    </div>
  );
}
