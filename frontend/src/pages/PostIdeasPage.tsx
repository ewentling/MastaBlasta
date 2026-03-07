import { useState } from 'react';
import { api } from '../api';
import { Lightbulb, Sparkles, Copy, Check, Clock, Image, Video, FileText, Hash, Loader2 } from 'lucide-react';

interface PostIdea {
  headline: string;
  content: string;
  hashtags: string[];
  best_time: string;
  content_type: string;
}

export default function PostIdeasPage() {
  const [topic, setTopic] = useState('');
  const [industry, setIndustry] = useState('');
  const [platform, setPlatform] = useState('general');
  const [tone, setTone] = useState('professional');
  const [count, setCount] = useState(5);
  const [ideas, setIdeas] = useState<PostIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic && !industry) {
      setError('Please enter a topic or industry');
      return;
    }

    setLoading(true);
    setError('');
    setIdeas([]);

    try {
      const response = await api.post('/api/v2/ai/generate-post-ideas', {
        topic,
        industry,
        platform,
        tone,
        count
      });
      setIdeas(response.data.ideas || []);
    } catch (err: any) {
      console.error('Error generating ideas:', err);
      setError(err.response?.data?.error || 'Failed to generate ideas. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const getContentTypeIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'image': return <Image size={16} />;
      case 'video': return <Video size={16} />;
      case 'carousel': return <FileText size={16} />;
      default: return <FileText size={16} />;
    }
  };

  const getTimeIcon = (time: string) => {
    return <Clock size={16} />;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>
            <Lightbulb size={32} />
            AI Post Ideas
          </h1>
          <p>Generate creative post ideas powered by AI</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '24px' }}>
        {/* Input Form */}
        <div style={{
          backgroundColor: 'var(--card-bg)',
          borderRadius: '12px',
          padding: '24px',
          height: 'fit-content',
          border: '1px solid var(--color-borderLight)'
        }}>
          <form onSubmit={handleGenerate}>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                Topic / Subject
              </label>
              <input
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g., AI in marketing, fitness tips, productivity"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--input-bg)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                Industry
              </label>
              <select
                value={industry}
                onChange={e => setIndustry(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--input-bg)',
                  color: 'var(--text-primary)'
                }}
              >
                <option value="">Select an industry...</option>
                <option value="technology">Technology</option>
                <option value="healthcare">Healthcare</option>
                <option value="finance">Finance</option>
                <option value="education">Education</option>
                <option value="marketing">Marketing</option>
                <option value="ecommerce">E-commerce</option>
                <option value="fitness">Fitness & Wellness</option>
                <option value="food">Food & Beverage</option>
                <option value="travel">Travel & Tourism</option>
                <option value="fashion">Fashion & Beauty</option>
                <option value="entertainment">Entertainment</option>
                <option value="realestate">Real Estate</option>
                <option value="automotive">Automotive</option>
                <option value="nonprofit">Non-profit</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                Platform
              </label>
              <select
                value={platform}
                onChange={e => setPlatform(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--input-bg)',
                  color: 'var(--text-primary)'
                }}
              >
                <option value="general">All Platforms</option>
                <option value="twitter">Twitter/X</option>
                <option value="instagram">Instagram</option>
                <option value="linkedin">LinkedIn</option>
                <option value="facebook">Facebook</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
                <option value="threads">Threads</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                Tone
              </label>
              <select
                value={tone}
                onChange={e => setTone(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--input-bg)',
                  color: 'var(--text-primary)'
                }}
              >
                <option value="professional">Professional</option>
                <option value="casual">Casual & Friendly</option>
                <option value="humorous">Humorous</option>
                <option value="inspirational">Inspirational</option>
                <option value="educational">Educational</option>
                <option value="persuasive">Persuasive</option>
                <option value="storytelling">Storytelling</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                Number of Ideas: {count}
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={count}
                onChange={e => setCount(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>

            {error && (
              <div style={{
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                marginBottom: '16px',
                fontSize: '14px'
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '14px'
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                  Generating Ideas...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Generate Ideas
                </>
              )}
            </button>
          </form>
        </div>

        {/* Results */}
        <div>
          {loading ? (
            <div style={{
              backgroundColor: 'var(--card-bg)',
              borderRadius: '12px',
              padding: '48px',
              textAlign: 'center',
              border: '1px solid var(--color-borderLight)'
            }}>
              <Sparkles size={48} style={{ opacity: 0.5, marginBottom: '16px', animation: 'pulse 2s infinite' }} />
              <h3 style={{ marginBottom: '8px' }}>Generating Creative Ideas...</h3>
              <p style={{ color: 'var(--text-secondary)' }}>This may take a few seconds</p>
            </div>
          ) : ideas.length === 0 ? (
            <div style={{
              backgroundColor: 'var(--card-bg)',
              borderRadius: '12px',
              padding: '48px',
              textAlign: 'center',
              border: '1px solid var(--color-borderLight)'
            }}>
              <Lightbulb size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
              <h3 style={{ marginBottom: '8px' }}>Ready to Generate Ideas</h3>
              <p style={{ color: 'var(--text-secondary)' }}>
                Enter a topic or select an industry, then click "Generate Ideas"
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ margin: 0 }}>Generated Ideas ({ideas.length})</h3>
              {ideas.map((idea, index) => (
                <div
                  key={index}
                  style={{
                    backgroundColor: 'var(--card-bg)',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '1px solid var(--color-borderLight)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <h4 style={{ margin: 0, fontSize: '16px', flex: 1 }}>
                      {idea.headline || `Idea ${index + 1}`}
                    </h4>
                    <button
                      onClick={() => copyToClipboard(idea.content, index)}
                      className="btn btn-secondary"
                      style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      {copiedIndex === index ? (
                        <>
                          <Check size={14} />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          Copy
                        </>
                      )}
                    </button>
                  </div>

                  <div style={{
                    padding: '16px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-secondary)',
                    marginBottom: '12px',
                    whiteSpace: 'pre-wrap',
                    fontSize: '14px',
                    lineHeight: '1.6'
                  }}>
                    {idea.content}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                    {idea.hashtags && idea.hashtags.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <Hash size={14} style={{ color: 'var(--text-secondary)' }} />
                        {idea.hashtags.slice(0, 5).map((tag, i) => (
                          <span
                            key={i}
                            style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              backgroundColor: 'rgba(59, 130, 246, 0.1)',
                              color: '#3b82f6'
                            }}
                          >
                            #{tag.replace('#', '')}
                          </span>
                        ))}
                        {idea.hashtags.length > 5 && (
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            +{idea.hashtags.length - 5} more
                          </span>
                        )}
                      </div>
                    )}

                    {idea.best_time && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--bg-secondary)'
                      }}>
                        {getTimeIcon(idea.best_time)}
                        Best time: {idea.best_time}
                      </div>
                    )}

                    {idea.content_type && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--bg-secondary)'
                      }}>
                        {getContentTypeIcon(idea.content_type)}
                        {idea.content_type}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
