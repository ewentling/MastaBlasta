import { useState } from 'react';
import axios from 'axios';
import { Video, Scissors, Sparkles, Download, Calendar, Check, X, Loader, ExternalLink, Clock, Target, TrendingUp, Copy, Play } from 'lucide-react';

interface VideoInfo {
  title: string;
  duration: number;
  url: string;
  thumbnail: string;
}

interface Clip {
  start_time: number;
  end_time: number;
  duration: number;
  title: string;
  hook: string;
  viral_reason: string;
  platforms: string[];
  engagement_score: number;
  tags: string[];
  video_title: string;
  video_url: string;
  thumbnail: string;
  start_timestamp: string;
  end_timestamp: string;
}

interface ClipMetadata {
  caption: string;
  hashtags: string[];
  thumbnail_text: string;
  best_time: string;
  cta: string;
  tips: string[];
  platform: string;
}

export default function ClipsPage() {
  const [videoUrl, setVideoUrl] = useState('');
  const [numClips, setNumClips] = useState(3);
  const [analyzing, setAnalyzing] = useState(false);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null);
  const [clipMetadata, setClipMetadata] = useState<ClipMetadata | null>(null);
  const [generatingMetadata, setGeneratingMetadata] = useState(false);
  const [downloadInfo, setDownloadInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!videoUrl.trim()) {
      setError('Please enter a video URL');
      return;
    }

    setAnalyzing(true);
    setError(null);
    setClips([]);
    setVideoInfo(null);
    setSelectedClip(null);

    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:33766';
      const response = await axios.post(`${API_BASE_URL}/api/clips/analyze`, {
        video_url: videoUrl,
        num_clips: numClips,
      });

      if (response.data.success) {
        setVideoInfo(response.data.video_info);
        setClips(response.data.suggested_clips);
        setSuccessMessage(`Found ${response.data.num_clips} viral clip opportunities!`);
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setError(response.data.error || 'Failed to analyze video');
      }
    } catch (err: any) {
      console.error('Analysis error:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Failed to analyze video. Check the URL and try again.';
      setError(errorMsg);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSelectClip = async (clip: Clip) => {
    setSelectedClip(clip);
    setClipMetadata(null);
    setDownloadInfo(null);
  };

  const handleGenerateMetadata = async (platform: string) => {
    if (!selectedClip) return;

    setGeneratingMetadata(true);
    setError(null);

    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:33766';
      const response = await axios.post(`${API_BASE_URL}/api/clips/metadata`, {
        clip: selectedClip,
        platform: platform,
      });

      if (response.data.success) {
        setClipMetadata(response.data);
      } else {
        setError(response.data.error || 'Failed to generate metadata');
      }
    } catch (err: any) {
      console.error('Metadata error:', err);
      setError(err.response?.data?.error || 'Failed to generate metadata');
    } finally {
      setGeneratingMetadata(false);
    }
  };

  const handleGetDownloadInfo = async () => {
    if (!selectedClip) return;

    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:33766';
      const response = await axios.post(`${API_BASE_URL}/api/clips/download-info`, {
        video_url: selectedClip.video_url,
        start_time: selectedClip.start_time,
        end_time: selectedClip.end_time,
      });

      if (response.data.success) {
        setDownloadInfo(response.data);
      } else {
        setError(response.data.error || 'Failed to get download info');
      }
    } catch (err: any) {
      console.error('Download info error:', err);
      setError(err.response?.data?.error || 'Failed to get download info');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccessMessage('Copied to clipboard!');
    setTimeout(() => setSuccessMessage(null), 2000);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getEngagementColor = (score: number) => {
    if (score >= 80) return '#10b981'; // green
    if (score >= 60) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  const getEngagementLabel = (score: number) => {
    if (score >= 80) return 'High Viral Potential';
    if (score >= 60) return 'Good Potential';
    return 'Moderate Potential';
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>
            <Scissors size={32} style={{ marginRight: '12px' }} />
            Video Clipper
          </h1>
          <p>Extract viral clips from videos using AI-powered analysis</p>
        </div>
      </div>

      {/* Input Section */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
          <Video size={24} style={{ marginRight: '8px' }} />
          Analyze Video
        </h2>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
            Video URL (YouTube, Vimeo, etc.)
          </label>
          <input
            type="text"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              fontSize: '14px',
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
            Number of Clips: {numClips}
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={numClips}
            onChange={(e) => setNumClips(parseInt(e.target.value))}
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666', marginTop: '4px' }}>
            <span>1 clip</span>
            <span>10 clips</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
          <button
            onClick={handleAnalyze}
            disabled={analyzing || !videoUrl.trim()}
            className="primary-button"
            style={{ 
              maxWidth: '300px',
              padding: '12px 32px',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: 600,
            }}
          >
            {analyzing ? (
              <>
                <Loader size={20} style={{ marginRight: '8px', animation: 'spin 1s linear infinite' }} />
                Analyzing with Gemini AI...
              </>
            ) : (
              <>
                <Sparkles size={20} style={{ marginRight: '8px' }} />
                Analyze Video
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div style={{
          padding: '16px',
          marginBottom: '24px',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '8px',
          color: '#c00',
          display: 'flex',
          alignItems: 'center',
        }}>
          <X size={20} style={{ marginRight: '8px' }} />
          {error}
        </div>
      )}

      {successMessage && (
        <div style={{
          padding: '16px',
          marginBottom: '24px',
          backgroundColor: '#efe',
          border: '1px solid #cfc',
          borderRadius: '8px',
          color: '#060',
          display: 'flex',
          alignItems: 'center',
        }}>
          <Check size={20} style={{ marginRight: '8px' }} />
          {successMessage}
        </div>
      )}

      {/* Video Info */}
      {videoInfo && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '16px' }}>Video Information</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '12px', alignItems: 'center' }}>
            {videoInfo.thumbnail && (
              <img
                src={videoInfo.thumbnail}
                alt={videoInfo.title}
                style={{ width: '160px', borderRadius: '8px', gridColumn: '1 / -1' }}
              />
            )}
            <strong>Title:</strong>
            <span>{videoInfo.title}</span>
            <strong>Duration:</strong>
            <span>{formatDuration(videoInfo.duration)}</span>
          </div>
        </div>
      )}

      {/* Clips Grid */}
      {clips.length > 0 && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <TrendingUp size={24} style={{ marginRight: '8px' }} />
            Suggested Clips ({clips.length})
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {clips.map((clip, index) => (
              <div
                key={index}
                onClick={() => handleSelectClip(clip)}
                style={{
                  padding: '16px',
                  border: selectedClip === clip ? '2px solid #6366f1' : '1px solid var(--border-color)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  backgroundColor: selectedClip === clip ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                }}
                className="clip-card"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '16px', margin: 0 }}>Clip {index + 1}</h3>
                  <div
                    style={{
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      backgroundColor: getEngagementColor(clip.engagement_score) + '20',
                      color: getEngagementColor(clip.engagement_score),
                    }}
                  >
                    {clip.engagement_score}%
                  </div>
                </div>

                <p style={{ fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
                  {clip.title}
                </p>

                <div style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                    <Clock size={14} style={{ marginRight: '4px' }} />
                    {clip.start_timestamp} - {clip.end_timestamp} ({clip.duration}s)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Target size={14} style={{ marginRight: '4px' }} />
                    {getEngagementLabel(clip.engagement_score)}
                  </div>
                </div>

                <p style={{ fontSize: '13px', color: '#444', marginBottom: '12px', lineHeight: '1.4' }}>
                  {clip.viral_reason}
                </p>

                {clip.tags && clip.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {clip.tags.map((tag, i) => (
                      <span
                        key={i}
                        style={{
                          padding: '2px 8px',
                          backgroundColor: '#f3f4f6',
                          borderRadius: '4px',
                          fontSize: '11px',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Clip Details */}
      {selectedClip && (
        <div className="card">
          <h2 style={{ marginBottom: '16px' }}>Clip Details</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
            {/* Left Column */}
            <div>
              <h3 style={{ marginBottom: '12px' }}>📹 Clip Information</h3>
              <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
                <p><strong>Title:</strong> {selectedClip.title}</p>
                <p><strong>Hook:</strong> {selectedClip.hook}</p>
                <p><strong>Time Range:</strong> {selectedClip.start_timestamp} - {selectedClip.end_timestamp}</p>
                <p><strong>Duration:</strong> {selectedClip.duration} seconds</p>
                <p><strong>Engagement Score:</strong> {selectedClip.engagement_score}%</p>
                <p><strong>Why Viral:</strong> {selectedClip.viral_reason}</p>
              </div>

              <div style={{ marginTop: '16px' }}>
                <h4 style={{ marginBottom: '8px' }}>Recommended Platforms:</h4>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {selectedClip.platforms.map((platform, i) => (
                    <span
                      key={i}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#6366f1',
                        color: 'white',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 500,
                      }}
                    >
                      {platform}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div>
              <h3 style={{ marginBottom: '12px' }}>🎯 Generate Metadata</h3>
              <p style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
                Generate optimized captions, hashtags, and posting tips for your platform:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {['instagram', 'tiktok', 'youtube_shorts'].map((platform) => (
                  <button
                    key={platform}
                    onClick={() => handleGenerateMetadata(platform)}
                    disabled={generatingMetadata}
                    className="secondary-button"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {generatingMetadata ? (
                      <Loader size={16} style={{ marginRight: '8px', animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <Sparkles size={16} style={{ marginRight: '8px' }} />
                    )}
                    {platform.replace('_', ' ').toUpperCase()}
                  </button>
                ))}
              </div>

              <button
                onClick={handleGetDownloadInfo}
                className="primary-button"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Download size={20} style={{ marginRight: '8px' }} />
                Get Download Instructions
              </button>
            </div>
          </div>

          {/* Metadata Display */}
          {clipMetadata && (
            <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
              <h3 style={{ marginBottom: '12px' }}>📱 {clipMetadata.platform.toUpperCase()} Metadata</h3>

              <div style={{ marginBottom: '16px' }}>
                <strong>Caption:</strong>
                <div style={{
                  marginTop: '8px',
                  padding: '12px',
                  backgroundColor: 'white',
                  borderRadius: '6px',
                  fontSize: '14px',
                  position: 'relative',
                }}>
                  {clipMetadata.caption}
                  <button
                    onClick={() => copyToClipboard(clipMetadata.caption)}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      padding: '4px 8px',
                      fontSize: '12px',
                      border: 'none',
                      background: '#6366f1',
                      color: 'white',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <strong>Hashtags:</strong>
                <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {clipMetadata.hashtags.map((tag, i) => (
                    <span
                      key={i}
                      onClick={() => copyToClipboard(tag)}
                      style={{
                        padding: '4px 10px',
                        backgroundColor: 'white',
                        borderRadius: '4px',
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {clipMetadata.thumbnail_text && (
                <div style={{ marginBottom: '16px' }}>
                  <strong>Thumbnail Text:</strong>
                  <p style={{ marginTop: '8px', fontSize: '14px' }}>{clipMetadata.thumbnail_text}</p>
                </div>
              )}

              {clipMetadata.best_time && (
                <div style={{ marginBottom: '16px' }}>
                  <strong>Best Posting Time:</strong>
                  <p style={{ marginTop: '8px', fontSize: '14px' }}>{clipMetadata.best_time}</p>
                </div>
              )}

              {clipMetadata.cta && (
                <div style={{ marginBottom: '16px' }}>
                  <strong>Call-to-Action:</strong>
                  <p style={{ marginTop: '8px', fontSize: '14px' }}>{clipMetadata.cta}</p>
                </div>
              )}

              {clipMetadata.tips && clipMetadata.tips.length > 0 && (
                <div>
                  <strong>Engagement Tips:</strong>
                  <ul style={{ marginTop: '8px', marginLeft: '20px', fontSize: '14px' }}>
                    {clipMetadata.tips.map((tip, i) => (
                      <li key={i} style={{ marginBottom: '4px' }}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Download Info */}
          {downloadInfo && (
            <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#fef3c7', borderRadius: '8px' }}>
              <h3 style={{ marginBottom: '12px' }}>⬇️ Download Instructions</h3>

              <div style={{ marginBottom: '16px' }}>
                <ol style={{ marginLeft: '20px', fontSize: '14px', lineHeight: '1.8' }}>
                  {downloadInfo.instructions.map((instruction: string, i: number) => (
                    <li key={i}>{instruction}</li>
                  ))}
                </ol>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <strong>FFmpeg Command:</strong>
                <div style={{
                  marginTop: '8px',
                  padding: '12px',
                  backgroundColor: '#1f2937',
                  color: '#10b981',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  overflowX: 'auto',
                  position: 'relative',
                }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{downloadInfo.ffmpeg_command}</pre>
                  <button
                    onClick={() => copyToClipboard(downloadInfo.ffmpeg_command)}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      padding: '4px 8px',
                      fontSize: '12px',
                      border: 'none',
                      background: '#6366f1',
                      color: 'white',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>

              <p style={{ fontSize: '12px', color: '#78716c' }}>
                💡 Tip: After downloading the clip, you can upload it when creating a post or schedule it for later.
              </p>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .clip-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
}
