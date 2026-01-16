import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { oauthAppsApi } from '../api';
import { Plus, X, Save, Settings, ExternalLink, Key, Info } from 'lucide-react';

interface OAuthAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OAuthAppModal({ isOpen, onClose }: OAuthAppModalProps) {
  const queryClient = useQueryClient();
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [showSetupForm, setShowSetupForm] = useState(false);
  const [formData, setFormData] = useState({
    platform: '',
    app_name: '',
    client_id: '',
    client_secret: '',
    redirect_uri: '',
  });

  const { data: oauthAppsData, isLoading: isLoadingApps } = useQuery({
    queryKey: ['oauth-apps'],
    queryFn: () => oauthAppsApi.getAll(),
    enabled: isOpen,
  });

  const { data: requirementsData } = useQuery({
    queryKey: ['oauth-requirements'],
    queryFn: () => oauthAppsApi.getAllRequirements(),
  });

  const { data: platformRequirements } = useQuery({
    queryKey: ['oauth-requirements', selectedPlatform],
    queryFn: () => oauthAppsApi.getPlatformRequirements(selectedPlatform!),
    enabled: !!selectedPlatform,
  });

  const createMutation = useMutation({
    mutationFn: oauthAppsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oauth-apps'] });
      setShowSetupForm(false);
      setSelectedPlatform(null);
      setFormData({
        platform: '',
        app_name: '',
        client_id: '',
        client_secret: '',
        redirect_uri: '',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: oauthAppsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oauth-apps'] });
    },
  });

  const oauthApps = oauthAppsData?.oauth_apps || [];
  const platforms = requirementsData?.platforms || {};

  const handlePlatformSelect = (platform: string) => {
    setSelectedPlatform(platform);
    setShowSetupForm(true);
    setFormData({
      ...formData,
      platform,
      app_name: `${platforms[platform]?.display_name || platform} App`,
      redirect_uri: `http://localhost:33766/api/oauth/${platform}/callback`,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMutation.mutateAsync(formData);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this OAuth app configuration?')) {
      await deleteMutation.mutateAsync(id);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Settings size={24} />
            <h2>OAuth App Configuration</h2>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Info Alert */}
          <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
            <Info size={20} />
            <div>
              <strong>Why configure OAuth apps?</strong>
              <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                Configure your own OAuth apps to connect social media platforms. This allows you to use your own API credentials
                instead of shared environment variables, giving you better control and avoiding rate limits.
              </p>
            </div>
          </div>

          {/* Existing OAuth Apps */}
          {oauthApps.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Key size={20} />
                Your OAuth Apps
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {oauthApps.map((app: any) => (
                  <div
                    key={app.id}
                    style={{
                      padding: '1rem',
                      border: '1px solid var(--color-borderLight)',
                      borderRadius: '8px',
                      backgroundColor: 'var(--color-bgSecondary)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>{app.app_name}</div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--color-textSecondary)' }}>
                        Platform: <span className="badge badge-info">{app.platform}</span>
                      </div>
                      {app.redirect_uri && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-textSecondary)', marginTop: '0.25rem' }}>
                          Redirect URI: {app.redirect_uri}
                        </div>
                      )}
                    </div>
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => handleDelete(app.id)}
                    >
                      <X size={16} />
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Setup Form or Platform Selection */}
          {showSetupForm && selectedPlatform ? (
            <div>
              <button
                className="btn btn-secondary btn-small"
                onClick={() => {
                  setShowSetupForm(false);
                  setSelectedPlatform(null);
                }}
                style={{ marginBottom: '1rem' }}
              >
                ← Back to Platform Selection
              </button>

              <h3 style={{ marginBottom: '1rem' }}>
                Setup {platforms[selectedPlatform]?.display_name || selectedPlatform} OAuth
              </h3>

              {/* Setup Instructions */}
              {platformRequirements?.setup_instructions && (
                <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
                  <div>
                    <strong>Setup Instructions:</strong>
                    <ol style={{ marginTop: '0.5rem', marginLeft: '1.5rem', fontSize: '0.875rem' }}>
                      {platformRequirements.setup_instructions.map((step: string, index: number) => (
                        <li key={index} style={{ marginBottom: '0.25rem' }}>{step}</li>
                      ))}
                    </ol>
                    {platformRequirements.docs_url && (
                      <a
                        href={platformRequirements.docs_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.5rem' }}
                      >
                        Read Documentation <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>App Name (Friendly Name)</label>
                  <input
                    type="text"
                    value={formData.app_name}
                    onChange={(e) => setFormData({ ...formData, app_name: e.target.value })}
                    placeholder={`My ${platforms[selectedPlatform]?.display_name} App`}
                  />
                </div>

                <div className="form-group">
                  <label>
                    Client ID <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.client_id}
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                    placeholder="Enter your Client ID"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>
                    Client Secret <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="password"
                    value={formData.client_secret}
                    onChange={(e) => setFormData({ ...formData, client_secret: e.target.value })}
                    placeholder="Enter your Client Secret"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Redirect URI</label>
                  <input
                    type="text"
                    value={formData.redirect_uri}
                    onChange={(e) => setFormData({ ...formData, redirect_uri: e.target.value })}
                    placeholder={`http://localhost:33766/api/oauth/${selectedPlatform}/callback`}
                  />
                  <small style={{ color: 'var(--color-textSecondary)' }}>
                    This must match the redirect URI configured in your OAuth app
                  </small>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowSetupForm(false);
                      setSelectedPlatform(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={createMutation.isPending}
                  >
                    <Save size={16} />
                    {createMutation.isPending ? 'Saving...' : 'Save OAuth App'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div>
              <h3 style={{ marginBottom: '1rem' }}>Add OAuth App</h3>
              <p style={{ color: 'var(--color-textSecondary)', marginBottom: '1rem' }}>
                Select a platform to configure your OAuth application:
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                {Object.entries(platforms).map(([key, platform]: [string, any]) => {
                  const hasApp = oauthApps.some((app: any) => app.platform === key);
                  return (
                    <button
                      key={key}
                      className="btn btn-secondary"
                      onClick={() => handlePlatformSelect(key)}
                      disabled={hasApp}
                      style={{
                        padding: '1.5rem 1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.5rem',
                        opacity: hasApp ? 0.5 : 1,
                      }}
                    >
                      <span style={{ fontSize: '1.5rem' }}>{platform.icon || '🔗'}</span>
                      <span>{platform.display_name}</span>
                      {hasApp && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-success)' }}>✓ Configured</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
