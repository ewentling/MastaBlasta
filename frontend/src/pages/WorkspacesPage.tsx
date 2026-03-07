import { useState, useEffect } from 'react';
import { api } from '../api';
import { Building2, Plus, Users, Settings, X, UserPlus, Crown, Shield, Eye } from 'lucide-react';

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  role: string;
  created_at: string | null;
}

interface WorkspaceMember {
  user_id: string;
  email: string;
  name: string | null;
  role: string;
  can_approve: boolean;
  can_publish: boolean;
}

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  const [newMember, setNewMember] = useState({
    email: '',
    role: 'member',
    can_approve: false,
    can_publish: true
  });

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/v2/workspaces');
      setWorkspaces(response.data.workspaces || []);
    } catch (error) {
      console.error('Error loading workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/v2/workspaces', formData);
      setShowCreateModal(false);
      setFormData({ name: '', description: '' });
      loadWorkspaces();
    } catch (error) {
      console.error('Error creating workspace:', error);
      alert('Failed to create workspace');
    }
  };

  const openMembersModal = async (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    setShowMembersModal(true);
    setLoadingMembers(true);
    
    try {
      const response = await api.get(`/api/v2/workspaces/${workspace.id}/members`);
      setMembers(response.data.members || []);
    } catch (error) {
      console.error('Error loading members:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkspace) return;

    try {
      await api.post(`/api/v2/workspaces/${selectedWorkspace.id}/members`, newMember);
      setShowAddMemberModal(false);
      setNewMember({ email: '', role: 'member', can_approve: false, can_publish: true });
      
      // Reload members
      const response = await api.get(`/api/v2/workspaces/${selectedWorkspace.id}/members`);
      setMembers(response.data.members || []);
    } catch (error: any) {
      console.error('Error adding member:', error);
      alert(error.response?.data?.error || 'Failed to add member');
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown size={16} style={{ color: '#f59e0b' }} />;
      case 'admin': return <Shield size={16} style={{ color: '#8b5cf6' }} />;
      case 'editor': return <Settings size={16} style={{ color: '#3b82f6' }} />;
      case 'viewer': return <Eye size={16} style={{ color: '#6b7280' }} />;
      default: return <Users size={16} style={{ color: '#6b7280' }} />;
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>
            <Building2 size={32} />
            Workspaces
          </h1>
          <p>Manage team workspaces for different brands or clients</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={18} />
          New Workspace
        </button>
      </div>

      {loading ? (
        <div className="loading-state">Loading workspaces...</div>
      ) : workspaces.length === 0 ? (
        <div className="empty-state">
          <Building2 size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
          <h3>No Workspaces Yet</h3>
          <p>Create a workspace to collaborate with your team or manage multiple brands</p>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
            style={{ marginTop: '16px' }}
          >
            Create Workspace
          </button>
        </div>
      ) : (
        <div className="workspaces-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '20px'
        }}>
          {workspaces.map(workspace => (
            <div
              key={workspace.id}
              className="workspace-card"
              style={{
                backgroundColor: 'var(--card-bg)',
                borderRadius: '12px',
                padding: '20px',
                border: '1px solid var(--color-borderLight)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '20px',
                  fontWeight: '700'
                }}>
                  {workspace.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px' }}>{workspace.name}</h3>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    color: 'var(--text-secondary)'
                  }}>
                    {getRoleIcon(workspace.role)}
                    {workspace.role.charAt(0).toUpperCase() + workspace.role.slice(1)}
                  </span>
                </div>
              </div>

              {workspace.description && (
                <p style={{ margin: '0 0 16px 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
                  {workspace.description}
                </p>
              )}

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => openMembersModal(workspace)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Users size={16} />
                  Members
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 12px' }}
                >
                  <Settings size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h2>Create Workspace</h2>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleCreateWorkspace}>
              <div className="modal-body">
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>
                    Workspace Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., My Agency"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--input-bg)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe this workspace..."
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      resize: 'vertical'
                    }}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 20px', borderTop: '1px solid var(--border-color)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Members Modal */}
      {showMembersModal && selectedWorkspace && (
        <div className="modal-overlay" onClick={() => setShowMembersModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h2>{selectedWorkspace.name} - Members</h2>
              <button className="close-btn" onClick={() => setShowMembersModal(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              {(selectedWorkspace.role === 'owner' || selectedWorkspace.role === 'admin') && (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowAddMemberModal(true)}
                  style={{ width: '100%', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <UserPlus size={18} />
                  Add Member
                </button>
              )}

              {loadingMembers ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                  Loading members...
                </div>
              ) : members.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                  No members yet
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {members.map(member => (
                    <div
                      key={member.user_id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-secondary)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '16px',
                          fontWeight: '600'
                        }}>
                          {member.name?.charAt(0).toUpperCase() || member.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: '600' }}>{member.name || 'Unknown'}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{member.email}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {getRoleIcon(member.role)}
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="modal-overlay" onClick={() => setShowAddMemberModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h2>Add Member</h2>
              <button className="close-btn" onClick={() => setShowAddMemberModal(false)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddMember}>
              <div className="modal-body">
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={newMember.email}
                    onChange={e => setNewMember({ ...newMember, email: e.target.value })}
                    placeholder="Enter user's email"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--input-bg)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>
                    Role
                  </label>
                  <select
                    value={newMember.role}
                    onChange={e => setNewMember({ ...newMember, role: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--input-bg)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <option value="viewer">Viewer (read-only)</option>
                    <option value="member">Member</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newMember.can_approve}
                      onChange={e => setNewMember({ ...newMember, can_approve: e.target.checked })}
                    />
                    Can approve posts
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newMember.can_publish}
                      onChange={e => setNewMember({ ...newMember, can_publish: e.target.checked })}
                    />
                    Can publish posts
                  </label>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 20px', borderTop: '1px solid var(--border-color)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddMemberModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
