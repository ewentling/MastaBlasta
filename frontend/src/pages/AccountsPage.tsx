import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountsApi, platformsApi, oauthApi, oauthAppsApi } from '../api';
import { Plus, Trash2, Edit2, Check, X, TestTube, Zap, Settings } from 'lucide-react';
import type { Account, CreateAccountRequest, Platform } from '../types';
import OAuthAppModal from '../components/OAuthAppModal';

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const [showOAuthModal, setShowOAuthModal] = useState(false);
  const [showOAuthAppModal, setShowOAuthAppModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [testingAccount, setTestingAccount] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const { data: accountsData, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.getAll(),
  });

  const { data: platformsData } = useQuery({
    queryKey: ['platforms'],
    queryFn: () => platformsApi.getAll(),
  });

  const { data: oauthAppsData } = useQuery({
    queryKey: ['oauth-apps'],
    queryFn: () => oauthAppsApi.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: accountsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setShowModal(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => accountsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setEditingAccount(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: accountsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });

  const testMutation = useMutation({
    mutationFn: accountsApi.test,
    onSuccess: (data) => {
      setTestResult(data);
      setTimeout(() => setTestResult(null), 5000);
    },
  });

  const handleTest = async (accountId: string) => {
    setTestingAccount(accountId);
    await testMutation.mutateAsync(accountId);
    setTestingAccount(null);
  };

  const accounts = accountsData?.accounts || [];
  const platforms = platformsData?.platforms || [];

  return (
    <div>
      <div className="page-header">
        <h2>Platform Accounts</h2>
        <p>Manage your social media accounts and credentials</p>
      </div>

      {testResult && (
        <div className={`alert ${testResult.success ? 'alert-success' : 'alert-error'}`}>
          {testResult.success ? <Check size={20} /> : <X size={20} />}
          <span>{testResult.message}</span>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3>Connected Accounts</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={() => setShowOAuthAppModal(true)}>
              <Settings size={18} />
              OAuth Apps
            </button>
            <button className="btn btn-primary" onClick={() => setShowOAuthModal(true)}>
              <Zap size={18} />
              Quick Connect
            </button>
          </div>
        </div>

        <div className="alert alert-info" style={{ margin: '1rem' }}>
          <span style={{ fontSize: '0.875rem' }}>
            💡 <strong>Getting Started:</strong> Click "OAuth Apps" to configure your own OAuth credentials for each platform, 
            then use "Quick Connect" to link your social media accounts. This allows you to manage your own API apps without 
            needing access to environment variables.
          </span>
        </div>

        {isLoading ? (
          <div className="loading">Loading accounts...</div>
        ) : accounts.length === 0 ? (
          <div className="empty-state">
            <Plus size={48} />
            <h3>No accounts connected</h3>
            <p>Add your first social media account to start posting</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {accounts.map(account => (
              <div
                key={account.id}
                style={{
                  padding: '1.25rem',
                  border: '1px solid var(--color-borderLight)',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: 'var(--color-bgSecondary)',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: '700', fontSize: '1.125rem', color: 'var(--color-textPrimary)' }}>
                      {account.name}
                    </div>
                    <span className="badge badge-info">{account.platform}</span>
                    {account.enabled ? (
                      <span className="badge badge-success">Active</span>
                    ) : (
                      <span className="badge badge-error">Disabled</span>
                    )}
                  </div>
                  {account.username && (
                    <div style={{ color: 'var(--color-textSecondary)', fontSize: '0.875rem' }}>
                      @{account.username}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => handleTest(account.id)}
                    disabled={testingAccount === account.id}
                  >
                    <TestTube size={16} />
                    {testingAccount === account.id ? 'Testing...' : 'Test'}
                  </button>
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => setEditingAccount(account)}
                  >
                    <Edit2 size={16} />
                    Edit
                  </button>
                  <button
                    className="btn btn-danger btn-small"
                    onClick={() => {
                      if (confirm(`Delete account "${account.name}"?`)) {
                        deleteMutation.mutate(account.id);
                      }
                    }}
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showOAuthModal && (
        <OAuthModal
          platforms={platforms}
          oauthApps={oauthAppsData?.oauth_apps || []}
          onClose={() => setShowOAuthModal(false)}
          onOpenOAuthApps={() => {
            setShowOAuthModal(false);
            setShowOAuthAppModal(true);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            setShowOAuthModal(false);
          }}
        />
      )}

      {editingAccount && (
        <EditAccountModal
          account={editingAccount}
          onClose={() => setEditingAccount(null)}
          onSave={(data) => {
            updateMutation.mutate({ id: editingAccount.id, data });
          }}
        />
      )}

      <OAuthAppModal isOpen={showOAuthAppModal} onClose={() => setShowOAuthAppModal(false)} />
    </div>
  );
}

function EditAccountModal({
  account,
  onClose,
  onSave,
}: {
  account: Account;
  onClose: () => void;
  onSave: (data: any) => void;
}) {
  const [name, setName] = useState(account.name);
  const [username, setUsername] = useState(account.username);
  const [enabled, setEnabled] = useState(account.enabled);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, username, enabled });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Account</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Account Name</label>
              <input
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                type="text"
                className="form-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                <span>Account is active</span>
              </label>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Check size={18} />
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function OAuthModal({
  platforms,
  oauthApps = [],
  onClose,
  onOpenOAuthApps,
  onSuccess,
}: {
  platforms: Platform[];
  oauthApps?: any[];
  onClose: () => void;
  onOpenOAuthApps: () => void;
  onSuccess: () => void;
}) {
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [accountName, setAccountName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  const hasOAuthApp = (platformName: string) => {
    return oauthApps.some(app => app.platform === platformName);
  };

  const handleConnect = async () => {
    if (!selectedPlatform) {
      setError('Please select a platform');
      return;
    }

    setIsConnecting(true);
    setError('');

    try {
      // Initialize OAuth flow
      const response = await oauthApi.initFlow(selectedPlatform);
      
      // Check if response exists and OAuth is properly configured
      if (!response || !response.oauth_url) {
        const envVars = response?.required_env_vars || [];
        throw new Error(
          response?.message || 
          `OAuth not configured for ${selectedPlatform}. ` +
          `Please set these environment variables: ${envVars.join(', ')}. ` +
          `See PLATFORM_SETUP.md for detailed instructions.`
        );
      }

      // Open OAuth popup
      const popup = window.open(
        response.oauth_url,
        'oauth_popup',
        'width=600,height=700,scrollbars=yes'
      );

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      // Listen for OAuth callback message
      const handleMessage = async (event: MessageEvent) => {
        // Verify event origin for security
        // Accept messages from same origin (frontend) or API server origin
        const allowedOrigins = [window.location.origin];
        if (!allowedOrigins.includes(event.origin)) {
          console.warn('Ignoring message from unauthorized origin:', event.origin);
          return;
        }

        if (event.data.type === 'oauth_success') {
          window.removeEventListener('message', handleMessage);
          
          try {
            // Check if demo mode was used
            if (event.data.data?.demo_mode) {
              setError(
                `Connected in demo mode. For real OAuth, configure credentials. ` +
                `The account may not work for actual posting without proper credentials.`
              );
            }
            
            // Complete the OAuth connection
            await oauthApi.connect({
              platform: selectedPlatform,
              oauth_data: event.data.data,
              account_name: accountName,  // Send as-is, backend will use default if empty
            });

            setIsConnecting(false);
            onSuccess();
          } catch (err: any) {
            const errorMessage = err.response?.data?.error || err.message || 'Failed to connect account';
            setError(errorMessage);
            setIsConnecting(false);
          }
        } else if (event.data.type === 'oauth_error') {
          window.removeEventListener('message', handleMessage);
          const errorMessage = event.data.error || 'Authorization failed';
          setError(errorMessage);
          setIsConnecting(false);
        }
      };

      window.addEventListener('message', handleMessage);

      // Check if popup was closed
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          setIsConnecting(false);
        }
      }, 1000);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to initialize OAuth';
      setError(errorMessage);
      setIsConnecting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Quick Connect with OAuth</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && (
            <div className="alert alert-error">
              <X size={20} />
              <span>{error}</span>
            </div>
          )}

          <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
            <Zap size={20} />
            <div>
              <span style={{ fontSize: '0.875rem' }}>
                Connect your account in one click! You'll be redirected to authorize access.
              </span>
              {oauthApps.length === 0 && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                  <strong>Note:</strong> You need to configure OAuth apps for the platforms you want to connect.{' '}
                  <button
                    type="button"
                    onClick={onOpenOAuthApps}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-primary)',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Setup OAuth Apps
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Platform *</label>
            <select
              className="form-select"
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              disabled={isConnecting}
              required
            >
              <option value="">Select a platform</option>
              {platforms.map(p => (
                <option key={p.name} value={p.name}>
                  {p.display_name} {hasOAuthApp(p.name) ? '✓ Configured' : '⚠️ Not configured'}
                </option>
              ))}
                <option key={p.name} value={p.name}>{p.display_name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Account Name (Optional)</label>
            <input
              type="text"
              className="form-input"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="e.g., My Business Account"
              disabled={isConnecting}
            />
            <p style={{ color: 'var(--color-textTertiary)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
              Leave empty to use default name
            </p>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isConnecting}>
            Cancel
          </button>
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={handleConnect}
            disabled={isConnecting || !selectedPlatform}
          >
            <Zap size={18} />
            {isConnecting ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}
