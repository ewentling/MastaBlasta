import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountsApi, platformsApi } from '../api';
import { Plus, Trash2, Edit2, Check, X, TestTube } from 'lucide-react';
import type { Account, CreateAccountRequest } from '../types';

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
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
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} />
            Add Account
          </button>
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

      {showModal && (
        <AccountModal
          platforms={platforms}
          onClose={() => setShowModal(false)}
          onSave={(data) => createMutation.mutate(data)}
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
    </div>
  );
}

function AccountModal({
  platforms,
  onClose,
  onSave,
}: {
  platforms: any[];
  onClose: () => void;
  onSave: (data: CreateAccountRequest) => void;
}) {
  const [platform, setPlatform] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [credentials, setCredentials] = useState<Record<string, string>>({});

  const credentialFields: Record<string, string[]> = {
    twitter: ['api_key', 'api_secret', 'access_token', 'access_token_secret'],
    facebook: ['access_token', 'page_id'],
    instagram: ['access_token', 'account_id'],
    linkedin: ['access_token', 'organization_id'],
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ platform, name, username, credentials });
  };

  const fields = platform ? credentialFields[platform] || [] : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add New Account</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Platform *</label>
              <select
                className="form-select"
                value={platform}
                onChange={(e) => {
                  setPlatform(e.target.value);
                  setCredentials({});
                }}
                required
              >
                <option value="">Select a platform</option>
                {platforms.map(p => (
                  <option key={p.name} value={p.name}>{p.display_name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Account Name *</label>
              <input
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., My Business Account"
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
                placeholder="Optional"
              />
            </div>

            {fields.length > 0 && (
              <>
                <div style={{ 
                  borderTop: '1px solid var(--color-borderLight)', 
                  paddingTop: '1rem', 
                  marginTop: '1rem',
                  marginBottom: '1rem'
                }}>
                  <div style={{ fontWeight: '600', marginBottom: '1rem', color: 'var(--color-textPrimary)' }}>
                    API Credentials
                  </div>
                </div>
                {fields.map(field => (
                  <div key={field} className="form-group">
                    <label className="form-label">
                      {field.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </label>
                    <input
                      type="password"
                      className="form-input"
                      value={credentials[field] || ''}
                      onChange={(e) => setCredentials({ ...credentials, [field]: e.target.value })}
                      placeholder="Enter credential"
                    />
                  </div>
                ))}
              </>
            )}

            <div className="alert alert-info">
              <span style={{ fontSize: '0.875rem' }}>
                💡 Credentials are stored securely and never logged. You can test them after saving.
              </span>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Plus size={18} />
              Add Account
            </button>
          </div>
        </form>
      </div>
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
