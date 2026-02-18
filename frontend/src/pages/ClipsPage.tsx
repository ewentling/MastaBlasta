import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Video, Scissors, Sparkles, Download, Calendar, Check, X, Loader, ExternalLink, Clock, Target, TrendingUp, Copy, Play, Save, Send, Type, Maximize2, Square, Smartphone, Monitor } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:33766';

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

interface CaptionStyle {
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strokeWidth: number;
  strokeColor: string;
  shadowEnabled: boolean;
  backgroundColor: string;
  backgroundOpacity: number;
  position: 'top' | 'center' | 'bottom';
}

interface ClipConfiguration {
  clip: Clip;
  aspectRatio: string;
  captionStyle: CaptionStyle;
}

export default function ClipsPage() {
  const navigate = useNavigate();
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
  
  // New state for enhancements
  const [showCaptionEditor, setShowCaptionEditor] = useState(false);
  const [clipConfigurations, setClipConfigurations] = useState<Map<number, ClipConfiguration>>(new Map());
  const [currentCaptionStyle, setCurrentCaptionStyle] = useState<CaptionStyle>({
    text: '',
    fontFamily: 'Arial',
    fontSize: 32,
    color: '#FFFFFF',
    bold: false,
    italic: false,
    underline: false,
    strokeWidth: 2,
    strokeColor: '#000000',
    shadowEnabled: true,
    backgroundColor: '#000000',
    backgroundOpacity: 0.5,
    position: 'bottom'
  });
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string>('16:9');
  const [editingClipIndex, setEditingClipIndex] = useState<number | null>(null);

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
      
      // Check if it's a YouTube bot detection error
      if (errorMsg.includes('Sign in to confirm') || errorMsg.includes('not a bot') || errorMsg.includes('youtube')) {
        setError(
          '⚠️ YouTube Access Restricted: YouTube has detected automated access and is blocking this request. ' +
          'This is a common issue with YouTube\'s anti-bot measures. Please try one of these alternatives:\n\n' +
          '1. Use public or unlisted videos (not private)\n' +
          '2. Try videos from different channels\n' +
          '3. Use alternative platforms like Vimeo or direct video file URLs\n' +
          '4. Contact your administrator to configure YouTube API access with proper authentication'
        );
      } else {
        setError(errorMsg);
      }
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

  // New handler functions for enhancements
  const handleSaveClip = (clip: Clip, index: number) => {
    const config: ClipConfiguration = {
      clip,
      aspectRatio: clipConfigurations.get(index)?.aspectRatio || selectedAspectRatio,
      captionStyle: clipConfigurations.get(index)?.captionStyle || currentCaptionStyle
    };
    
    const dataStr = JSON.stringify(config, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `clip-${index + 1}-config.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    setSuccessMessage('Clip configuration saved!');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handlePostClip = (clip: Clip, index: number) => {
    const config = clipConfigurations.get(index);
    const caption = config?.captionStyle.text || clip.title;
    const platforms = clip.platforms;
    
    // Navigate to PostPage with pre-filled data
    navigate('/post', {
      state: {
        content: caption,
        platforms: platforms,
        clipData: {
          ...clip,
          aspectRatio: config?.aspectRatio || selectedAspectRatio,
          captionStyle: config?.captionStyle
        }
      }
    });
  };

  const handleOpenCaptionEditor = (clip: Clip, index: number) => {
    setEditingClipIndex(index);
    const existingConfig = clipConfigurations.get(index);
    if (existingConfig) {
      setCurrentCaptionStyle(existingConfig.captionStyle);
      setSelectedAspectRatio(existingConfig.aspectRatio);
    } else {
      setCurrentCaptionStyle({
        text: clip.title,
        fontFamily: 'Arial',
        fontSize: 32,
        color: '#FFFFFF',
        bold: false,
        italic: false,
        underline: false,
        strokeWidth: 2,
        strokeColor: '#000000',
        shadowEnabled: true,
        backgroundColor: '#000000',
        backgroundOpacity: 0.5,
        position: 'bottom'
      });
    }
    setShowCaptionEditor(true);
  };

  const handleApplyCaptionStyle = () => {
    if (editingClipIndex !== null) {
      const newConfigs = new Map(clipConfigurations);
      newConfigs.set(editingClipIndex, {
        clip: clips[editingClipIndex],
        aspectRatio: selectedAspectRatio,
        captionStyle: currentCaptionStyle
      });
      setClipConfigurations(newConfigs);
      setSuccessMessage('Caption styling applied!');
      setTimeout(() => setSuccessMessage(null), 3000);
    }
    setShowCaptionEditor(false);
    setEditingClipIndex(null);
  };

  const getAspectRatioStyle = (ratio: string) => {
    const styles: any = {
      '16:9': { paddingTop: '56.25%' }, // 9/16 = 0.5625
      '9:16': { paddingTop: '177.78%' }, // 16/9 = 1.7778
      '1:1': { paddingTop: '100%' },
      '4:5': { paddingTop: '125%' } // 5/4 = 1.25
    };
    return styles[ratio] || styles['16:9'];
  };

  const aspectRatios = [
    { value: '16:9', label: 'Landscape', icon: Monitor, description: 'YouTube, LinkedIn' },
    { value: '9:16', label: 'Portrait', icon: Smartphone, description: 'TikTok, Reels, Shorts' },
    { value: '1:1', label: 'Square', icon: Square, description: 'Instagram, Twitter' },
    { value: '4:5', label: 'Portrait+', icon: Maximize2, description: 'Instagram Feed' }
  ];

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

      {/* YouTube Help Section */}
      <div className="card" style={{ marginBottom: '24px', backgroundColor: '#fef3c7', border: '1px solid #fbbf24' }}>
        <h3 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          ⚠️ YouTube Access Issues
        </h3>
        <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
          <p style={{ marginBottom: '12px' }}>
            <strong>Why This Happens:</strong> YouTube has strict anti-bot measures that may block automated video access. 
            This is especially common with private videos or when accessed without proper API authentication.
          </p>
          <p style={{ marginBottom: '12px' }}>
            <strong>What You Can Do:</strong>
          </p>
          <ul style={{ marginLeft: '20px', marginBottom: '12px' }}>
            <li>✅ Use <strong>public or unlisted videos</strong> instead of private ones</li>
            <li>✅ Try videos from <strong>different channels or creators</strong></li>
            <li>✅ Use alternative platforms like <strong>Vimeo, Wistia, or direct video URLs</strong></li>
            <li>✅ For production use, ask your admin to configure <strong>YouTube Data API v3 access</strong></li>
          </ul>
          <p style={{ fontSize: '13px', color: '#78716c' }}>
            💡 <strong>Alternative:</strong> You can download videos manually and upload the file directly, or use 
            platforms like Vimeo that are more automation-friendly.
          </p>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {clips.map((clip, index) => {
              const config = clipConfigurations.get(index);
              const aspectRatio = config?.aspectRatio || '16:9';
              
              return (
                <div
                  key={index}
                  style={{
                    border: selectedClip === clip ? '2px solid #6366f1' : '1px solid var(--border-color)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    transition: 'all 0.2s',
                    backgroundColor: selectedClip === clip ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                  }}
                  className="clip-card"
                >
                  {/* Video Preview */}
                  <div 
                    style={{ 
                      position: 'relative',
                      width: '100%',
                      backgroundColor: '#000',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleSelectClip(clip)}
                  >
                    <div style={{ position: 'relative', ...getAspectRatioStyle(aspectRatio) }}>
                      {clip.thumbnail && (
                        <>
                          <img
                            src={clip.thumbnail}
                            alt={clip.title}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover'
                            }}
                          />
                          <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            backgroundColor: 'rgba(0,0,0,0.7)',
                            borderRadius: '50%',
                            padding: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Play size={32} color="#fff" fill="#fff" />
                          </div>
                        </>
                      )}
                      {/* Caption Preview */}
                      {config?.captionStyle.text && (
                        <div style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          [config.captionStyle.position]: '20px',
                          padding: '12px 16px',
                          textAlign: 'center',
                          fontFamily: config.captionStyle.fontFamily,
                          fontSize: `${config.captionStyle.fontSize * 0.4}px`,
                          color: config.captionStyle.color,
                          fontWeight: config.captionStyle.bold ? 'bold' : 'normal',
                          fontStyle: config.captionStyle.italic ? 'italic' : 'normal',
                          textDecoration: config.captionStyle.underline ? 'underline' : 'none',
                          textShadow: config.captionStyle.shadowEnabled ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none',
                          WebkitTextStroke: `${config.captionStyle.strokeWidth * 0.4}px ${config.captionStyle.strokeColor}`,
                          backgroundColor: `${config.captionStyle.backgroundColor}${Math.round(config.captionStyle.backgroundOpacity * 255).toString(16).padStart(2, '0')}`
                        }}>
                          {config.captionStyle.text}
                        </div>
                      )}
                    </div>
                    
                    {/* Aspect Ratio Badge */}
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      left: '8px',
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      color: '#fff',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600
                    }}>
                      {aspectRatio}
                    </div>
                  </div>

                  {/* Clip Info */}
                  <div style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                      <h3 style={{ fontSize: '16px', margin: 0, flex: 1 }}>Clip {index + 1}</h3>
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

                    {/* Aspect Ratio Selector */}
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Aspect Ratio:</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                        {aspectRatios.map((ar) => {
                          const Icon = ar.icon;
                          const isSelected = (config?.aspectRatio || selectedAspectRatio) === ar.value;
                          return (
                            <button
                              key={ar.value}
                              onClick={(e) => {
                                e.stopPropagation();
                                const newConfigs = new Map(clipConfigurations);
                                newConfigs.set(index, {
                                  clip,
                                  aspectRatio: ar.value,
                                  captionStyle: config?.captionStyle || currentCaptionStyle
                                });
                                setClipConfigurations(newConfigs);
                              }}
                              style={{
                                padding: '6px 4px',
                                border: isSelected ? '2px solid #6366f1' : '1px solid var(--border-color)',
                                borderRadius: '6px',
                                backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                fontSize: '10px',
                                transition: 'all 0.2s'
                              }}
                              title={ar.description}
                            >
                              <Icon size={16} style={{ marginBottom: '2px' }} />
                              {ar.value}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '12px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenCaptionEditor(clip, index);
                        }}
                        className="secondary-button"
                        style={{ 
                          display: 'flex', 
                          flexDirection: 'column',
                          alignItems: 'center', 
                          justifyContent: 'center',
                          padding: '8px 4px',
                          fontSize: '11px',
                          gap: '4px'
                        }}
                        title="Add/Edit Caption"
                      >
                        <Type size={16} />
                        Caption
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveClip(clip, index);
                        }}
                        className="secondary-button"
                        style={{ 
                          display: 'flex', 
                          flexDirection: 'column',
                          alignItems: 'center', 
                          justifyContent: 'center',
                          padding: '8px 4px',
                          fontSize: '11px',
                          gap: '4px'
                        }}
                        title="Save Clip Configuration"
                      >
                        <Save size={16} />
                        Save
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePostClip(clip, index);
                        }}
                        className="primary-button"
                        style={{ 
                          display: 'flex', 
                          flexDirection: 'column',
                          alignItems: 'center', 
                          justifyContent: 'center',
                          padding: '8px 4px',
                          fontSize: '11px',
                          gap: '4px'
                        }}
                        title="Post This Clip"
                      >
                        <Send size={16} />
                        Post
                      </button>
                    </div>

                    {clip.tags && clip.tags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '12px' }}>
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
                </div>
              );
            })}
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

      {/* Caption Editor Modal */}
      {showCaptionEditor && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }} onClick={() => setShowCaptionEditor(false)}>
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              maxWidth: '900px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              padding: '24px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center' }}>
              <Type size={24} style={{ marginRight: '8px' }} />
              Caption Editor
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {/* Editor Panel */}
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Caption Text</label>
                  <textarea
                    value={currentCaptionStyle.text}
                    onChange={(e) => setCurrentCaptionStyle({ ...currentCaptionStyle, text: e.target.value })}
                    placeholder="Enter your caption..."
                    style={{
                      width: '100%',
                      minHeight: '80px',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      fontSize: '14px',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>Font</label>
                    <select
                      value={currentCaptionStyle.fontFamily}
                      onChange={(e) => setCurrentCaptionStyle({ ...currentCaptionStyle, fontFamily: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        fontSize: '14px'
                      }}
                    >
                      <option value="Arial">Arial</option>
                      <option value="Helvetica">Helvetica</option>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Courier New">Courier New</option>
                      <option value="Georgia">Georgia</option>
                      <option value="Verdana">Verdana</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
                      Size: {currentCaptionStyle.fontSize}px
                    </label>
                    <input
                      type="range"
                      min="12"
                      max="72"
                      value={currentCaptionStyle.fontSize}
                      onChange={(e) => setCurrentCaptionStyle({ ...currentCaptionStyle, fontSize: parseInt(e.target.value) })}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>Text Style</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setCurrentCaptionStyle({ ...currentCaptionStyle, bold: !currentCaptionStyle.bold })}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: currentCaptionStyle.bold ? '2px solid #6366f1' : '1px solid var(--border-color)',
                        backgroundColor: currentCaptionStyle.bold ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      B
                    </button>
                    <button
                      onClick={() => setCurrentCaptionStyle({ ...currentCaptionStyle, italic: !currentCaptionStyle.italic })}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: currentCaptionStyle.italic ? '2px solid #6366f1' : '1px solid var(--border-color)',
                        backgroundColor: currentCaptionStyle.italic ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                        fontStyle: 'italic',
                        cursor: 'pointer'
                      }}
                    >
                      I
                    </button>
                    <button
                      onClick={() => setCurrentCaptionStyle({ ...currentCaptionStyle, underline: !currentCaptionStyle.underline })}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: currentCaptionStyle.underline ? '2px solid #6366f1' : '1px solid var(--border-color)',
                        backgroundColor: currentCaptionStyle.underline ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                        textDecoration: 'underline',
                        cursor: 'pointer'
                      }}
                    >
                      U
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>Text Color</label>
                    <input
                      type="color"
                      value={currentCaptionStyle.color}
                      onChange={(e) => setCurrentCaptionStyle({ ...currentCaptionStyle, color: e.target.value })}
                      style={{ width: '100%', height: '40px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
                      Stroke: {currentCaptionStyle.strokeWidth}px
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      value={currentCaptionStyle.strokeWidth}
                      onChange={(e) => setCurrentCaptionStyle({ ...currentCaptionStyle, strokeWidth: parseInt(e.target.value) })}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>Stroke Color</label>
                  <input
                    type="color"
                    value={currentCaptionStyle.strokeColor}
                    onChange={(e) => setCurrentCaptionStyle({ ...currentCaptionStyle, strokeColor: e.target.value })}
                    style={{ width: '100%', height: '40px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={currentCaptionStyle.shadowEnabled}
                      onChange={(e) => setCurrentCaptionStyle({ ...currentCaptionStyle, shadowEnabled: e.target.checked })}
                    />
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>Drop Shadow</span>
                  </label>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>Background Color</label>
                  <input
                    type="color"
                    value={currentCaptionStyle.backgroundColor}
                    onChange={(e) => setCurrentCaptionStyle({ ...currentCaptionStyle, backgroundColor: e.target.value })}
                    style={{ width: '100%', height: '40px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
                    Background Opacity: {Math.round(currentCaptionStyle.backgroundOpacity * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={currentCaptionStyle.backgroundOpacity}
                    onChange={(e) => setCurrentCaptionStyle({ ...currentCaptionStyle, backgroundOpacity: parseFloat(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>Position</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {(['top', 'center', 'bottom'] as const).map((pos) => (
                      <button
                        key={pos}
                        onClick={() => setCurrentCaptionStyle({ ...currentCaptionStyle, position: pos })}
                        style={{
                          padding: '8px',
                          borderRadius: '6px',
                          border: currentCaptionStyle.position === pos ? '2px solid #6366f1' : '1px solid var(--border-color)',
                          backgroundColor: currentCaptionStyle.position === pos ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                          cursor: 'pointer',
                          textTransform: 'capitalize'
                        }}
                      >
                        {pos}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Preview Panel */}
              <div>
                <h3 style={{ marginBottom: '12px' }}>Preview</h3>
                <div style={{
                  position: 'relative',
                  width: '100%',
                  paddingTop: '56.25%',
                  backgroundColor: '#000',
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}>
                  {currentCaptionStyle.text && (
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      [currentCaptionStyle.position]: '20px',
                      padding: '12px 16px',
                      textAlign: 'center',
                      fontFamily: currentCaptionStyle.fontFamily,
                      fontSize: `${currentCaptionStyle.fontSize}px`,
                      color: currentCaptionStyle.color,
                      fontWeight: currentCaptionStyle.bold ? 'bold' : 'normal',
                      fontStyle: currentCaptionStyle.italic ? 'italic' : 'normal',
                      textDecoration: currentCaptionStyle.underline ? 'underline' : 'none',
                      textShadow: currentCaptionStyle.shadowEnabled ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none',
                      WebkitTextStroke: `${currentCaptionStyle.strokeWidth}px ${currentCaptionStyle.strokeColor}`,
                      backgroundColor: `${currentCaptionStyle.backgroundColor}${Math.round(currentCaptionStyle.backgroundOpacity * 255).toString(16).padStart(2, '0')}`
                    }}>
                      {currentCaptionStyle.text}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '16px', fontSize: '13px', color: '#666' }}>
                  <p style={{ marginBottom: '8px' }}>💡 <strong>Tips:</strong></p>
                  <ul style={{ marginLeft: '20px', lineHeight: '1.6' }}>
                    <li>Use high contrast for readability</li>
                    <li>Add stroke/shadow for text on busy backgrounds</li>
                    <li>Keep captions short and punchy</li>
                    <li>Bottom position works best for most content</li>
                  </ul>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
              <button
                onClick={() => setShowCaptionEditor(false)}
                className="secondary-button"
                style={{ padding: '10px 24px' }}
              >
                Cancel
              </button>
              <button
                onClick={handleApplyCaptionStyle}
                className="primary-button"
                style={{ padding: '10px 24px' }}
              >
                Apply Caption
              </button>
            </div>
          </div>
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
