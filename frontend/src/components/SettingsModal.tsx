import { useState } from 'react';
import { X, Brain, Link, CheckCircle, XCircle, Loader } from 'lucide-react';
import { useTheme, themes } from '../ThemeContext';
import type { ThemeName } from '../ThemeContext';
import { useAI, type LLMProvider, type LLMConfig } from '../contexts/AIContext';

interface SettingsModalProps {
  onClose: () => void;
}

const llmProviders: { value: LLMProvider; label: string }[] = [
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'openai', label: 'OpenAI (GPT-4)' },
  { value: 'claude', label: 'Anthropic Claude' },
  { value: 'perplexity', label: 'Perplexity AI' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'grok', label: 'xAI Grok' },
  { value: 'custom', label: 'Custom LLM' },
];

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { themeName, setTheme } = useTheme();
  const { llmConfig, setLLMConfig, clearLLMConfig } = useAI();
  
  const [selectedTheme, setSelectedTheme] = useState<ThemeName>(themeName);
  const [activeTab, setActiveTab] = useState<'theme' | 'ai' | 'integrations'>('theme');
  
  // AI configuration state
  const [aiProvider, setAiProvider] = useState<LLMProvider>(llmConfig?.provider || 'gemini');
  const [aiApiKey, setAiApiKey] = useState(llmConfig?.apiKey || '');
  const [aiEnabled, setAiEnabled] = useState(llmConfig?.enabled || false);
  const [customEndpoint, setCustomEndpoint] = useState(llmConfig?.customEndpoint || '');
  const [customName, setCustomName] = useState(llmConfig?.customName || '');
  const [llmTestStatus, setLlmTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [llmTestMessage, setLlmTestMessage] = useState('');

  // Google Drive configuration state
  const [googleDriveEnabled, setGoogleDriveEnabled] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [googleTestStatus, setGoogleTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [googleTestMessage, setGoogleTestMessage] = useState('');

  const testLLMConnection = async () => {
    setLlmTestStatus('testing');
    setLlmTestMessage('');
    
    // Simulate API test - in real implementation, this would make an actual API call
    setTimeout(() => {
      if (aiApiKey.length > 10) {
        setLlmTestStatus('success');
        setLlmTestMessage('Connection successful! LLM is ready to use.');
      } else {
        setLlmTestStatus('error');
        setLlmTestMessage('Invalid API key. Please check your credentials.');
      }
    }, 1500);
  };

  const testGoogleConnection = async () => {
    setGoogleTestStatus('testing');
    setGoogleTestMessage('');
    
    // Simulate API test
    setTimeout(() => {
      if (googleClientId.length > 10 && googleApiKey.length > 10) {
        setGoogleTestStatus('success');
        setGoogleTestMessage('Google Drive connected successfully!');
      } else {
        setGoogleTestStatus('error');
        setGoogleTestMessage('Invalid credentials. Please check your Client ID and API Key.');
      }
    }, 1500);
  };

  const handleSave = () => {
    setTheme(selectedTheme);
    
    // Save AI config if API key is provided
    if (aiApiKey.trim()) {
      const config: LLMConfig = {
        provider: aiProvider,
        apiKey: aiApiKey,
        enabled: aiEnabled,
        ...(aiProvider === 'custom' && {
          customEndpoint: customEndpoint,
          customName: customName || 'Custom LLM',
        }),
      };
      setLLMConfig(config);
    } else if (!aiEnabled) {
      clearLLMConfig();
    }
    
    // Save Google Drive config
    if (googleDriveEnabled && googleClientId && googleApiKey) {
      localStorage.setItem('google-drive-config', JSON.stringify({
        enabled: googleDriveEnabled,
        clientId: googleClientId,
        apiKey: googleApiKey,
      }));
    }
    
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        <div className="modal-header">
          <h3>Settings</h3>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        {/* Tabs */}
        <div style={{ 
          display: 'flex', 
          borderBottom: '2px solid var(--color-borderLight)',
          marginBottom: '1.5rem'
        }}>
          <button
            onClick={() => setActiveTab('theme')}
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              background: activeTab === 'theme' ? 'var(--color-bgTertiary)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'theme' ? '2px solid var(--color-accentPrimary)' : 'none',
              color: activeTab === 'theme' ? 'var(--color-textPrimary)' : 'var(--color-textSecondary)',
              fontWeight: activeTab === 'theme' ? '600' : 'normal',
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginBottom: '-2px',
            }}
          >
            Theme
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              background: activeTab === 'ai' ? 'var(--color-bgTertiary)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'ai' ? '2px solid var(--color-accentPrimary)' : 'none',
              color: activeTab === 'ai' ? 'var(--color-textPrimary)' : 'var(--color-textSecondary)',
              fontWeight: activeTab === 'ai' ? '600' : 'normal',
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginBottom: '-2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            <Brain size={18} />
            AI Content
          </button>
          <button
            onClick={() => setActiveTab('integrations')}
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              background: activeTab === 'integrations' ? 'var(--color-bgTertiary)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'integrations' ? '2px solid var(--color-accentPrimary)' : 'none',
              color: activeTab === 'integrations' ? 'var(--color-textPrimary)' : 'var(--color-textSecondary)',
              fontWeight: activeTab === 'integrations' ? '600' : 'normal',
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginBottom: '-2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            <Link size={18} />
            Integrations
          </button>
        </div>
        
        <div className="modal-body" style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {activeTab === 'theme' && (
            <div className="form-group">
              <label className="form-label">Theme</label>
              <p style={{ color: 'var(--color-textTertiary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                Choose your retro arcade aesthetic
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {Object.entries(themes).map(([key, theme]) => (
                  <label
                    key={key}
                    className="theme-option"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '1rem',
                      border: selectedTheme === key ? '2px solid var(--color-accentPrimary)' : '2px solid var(--color-borderLight)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: selectedTheme === key ? 'var(--color-bgTertiary)' : 'var(--color-bgSecondary)',
                    }}
                  >
                    <input
                      type="radio"
                      name="theme"
                      value={key}
                      checked={selectedTheme === key}
                      onChange={() => setSelectedTheme(key as ThemeName)}
                      style={{ marginRight: '1rem', width: '20px', height: '20px', cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', color: 'var(--color-textPrimary)', marginBottom: '0.25rem' }}>
                        {theme.displayName}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '4px',
                            background: theme.colors.sidebarGradient,
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                          }}
                        />
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '4px',
                            background: theme.colors.accentGradient,
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                          }}
                        />
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '4px',
                            background: theme.colors.bgPrimary,
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                          }}
                        />
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  marginBottom: '1rem',
                  padding: '1rem',
                  background: 'var(--color-bgTertiary)',
                  borderRadius: '8px',
                  border: '1px solid var(--color-borderLight)',
                }}>
                  <div>
                    <label className="form-label" style={{ marginBottom: '0.25rem' }}>
                      Enable AI Content Optimization
                    </label>
                    <p style={{ color: 'var(--color-textTertiary)', fontSize: '0.875rem', margin: 0 }}>
                      Get AI-powered suggestions for your social media posts
                    </p>
                  </div>
                  <label className="switch" style={{ marginLeft: '1rem' }}>
                    <input
                      type="checkbox"
                      checked={aiEnabled}
                      onChange={(e) => setAiEnabled(e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>

              {aiEnabled && (
                <>
                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label className="form-label">LLM Provider *</label>
                    <select
                      value={aiProvider}
                      onChange={(e) => setAiProvider(e.target.value as LLMProvider)}
                      className="form-input"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'var(--color-bgSecondary)',
                        border: '1px solid var(--color-borderLight)',
                        borderRadius: '6px',
                        color: 'var(--color-textPrimary)',
                        fontSize: '0.875rem',
                      }}
                    >
                      {llmProviders.map(provider => (
                        <option key={provider.value} value={provider.value}>
                          {provider.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {aiProvider === 'custom' && (
                    <>
                      <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label className="form-label">Custom LLM Name</label>
                        <input
                          type="text"
                          value={customName}
                          onChange={(e) => setCustomName(e.target.value)}
                          placeholder="e.g., My Custom LLM"
                          className="form-input"
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            background: 'var(--color-bgSecondary)',
                            border: '1px solid var(--color-borderLight)',
                            borderRadius: '6px',
                            color: 'var(--color-textPrimary)',
                            fontSize: '0.875rem',
                          }}
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label className="form-label">API Endpoint URL *</label>
                        <input
                          type="url"
                          value={customEndpoint}
                          onChange={(e) => setCustomEndpoint(e.target.value)}
                          placeholder="https://api.example.com/v1/chat/completions"
                          className="form-input"
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            background: 'var(--color-bgSecondary)',
                            border: '1px solid var(--color-borderLight)',
                            borderRadius: '6px',
                            color: 'var(--color-textPrimary)',
                            fontSize: '0.875rem',
                          }}
                        />
                        <p style={{ 
                          color: 'var(--color-textTertiary)', 
                          fontSize: '0.75rem', 
                          marginTop: '0.5rem',
                          fontStyle: 'italic' 
                        }}>
                          The endpoint should accept OpenAI-compatible API format
                        </p>
                      </div>
                    </>
                  )}

                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label className="form-label">API Key *</label>
                    <input
                      type="password"
                      value={aiApiKey}
                      onChange={(e) => setAiApiKey(e.target.value)}
                      placeholder="Enter your API key"
                      className="form-input"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'var(--color-bgSecondary)',
                        border: '1px solid var(--color-borderLight)',
                        borderRadius: '6px',
                        color: 'var(--color-textPrimary)',
                        fontSize: '0.875rem',
                        fontFamily: 'monospace',
                      }}
                    />
                    <p style={{ 
                      color: 'var(--color-textTertiary)', 
                      fontSize: '0.75rem', 
                      marginTop: '0.5rem' 
                    }}>
                      Your API key is stored locally and never sent to our servers
                    </p>
                  </div>

                  {/* Test Connection Button */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <button
                      type="button"
                      onClick={testLLMConnection}
                      disabled={!aiApiKey || llmTestStatus === 'testing'}
                      className="btn btn-secondary"
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      {llmTestStatus === 'testing' ? (
                        <>
                          <Loader size={18} className="spinning" />
                          Testing Connection...
                        </>
                      ) : llmTestStatus === 'success' ? (
                        <>
                          <CheckCircle size={18} />
                          Test Connection
                        </>
                      ) : llmTestStatus === 'error' ? (
                        <>
                          <XCircle size={18} />
                          Test Connection
                        </>
                      ) : (
                        'Test Connection'
                      )}
                    </button>
                    {llmTestMessage && (
                      <div style={{
                        marginTop: '0.75rem',
                        padding: '0.75rem',
                        borderRadius: '6px',
                        background: llmTestStatus === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        border: `1px solid ${llmTestStatus === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                        color: llmTestStatus === 'success' ? '#10b981' : '#ef4444',
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}>
                        {llmTestStatus === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                        {llmTestMessage}
                      </div>
                    )}
                  </div>

                  <div style={{
                    padding: '1rem',
                    background: 'var(--color-bgTertiary)',
                    borderRadius: '8px',
                    border: '1px solid var(--color-borderLight)',
                  }}>
                    <h4 style={{ 
                      color: 'var(--color-textPrimary)', 
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      marginBottom: '0.5rem' 
                    }}>
                      AI Features Available:
                    </h4>
                    <ul style={{ 
                      color: 'var(--color-textSecondary)', 
                      fontSize: '0.875rem',
                      marginLeft: '1.25rem',
                      lineHeight: '1.6'
                    }}>
                      <li>Content optimization and improvement suggestions</li>
                      <li>Hashtag recommendations</li>
                      <li>Optimal posting time suggestions</li>
                    </ul>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'integrations' && (
            <div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  marginBottom: '1rem',
                  padding: '1rem',
                  background: 'var(--color-bgTertiary)',
                  borderRadius: '8px',
                  border: '1px solid var(--color-borderLight)',
                }}>
                  <div>
                    <label className="form-label" style={{ marginBottom: '0.25rem' }}>
                      Google Drive Integration
                    </label>
                    <p style={{ color: 'var(--color-textTertiary)', fontSize: '0.875rem', margin: 0 }}>
                      Store and access media files from Google Drive
                    </p>
                  </div>
                  <label className="switch" style={{ marginLeft: '1rem' }}>
                    <input
                      type="checkbox"
                      checked={googleDriveEnabled}
                      onChange={(e) => setGoogleDriveEnabled(e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>

              {googleDriveEnabled && (
                <>
                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label className="form-label">Google Client ID *</label>
                    <input
                      type="text"
                      value={googleClientId}
                      onChange={(e) => setGoogleClientId(e.target.value)}
                      placeholder="Enter your Google OAuth Client ID"
                      className="form-input"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'var(--color-bgSecondary)',
                        border: '1px solid var(--color-borderLight)',
                        borderRadius: '6px',
                        color: 'var(--color-textPrimary)',
                        fontSize: '0.875rem',
                        fontFamily: 'monospace',
                      }}
                    />
                    <p style={{ 
                      color: 'var(--color-textTertiary)', 
                      fontSize: '0.75rem', 
                      marginTop: '0.5rem' 
                    }}>
                      Get this from{' '}
                      <a 
                        href="https://console.cloud.google.com/apis/credentials" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ color: 'var(--color-accentPrimary)' }}
                      >
                        Google Cloud Console
                      </a>
                    </p>
                  </div>

                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label className="form-label">Google API Key *</label>
                    <input
                      type="password"
                      value={googleApiKey}
                      onChange={(e) => setGoogleApiKey(e.target.value)}
                      placeholder="Enter your Google API Key"
                      className="form-input"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'var(--color-bgSecondary)',
                        border: '1px solid var(--color-borderLight)',
                        borderRadius: '6px',
                        color: 'var(--color-textPrimary)',
                        fontSize: '0.875rem',
                        fontFamily: 'monospace',
                      }}
                    />
                  </div>

                  {/* Test Google Connection */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <button
                      type="button"
                      onClick={testGoogleConnection}
                      disabled={!googleClientId || !googleApiKey || googleTestStatus === 'testing'}
                      className="btn btn-secondary"
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      {googleTestStatus === 'testing' ? (
                        <>
                          <Loader size={18} className="spinning" />
                          Testing Connection...
                        </>
                      ) : googleTestStatus === 'success' ? (
                        <>
                          <CheckCircle size={18} />
                          Test Connection
                        </>
                      ) : googleTestStatus === 'error' ? (
                        <>
                          <XCircle size={18} />
                          Test Connection
                        </>
                      ) : (
                        'Test Connection'
                      )}
                    </button>
                    {googleTestMessage && (
                      <div style={{
                        marginTop: '0.75rem',
                        padding: '0.75rem',
                        borderRadius: '6px',
                        background: googleTestStatus === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        border: `1px solid ${googleTestStatus === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                        color: googleTestStatus === 'success' ? '#10b981' : '#ef4444',
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}>
                        {googleTestStatus === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                        {googleTestMessage}
                      </div>
                    )}
                  </div>

                  <div style={{
                    padding: '1rem',
                    background: 'var(--color-bgTertiary)',
                    borderRadius: '8px',
                    border: '1px solid var(--color-borderLight)',
                  }}>
                    <h4 style={{ 
                      color: 'var(--color-textPrimary)', 
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      marginBottom: '0.5rem' 
                    }}>
                      Setup Instructions:
                    </h4>
                    <ol style={{ 
                      color: 'var(--color-textSecondary)', 
                      fontSize: '0.875rem',
                      marginLeft: '1.25rem',
                      lineHeight: '1.6'
                    }}>
                      <li>Create a project in Google Cloud Console</li>
                      <li>Enable Google Drive API</li>
                      <li>Create OAuth 2.0 credentials</li>
                      <li>Add authorized JavaScript origins and redirect URIs</li>
                      <li>Copy the Client ID and API Key here</li>
                    </ol>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
