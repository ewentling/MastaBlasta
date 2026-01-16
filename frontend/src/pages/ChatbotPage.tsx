import { useState } from 'react';
import { Sparkles, Copy, RefreshCw, Wand2, Languages, Hash, AlertCircle } from 'lucide-react';
import { useAI } from '../contexts/AIContext';

interface GeneratedContent {
  id: string;
  type: string;
  content: string;
  timestamp: Date;
}

export default function ChatbotPage() {
  const { llmConfig } = useAI();
  const [activeTab, setActiveTab] = useState<'generate' | 'improve' | 'hashtags' | 'translate'>('generate');
  const [inputText, setInputText] = useState('');
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState('twitter');
  const [targetLanguage, setTargetLanguage] = useState('es');
  const [contentTone, setContentTone] = useState('professional');
  const [generationError, setGenerationError] = useState('');

  const platforms = ['twitter', 'facebook', 'instagram', 'linkedin', 'youtube'];
  const languages = [
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ja', name: 'Japanese' },
    { code: 'zh', name: 'Chinese' },
  ];
  const tones = ['professional', 'casual', 'friendly', 'humorous', 'formal', 'inspirational'];

  const handleGenerate = async () => {
    if (!llmConfig?.enabled || !llmConfig?.apiKey) {
      setGenerationError('AI is not configured. Please set up your LLM API key in Settings.');
      return;
    }

    if (!inputText.trim()) {
      setGenerationError('Please enter some text to generate content.');
      return;
    }

    setIsGenerating(true);
    setGenerationError('');

    try {
      let type = '';
      let content = '';
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:33766';

      switch (activeTab) {
        case 'generate':
          type = 'Post Ideas';
          // Generate 3 different captions
          const captions = await Promise.all([
            fetch(`${API_BASE_URL}/api/ai/generate-caption`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                topic: inputText,
                platform: selectedPlatform,
                tone: contentTone
              })
            }).then(async r => {
              if (!r.ok) throw new Error(`HTTP ${r.status}`);
              return r.json();
            }),
            fetch(`${API_BASE_URL}/api/ai/generate-caption`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                topic: inputText,
                platform: selectedPlatform,
                tone: contentTone === 'professional' ? 'casual' : 'professional'
              })
            }).then(async r => {
              if (!r.ok) throw new Error(`HTTP ${r.status}`);
              return r.json();
            }),
            fetch(`${API_BASE_URL}/api/ai/generate-caption`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                topic: inputText,
                platform: selectedPlatform,
                tone: 'inspirational'
              })
            }).then(async r => {
              if (!r.ok) throw new Error(`HTTP ${r.status}`);
              return r.json();
            })
          ]);
          
          content = captions.map((c, i) => 
            c.success ? `Post Idea ${i + 1}:\n${c.caption}` : `Error: ${c.error || 'Failed to generate'}`
          ).join('\n\n');
          break;

        case 'improve':
          type = 'Improved Content';
          const improveResponse = await fetch(`${API_BASE_URL}/api/ai/rewrite-content`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: inputText,
              source_platform: selectedPlatform,
              target_platform: selectedPlatform
            })
          });
          if (!improveResponse.ok) {
            throw new Error(`HTTP ${improveResponse.status}: Failed to improve content`);
          }
          const improveData = await improveResponse.json();
          content = improveData.success ? 
            `✨ Improved Version:\n\n${improveData.rewritten_content}\n\n${improveData.improvements?.join('\n') || ''}` :
            improveData.error || 'Error improving content';
          break;

        case 'hashtags':
          type = 'Hashtags';
          const hashtagResponse = await fetch(`${API_BASE_URL}/api/ai/suggest-hashtags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: inputText,
              platform: selectedPlatform,
              count: 10
            })
          });
          if (!hashtagResponse.ok) {
            throw new Error(`HTTP ${hashtagResponse.status}: Failed to generate hashtags`);
          }
          const hashtagData = await hashtagResponse.json();
          content = hashtagData.success ?
            hashtagData.hashtags.join(' ') :
            hashtagData.error || 'Error generating hashtags';
          break;

        case 'translate':
          type = 'Translation';
          const translateResponse = await fetch(`${API_BASE_URL}/api/ai/translate-content`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: inputText,
              target_language: targetLanguage,
              platform: selectedPlatform
            })
          });
          if (!translateResponse.ok) {
            throw new Error(`HTTP ${translateResponse.status}: Failed to translate content`);
          }
          const translateData = await translateResponse.json();
          const langName = languages.find(l => l.code === targetLanguage)?.name || targetLanguage;
          content = translateData.success ?
            `[${langName} Translation]\n\n${translateData.translated_content}` :
            translateData.error || 'Error translating content';
          break;
      }
      
      const newContent: GeneratedContent = {
        id: Date.now().toString(),
        type,
        content,
        timestamp: new Date(),
      };

      setGeneratedContent([newContent, ...generatedContent]);
    } catch (error) {
      setGenerationError('Failed to generate content. Please check your API configuration.');
      console.error('Generation error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div>
      <div className="page-header">
        <h2>AI Content Assistant</h2>
        <p>Use AI to generate, improve, and optimize your social media content</p>
      </div>

      {!llmConfig?.enabled && (
        <div className="alert alert-warning" style={{ marginBottom: '2rem' }}>
          <AlertCircle size={20} />
          <div>
            <strong>AI Not Configured</strong>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>
              Configure your LLM API key in Settings → AI Content to unlock AI-powered content generation.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem',
        marginBottom: '1.5rem',
        borderBottom: '2px solid var(--color-borderLight)',
      }}>
        {[
          { key: 'generate', icon: Sparkles, label: 'Generate Ideas' },
          { key: 'improve', icon: Wand2, label: 'Improve Content' },
          { key: 'hashtags', icon: Hash, label: 'Generate Hashtags' },
          { key: 'translate', icon: Languages, label: 'Translate' },
        ].map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            style={{
              padding: '0.75rem 1.5rem',
              background: activeTab === key ? 'var(--color-bgTertiary)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === key ? '2px solid var(--color-accentPrimary)' : 'none',
              color: activeTab === key ? 'var(--color-textPrimary)' : 'var(--color-textSecondary)',
              fontWeight: activeTab === key ? '600' : 'normal',
              cursor: 'pointer',
              marginBottom: '-2px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>

      <div className="card">
        <div style={{ padding: '1.5rem' }}>
          {/* Input Section */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="form-label" style={{ marginBottom: '0.5rem' }}>
              {activeTab === 'generate' && 'What do you want to post about?'}
              {activeTab === 'improve' && 'Paste your content to improve'}
              {activeTab === 'hashtags' && 'Enter your post content'}
              {activeTab === 'translate' && 'Enter content to translate'}
            </label>
            <textarea
              className="form-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                activeTab === 'generate' ? 'e.g., New product launch, industry trends, tips for beginners...' :
                activeTab === 'improve' ? 'Paste your existing content here...' :
                activeTab === 'hashtags' ? 'Paste your post content here...' :
                'Paste content to translate...'
              }
              rows={4}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'var(--color-bgSecondary)',
                border: '1px solid var(--color-borderLight)',
                borderRadius: '6px',
                color: 'var(--color-textPrimary)',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Options */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {activeTab !== 'translate' ? (
              <>
                <div>
                  <label className="form-label" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Platform</label>
                  <select
                    className="form-select"
                    value={selectedPlatform}
                    onChange={(e) => setSelectedPlatform(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      background: 'var(--color-bgSecondary)',
                      border: '1px solid var(--color-borderLight)',
                      borderRadius: '6px',
                      color: 'var(--color-textPrimary)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {platforms.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Tone</label>
                  <select
                    className="form-select"
                    value={contentTone}
                    onChange={(e) => setContentTone(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      background: 'var(--color-bgSecondary)',
                      border: '1px solid var(--color-borderLight)',
                      borderRadius: '6px',
                      color: 'var(--color-textPrimary)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {tones.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div>
                <label className="form-label" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Target Language</label>
                <select
                  className="form-select"
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    background: 'var(--color-bgSecondary)',
                    border: '1px solid var(--color-borderLight)',
                    borderRadius: '6px',
                    color: 'var(--color-textPrimary)',
                  }}
                >
                  {languages.map(l => (
                    <option key={l.code} value={l.code}>{l.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Generate Button */}
          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={isGenerating || !inputText.trim() || !llmConfig?.enabled}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            {isGenerating ? (
              <>
                <RefreshCw size={18} className="spinning" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                Generate with AI
              </>
            )}
          </button>

          {generationError && (
            <div className="alert alert-error" style={{ marginTop: '1rem' }}>
              <AlertCircle size={16} />
              {generationError}
            </div>
          )}
        </div>
      </div>

      {/* Generated Content */}
      {generatedContent.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ color: 'var(--color-textPrimary)', marginBottom: '1rem' }}>Generated Content</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {generatedContent.map((item) => (
              <div
                key={item.id}
                className="card"
                style={{
                  padding: '1.5rem',
                  backgroundColor: 'var(--color-bgSecondary)',
                  border: '1px solid var(--color-borderLight)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-textTertiary)', marginBottom: '0.25rem' }}>
                      {item.type} • {item.timestamp.toLocaleString()}
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => copyToClipboard(item.content)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <Copy size={16} />
                    Copy
                  </button>
                </div>
                <div style={{ 
                  color: 'var(--color-textPrimary)', 
                  whiteSpace: 'pre-wrap',
                  lineHeight: '1.6',
                  padding: '1rem',
                  background: 'var(--color-bgTertiary)',
                  borderRadius: '6px',
                }}>
                  {item.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
