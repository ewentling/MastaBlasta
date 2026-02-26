import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountsApi, platformsApi, oauthApi, oauthAppsApi } from '../api';
import { Plus, Trash2, Edit2, Check, X, TestTube, Zap, Settings, Copy, RefreshCw } from 'lucide-react';
import type { Account, Platform } from '../types';
import OAuthAppModal from '../components/OAuthAppModal';
import AuditLogModal from '../components/AuditLogModal';

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const [showOAuthAppModal, setShowOAuthAppModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [testingAccount, setTestingAccount] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [showScopeModal, setShowScopeModal] = useState<string | null>(null);
  const [viewingLogsAccount, setViewingLogsAccount] = useState<Account | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedAccountId, setCopiedAccountId] = useState<string | null>(null);

  const copyUsername = async (accountId: string, username: string) => {
    try {
      await navigator.clipboard.writeText(`@${username}`);
      setCopiedAccountId(accountId);
      setTimeout(() => setCopiedAccountId(null), 2000);
    } catch (error) {
      console.error('Failed to copy username to clipboard:', error);
    }
  };

  const { data: accountsData, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.getAll(),
  });

  const { data: platformsData } = useQuery({
    queryKey: ['platforms'],
    queryFn: () => platformsApi.getAll(),
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

  const initConnect = (platformName: string) => {
    // Show scope selection modal first
    setShowScopeModal(platformName);
  };

  const handleConnect = async (platformName: string, scopes: string[] = []) => {
    setIsConnecting(platformName);
    setShowScopeModal(null);

    try {
      const response = await oauthApi.initFlow(platformName, scopes);

      if (!response || !response.oauth_url) {
        throw new Error(`Unable to connect to ${platformName}. OAuth not configured by admin.`);
      }

      const popup = window.open(
        response.oauth_url,
        'oauth_popup',
        'width=600,height=700,scrollbars=yes'
      );

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      const handleMessage = async (event: MessageEvent) => {
        const allowedOrigins = [window.location.origin];
        if (!allowedOrigins.includes(event.origin)) return;

        if (event.data.type === 'oauth_success') {
          window.removeEventListener('message', handleMessage);
          try {
            await oauthApi.connect({
              platform: platformName,
              oauth_data: event.data.data,
              account_name: '', // backend will generate a default name
            });
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            setTestResult({ success: true, message: `Successfully connected ${platformName} account!` });
            setTimeout(() => setTestResult(null), 5000);
            setIsConnecting(null);
          } catch (err: any) {
            setTestResult({ success: false, message: err.response?.data?.error || err.message || 'Failed to connect account' });
            setTimeout(() => setTestResult(null), 8000);
            setIsConnecting(null);
          }
        } else if (event.data.type === 'oauth_error') {
          window.removeEventListener('message', handleMessage);
          setTestResult({ success: false, message: event.data.error || 'Authorization failed' });
          setTimeout(() => setTestResult(null), 8000);
          setIsConnecting(null);
        }
      };

      window.addEventListener('message', handleMessage);

      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          setIsConnecting(null);
        }
      }, 1000);
    } catch (err: any) {
      setTestResult({ success: false, message: err.response?.data?.message || err.message || 'Failed to initialize OAuth' });
      setTimeout(() => setTestResult(null), 8000);
      setIsConnecting(null);
    }
  };

  const accounts = accountsData?.accounts || [];
  const platforms: Platform[] = platformsData?.platforms || [];

  return (
    <div>
      <div className="page-header">
        <h2>Platform Accounts</h2>
        <p>Manage your social media accounts and connected platforms</p>
      </div>

      {testResult && (
        <div className={`alert ${testResult.success ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: '2rem' }}>
          {testResult.success ? <Check size={20} /> : <X size={20} />}
          <span>{testResult.message}</span>
        </div>
      )}

      {isLoading ? (
        <div className="loading">Loading accounts...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1.5rem' }}>
          {platforms.map(platform => {
            const platformAccounts = accounts.filter((a: Account) => a.platform === platform.name);

            return (
              <div key={platform.name} style={{
                padding: '1.5rem',
                border: '1px solid var(--color-borderLight)',
                borderRadius: '12px',
                backgroundColor: 'var(--color-bgSecondary)',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'var(--color-bgPrimary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', border: '1px solid var(--color-borderLight)' }}>
                      {platform.icon || '🔗'}
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1.125rem' }}>{platform.display_name}</h3>
                  </div>
                  <button
                    onClick={() => setShowOAuthAppModal(true)}
                    className="btn-icon"
                    title="Advanced: Custom OAuth App Settings"
                    style={{ color: 'var(--color-textTertiary)' }}
                  >
                    <Settings size={18} />
                  </button>
                </div>

                {platformAccounts.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
                    {platformAccounts.map((account: Account) => (
                      <div key={account.id} style={{
                        padding: '1rem',
                        backgroundColor: 'var(--color-bgPrimary)',
                        borderRadius: '8px',
                        border: '1px solid var(--color-borderLight)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                          <div>
                            <div style={{ fontWeight: '600', color: 'var(--color-textPrimary)' }}>{account.name}</div>
                            {account.username && (
                              <div style={{ color: 'var(--color-textSecondary)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                                @{account.username}
                                <button
                                  onClick={(e) => { e.stopPropagation(); copyUsername(account.id, account.username!); }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedAccountId === account.id ? '#10b981' : 'var(--color-textTertiary)' }}
                                >
                                  {copiedAccountId === account.id ? <Check size={12} /> : <Copy size={12} />}
                                </button>
                              </div>
                            )}
                          </div>
                          {!account.enabled && <span className="badge badge-error" style={{ fontSize: '0.7rem' }}>Disabled</span>}
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-secondary btn-small"
                            onClick={() => handleTest(account.id)}
                            disabled={testingAccount === account.id}
                            style={{ flex: 1 }}
                          >
                            {testingAccount === account.id ? <RefreshCw size={14} className="spin" /> : <TestTube size={14} />}
                            {testingAccount === account.id ? 'Testing...' : 'Test'}
                          </button>
                          <button
                            className="btn btn-secondary btn-small"
                            onClick={() => initConnect(platform.name)}
                            disabled={isConnecting === platform.name}
                            title="Refresh tokens without losing history"
                            style={{ flex: 1 }}
                          >
                            <RefreshCw size={14} />
                            Reconnect
                          </button>
                          <button
                            className="btn btn-secondary btn-small"
                            onClick={() => setViewingLogsAccount(account)}
                            title="View Connection Logs"
                          >
                            Logs
                          </button>
                          <button
                            className="btn btn-secondary btn-small"
                            onClick={() => setEditingAccount(account)}
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            className="btn btn-danger btn-small"
                            onClick={() => {
                              if (confirm(`Delete account "${account.name}"?`)) {
                                deleteMutation.mutate(account.id);
                              }
                            }}
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={() => initConnect(platform.name)}
                      className="btn btn-secondary"
                      disabled={isConnecting === platform.name}
                      style={{ marginTop: 'auto' }}
                    >
                      {isConnecting === platform.name ? <RefreshCw size={16} className="spin" /> : <Plus size={16} />}
                      Add Another Account
                    </button>
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <p style={{ color: 'var(--color-textSecondary)', fontSize: '0.875rem', marginBottom: '1.25rem', textAlign: 'center' }}>
                      No accounts connected for {platform.display_name}. Connect one to start posting.
                    </p>
                    <button
                      onClick={() => initConnect(platform.name)}
                      className="btn btn-primary w-full"
                      disabled={isConnecting === platform.name}
                      style={{ marginTop: 'auto' }}
                    >
                      {isConnecting === platform.name ? <RefreshCw size={18} className="spin" /> : <Zap size={18} />}
                      {isConnecting === platform.name ? 'Connecting...' : `Connect ${platform.display_name}`}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
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

      {viewingLogsAccount && (
        <AuditLogModal
          account={viewingLogsAccount}
          onClose={() => setViewingLogsAccount(null)}
        />
      )}

      {showScopeModal && (
        <ScopeSelectionModal
          platform={showScopeModal}
          onClose={() => setShowScopeModal(null)}
          onConnect={(scopes) => handleConnect(showScopeModal, scopes)}
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
                value={username || ''}
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

// ── SCOPE SELECTION MODAL ───────────────────────────────────────────────────
function ScopeSelectionModal({
  platform,
  onClose,
  onConnect,
}: {
  platform: string;
  onClose: () => void;
  onConnect: (scopes: string[]) => void;
}) {
  const getScopes = () => {
    switch (platform) {
      case 'twitter':
        return [
          { id: 'tweet.read', label: 'Read Tweets', default: true },
          { id: 'tweet.write', label: 'Write Tweets', default: true },
          { id: 'users.read', label: 'Read Profile info', default: true },
          { id: 'offline.access', label: 'Offline Access (Refresh Tokens)', default: true }
        ];
      case 'facebook':
      case 'instagram':
      case 'threads':
        return [
          { id: 'pages_manage_posts', label: 'Manage Page Posts', default: true },
          { id: 'pages_read_engagement', label: 'Read Page Engagement', default: true },
          { id: 'pages_show_list', label: 'Show Page List', default: true },
          { id: 'instagram_basic', label: 'Instagram Basic Info', default: true },
          { id: 'instagram_content_publish', label: 'Publish to Instagram', default: true }
        ];
      case 'linkedin':
        return [
          { id: 'w_member_social', label: 'Create posts on LinkedIn', default: true },
          { id: 'r_liteprofile', label: 'Read basic profile info', default: true },
          { id: 'r_emailaddress', label: 'Read email address', default: true }
        ];
      case 'youtube':
        return [
          { id: 'https://www.googleapis.com/auth/youtube.upload', label: 'Upload YouTube Videos', default: true },
          { id: 'https://www.googleapis.com/auth/youtube', label: 'Manage YouTube Account', default: true }
        ];
      default:
        return [];
    }
  };

  const initialScopes = getScopes();
  const [selectedScopes, setSelectedScopes] = useState<string[]>(initialScopes.filter(s => s.default).map(s => s.id));

  const toggleScope = (scopeId: string) => {
    setSelectedScopes(prev =>
      prev.includes(scopeId) ? prev.filter(s => s !== scopeId) : [...prev, scopeId]
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Select Required Permissions</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <p style={{ color: 'var(--color-textSecondary)', fontSize: '0.875rem' }}>
            Choose the permissions (scopes) you want to grant MastaBlasta to your {platform} account. Checking fewer options might restrict some features.
          </p>
          {initialScopes.map(scope => (
            <label key={scope.id} className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={selectedScopes.includes(scope.id)}
                onChange={() => toggleScope(scope.id)}
              />
              <span style={{ fontWeight: '500' }}>{scope.label}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-textTertiary)' }}>({scope.id})</span>
            </label>
          ))}
          {initialScopes.length === 0 && (
            <div className="alert alert-info">No configurable scopes for this platform.</div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => onConnect(selectedScopes)}
            disabled={selectedScopes.length === 0 && initialScopes.length > 0}
          >
            Continue to auth
          </button>
        </div>
      </div>
    </div>
  );
}
