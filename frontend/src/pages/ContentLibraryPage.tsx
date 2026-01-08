import { useState, useEffect } from 'react';
import axios from 'axios';
import { Folder, File, Image, Video, FileText, Plus, X, Settings, Download, Trash2, CheckCircle, FolderOpen } from 'lucide-react';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  webViewLink?: string;
  size?: string;
  createdTime: string;
  type: 'file' | 'folder';
}

interface Template {
  id: string;
  name: string;
  content: string;
  platforms: string[];
  variables: string[];
  createdAt: string;
}

interface GoogleDriveSettings {
  enabled: boolean;
  accessToken: string;
  refreshToken: string;
  selectedFolderId: string;
  selectedFolderName: string;
}

export default function ContentLibraryPage() {
  const [activeTab, setActiveTab] = useState<'media' | 'templates'>('media');
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showGoogleSettings, setShowGoogleSettings] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [googleSettings, setGoogleSettings] = useState<GoogleDriveSettings>({
    enabled: false,
    accessToken: '',
    refreshToken: '',
    selectedFolderId: '',
    selectedFolderName: '',
  });
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    content: '',
    platforms: [] as string[],
  });

  // Load Google Drive settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('googleDriveSettings');
    if (saved) {
      setGoogleSettings(JSON.parse(saved));
    }
    loadTemplates();
  }, []);

  // Load files when Drive is connected
  useEffect(() => {
    if (googleSettings.enabled && googleSettings.selectedFolderId) {
      loadDriveFiles();
    }
  }, [googleSettings.enabled, googleSettings.selectedFolderId]);

  const loadTemplates = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/templates');
      setTemplates(response.data);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const loadDriveFiles = async () => {
    if (!googleSettings.enabled || !googleSettings.accessToken) return;

    try {
      const response = await axios.post('http://localhost:5000/api/google-drive/list', {
        access_token: googleSettings.accessToken,
        folder_id: googleSettings.selectedFolderId || 'root',
      });
      setDriveFiles(response.data);
    } catch (error) {
      console.error('Error loading Drive files:', error);
    }
  };

  const handleGoogleDriveAuth = () => {
    const clientId = localStorage.getItem('googleDriveClientId') || '';
    const redirectUri = `${window.location.origin}/auth/google/callback`;
    const scope = 'https://www.googleapis.com/auth/drive.readonly';
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scope)}&` +
      `access_type=offline&` +
      `prompt=consent`;
    
    const popup = window.open(authUrl, 'googleAuth', 'width=600,height=700');
    
    window.addEventListener('message', async (event) => {
      if (event.data.type === 'google_drive_auth_success') {
        const { code } = event.data;
        try {
          const response = await axios.post('http://localhost:5000/api/google-drive/auth', { code });
          const { access_token, refresh_token } = response.data;
          
          const newSettings = {
            ...googleSettings,
            enabled: true,
            accessToken: access_token,
            refreshToken: refresh_token,
          };
          
          setGoogleSettings(newSettings);
          localStorage.setItem('googleDriveSettings', JSON.stringify(newSettings));
          popup?.close();
        } catch (error) {
          console.error('Error exchanging auth code:', error);
        }
      }
    });
  };

  const handleSelectFolder = async (folderId: string, folderName: string) => {
    const newSettings = {
      ...googleSettings,
      selectedFolderId: folderId,
      selectedFolderName: folderName,
    };
    setGoogleSettings(newSettings);
    localStorage.setItem('googleDriveSettings', JSON.stringify(newSettings));
    setShowFolderPicker(false);
    
    // Reload files from new folder
    try {
      const response = await axios.post('http://localhost:5000/api/google-drive/list', {
        access_token: googleSettings.accessToken,
        folder_id: folderId,
      });
      setDriveFiles(response.data);
    } catch (error) {
      console.error('Error loading files from folder:', error);
    }
  };

  const handleCreateTemplate = async () => {
    try {
      const response = await axios.post('http://localhost:5000/api/templates', newTemplate);
      setTemplates([...templates, response.data]);
      setShowTemplateModal(false);
      setNewTemplate({ name: '', content: '', platforms: [] });
    } catch (error) {
      console.error('Error creating template:', error);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await axios.delete(`http://localhost:5000/api/templates/${templateId}`);
      setTemplates(templates.filter(t => t.id !== templateId));
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  const getFileIcon = (mimeType: string, type: string) => {
    if (type === 'folder') return <Folder size={40} color="var(--primary)" />;
    if (mimeType.startsWith('image/')) return <Image size={40} color="#4caf50" />;
    if (mimeType.startsWith('video/')) return <Video size={40} color="#2196f3" />;
    if (mimeType.includes('document') || mimeType.includes('text')) return <FileText size={40} color="#ff9800" />;
    return <File size={40} color="#666" />;
  };

  const extractVariables = (content: string): string[] => {
    const regex = /\{\{(\w+)\}\}/g;
    const matches = content.matchAll(regex);
    return Array.from(matches, m => m[1]);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>
            <Folder size={32} />
            Content Library & Templates
          </h1>
          <p>Manage reusable media and post templates</p>
        </div>
        <button className="btn-primary" onClick={() => setShowGoogleSettings(true)}>
          <Settings size={20} />
          Google Drive Settings
        </button>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid var(--border-color)' }}>
        <button
          onClick={() => setActiveTab('media')}
          style={{
            padding: '10px 20px',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'media' ? '2px solid var(--primary)' : 'none',
            color: activeTab === 'media' ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'media' ? '600' : 'normal',
            cursor: 'pointer',
            marginBottom: '-2px',
          }}
        >
          Media Library
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          style={{
            padding: '10px 20px',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'templates' ? '2px solid var(--primary)' : 'none',
            color: activeTab === 'templates' ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'templates' ? '600' : 'normal',
            cursor: 'pointer',
            marginBottom: '-2px',
          }}
        >
          Templates
        </button>
      </div>

      {/* Media Library Tab */}
      {activeTab === 'media' && (
        <div>
          {googleSettings.enabled && googleSettings.selectedFolderName && (
            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FolderOpen size={20} />
              <span>Current Folder: <strong>{googleSettings.selectedFolderName}</strong></span>
              <button className="btn-secondary" onClick={() => setShowFolderPicker(true)} style={{ marginLeft: 'auto' }}>
                Change Folder
              </button>
              <button className="btn-secondary" onClick={loadDriveFiles}>
                Refresh
              </button>
            </div>
          )}

          {!googleSettings.enabled && (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              backgroundColor: 'var(--card-bg)',
              borderRadius: '12px',
              border: '2px dashed var(--border-color)'
            }}>
              <Folder size={64} style={{ margin: '0 auto 20px', opacity: 0.5 }} />
              <h3>Connect Google Drive</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Store and access your media files directly from Google Drive
              </p>
              <button className="btn-primary" onClick={() => setShowGoogleSettings(true)}>
                <Settings size={20} />
                Setup Google Drive
              </button>
            </div>
          )}

          {googleSettings.enabled && driveFiles.length === 0 && (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              backgroundColor: 'var(--card-bg)',
              borderRadius: '12px'
            }}>
              <p>No files found in the selected folder</p>
              <button className="btn-secondary" onClick={() => setShowFolderPicker(true)} style={{ marginTop: '20px' }}>
                Select Different Folder
              </button>
            </div>
          )}

          {googleSettings.enabled && driveFiles.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '20px'
            }}>
              {driveFiles.map(file => (
                <div
                  key={file.id}
                  style={{
                    backgroundColor: 'var(--card-bg)',
                    borderRadius: '12px',
                    padding: '15px',
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                    border: '1px solid var(--border-color)',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
                    {file.thumbnailLink ? (
                      <img src={file.thumbnailLink} alt={file.name} style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px' }} />
                    ) : (
                      getFileIcon(file.mimeType, file.type)
                    )}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </div>
                  {file.size && (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {(parseInt(file.size) / 1024 / 1024).toFixed(2)} MB
                    </div>
                  )}
                  {file.webViewLink && (
                    <a
                      href={file.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-block',
                        marginTop: '10px',
                        padding: '5px 10px',
                        backgroundColor: 'var(--primary)',
                        color: 'white',
                        borderRadius: '6px',
                        fontSize: '12px',
                        textDecoration: 'none'
                      }}
                    >
                      Open in Drive
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div>
          <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-primary" onClick={() => setShowTemplateModal(true)}>
              <Plus size={20} />
              New Template
            </button>
          </div>

          {templates.length === 0 && (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              backgroundColor: 'var(--card-bg)',
              borderRadius: '12px',
              border: '2px dashed var(--border-color)'
            }}>
              <FileText size={64} style={{ margin: '0 auto 20px', opacity: 0.5 }} />
              <h3>No Templates Yet</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Create reusable post templates with placeholders
              </p>
              <button className="btn-primary" onClick={() => setShowTemplateModal(true)}>
                <Plus size={20} />
                Create Your First Template
              </button>
            </div>
          )}

          {templates.length > 0 && (
            <div style={{ display: 'grid', gap: '20px' }}>
              {templates.map(template => (
                <div
                  key={template.id}
                  style={{
                    backgroundColor: 'var(--card-bg)',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                    <h3 style={{ margin: 0 }}>{template.name}</h3>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#f44336',
                        cursor: 'pointer',
                        padding: '5px'
                      }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <div style={{
                    padding: '15px',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '8px',
                    marginBottom: '15px',
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {template.content}
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    <strong>Platforms:</strong>
                    {template.platforms.map(platform => (
                      <span key={platform} style={{
                        padding: '4px 12px',
                        backgroundColor: 'var(--primary)',
                        color: 'white',
                        borderRadius: '12px',
                        fontSize: '12px'
                      }}>
                        {platform}
                      </span>
                    ))}
                  </div>
                  {template.variables.length > 0 && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <strong>Variables:</strong>
                      {template.variables.map(variable => (
                        <code key={variable} style={{
                          padding: '4px 8px',
                          backgroundColor: '#333',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}>
                          {`{{${variable}}}`}
                        </code>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Google Drive Settings Modal */}
      {showGoogleSettings && (
        <div className="modal-overlay" onClick={() => setShowGoogleSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Google Drive Integration</h2>
              <button className="close-btn" onClick={() => setShowGoogleSettings(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                  <span style={{ fontWeight: '600' }}>Status:</span>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '12px',
                    backgroundColor: googleSettings.enabled ? '#4caf50' : '#666',
                    color: 'white',
                    fontSize: '14px'
                  }}>
                    {googleSettings.enabled ? 'Connected' : 'Not Connected'}
                  </span>
                </label>
              </div>

              <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <h3 style={{ marginBottom: '10px', fontSize: '16px' }}>Setup Instructions:</h3>
                <ol style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
                  <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>Google Cloud Console</a></li>
                  <li>Create a new project or select existing</li>
                  <li>Enable Google Drive API</li>
                  <li>Create OAuth 2.0 credentials</li>
                  <li>Add authorized redirect URI: <code style={{ backgroundColor: '#333', padding: '2px 6px', borderRadius: '4px' }}>{window.location.origin}/auth/google/callback</code></li>
                  <li>Save your Client ID to localStorage with key: <code style={{ backgroundColor: '#333', padding: '2px 6px', borderRadius: '4px' }}>googleDriveClientId</code></li>
                </ol>
              </div>

              <button 
                className="btn-primary" 
                onClick={handleGoogleDriveAuth}
                style={{ width: '100%', marginBottom: '10px' }}
              >
                {googleSettings.enabled ? 'Reconnect Google Drive' : 'Connect Google Drive'}
              </button>

              {googleSettings.enabled && !googleSettings.selectedFolderId && (
                <button 
                  className="btn-secondary" 
                  onClick={() => {
                    setShowGoogleSettings(false);
                    setShowFolderPicker(true);
                  }}
                  style={{ width: '100%' }}
                >
                  <FolderOpen size={20} />
                  Select Folder
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Folder Picker Modal */}
      {showFolderPicker && (
        <div className="modal-overlay" onClick={() => setShowFolderPicker(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Select Google Drive Folder</h2>
              <button className="close-btn" onClick={() => setShowFolderPicker(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '15px', color: 'var(--text-secondary)' }}>
                Enter the folder ID from Google Drive URL or use "root" for main folder
              </p>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                  Folder ID
                </label>
                <input
                  type="text"
                  placeholder="root or folder ID from URL"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      const input = e.target as HTMLInputElement;
                      handleSelectFolder(input.value || 'root', input.value || 'Root');
                    }
                  }}
                />
              </div>
              <button
                className="btn-primary"
                onClick={(e) => {
                  const input = e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement;
                  handleSelectFolder(input?.value || 'root', input?.value || 'Root');
                }}
                style={{ width: '100%' }}
              >
                Select Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Template Modal */}
      {showTemplateModal && (
        <div className="modal-overlay" onClick={() => setShowTemplateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Template</h2>
              <button className="close-btn" onClick={() => setShowTemplateModal(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                  Template Name
                </label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  placeholder="e.g., Product Launch"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                  Template Content
                </label>
                <textarea
                  value={newTemplate.content}
                  onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                  placeholder="Use {{variableName}} for placeholders. Example: Check out our new {{productName}}! Available now for {{price}}."
                  rows={6}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontFamily: 'monospace',
                    resize: 'vertical',
                  }}
                />
                {newTemplate.content && (
                  <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Variables found: {extractVariables(newTemplate.content).join(', ') || 'None'}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                  Target Platforms
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {['twitter', 'facebook', 'instagram', 'linkedin'].map(platform => (
                    <label key={platform} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={newTemplate.platforms.includes(platform)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewTemplate({ ...newTemplate, platforms: [...newTemplate.platforms, platform] });
                          } else {
                            setNewTemplate({ ...newTemplate, platforms: newTemplate.platforms.filter(p => p !== platform) });
                          }
                        }}
                      />
                      <span style={{ textTransform: 'capitalize' }}>{platform}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                className="btn-primary"
                onClick={handleCreateTemplate}
                disabled={!newTemplate.name || !newTemplate.content || newTemplate.platforms.length === 0}
                style={{ width: '100%' }}
              >
                Create Template
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal {
          background: var(--card-bg);
          border-radius: 12px;
          max-width: 600px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid var(--border-color);
        }
        .modal-body {
          padding: 20px;
        }
        .close-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-primary);
          padding: 5px;
        }
      `}</style>
    </div>
  );
}
