import { useState, useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import {
  Shield, Users, BarChart3, CreditCard, CheckCircle, XCircle, Clock,
  AlertTriangle, Crown, Zap, TrendingUp, Settings, DollarSign, Mail,
  Flag, Activity, UserPlus, Trash2, Ban, RefreshCw, Search, X,
  ExternalLink, Copy, Eye, EyeOff, Save, ChevronRight, Globe,
} from 'lucide-react';
import { formatDateTime } from '../utils/timezone';
import { UserGrowthChart } from '../components/admin/UserGrowthChart';
import { RevenueChart } from '../components/admin/RevenueChart';
import { SubscriptionDistributionChart } from '../components/admin/SubscriptionDistributionChart';
import { SystemHealthPanel } from '../components/admin/SystemHealthPanel';
import { RevenueSummaryCards } from '../components/admin/RevenueSummaryCards';
import { FailedPaymentsTable } from '../components/admin/FailedPaymentsTable';
import { EmailComposer } from '../components/admin/EmailComposer';
import { SmtpConfigPanel } from '../components/admin/SmtpConfigPanel';
import { PostModerationTable } from '../components/admin/PostModerationTable';
import { PlatformConfigTab } from '../components/admin/PlatformConfigTab';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  auth_provider: string;
  created_at: string;
  last_login: string | null;
  subscription: Subscription | null;
}

interface Subscription {
  id: string;
  tier: string;
  tier_name?: string;
  status: string;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  payment_method: string | null;
  last_payment_date: string | null;
  last_payment_amount: number | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  admin_notes: string | null;
  limits?: any;
}

interface UserDetails extends User {
  usage: {
    period_start: string;
    period_end: string;
    posts_created: number;
    posts_scheduled: number;
    posts_published: number;
    api_calls: number;
    storage_used_mb: number;
    ai_requests: number;
    analytics_views: number;
    social_listening_queries: number;
  } | null;
}

interface SystemMetrics {
  users: { total: number; active: number; inactive: number };
  subscriptions: { by_tier: Record<string, number>; by_status: Record<string, number> };
  usage_this_month: { posts_created: number; api_calls: number; storage_used_mb: number; ai_requests: number };
  timestamp: string;
}

// Helper to extract a meaningful error message from an axios error
function apiError(e: any, fallback: string): Error {
  return new Error(e?.response?.data?.error || e?.message || fallback);
}

const adminApi = {
  getUsers: async (): Promise<{ users: User[]; total: number }> => {
    const r = await api.get('/admin/users');
    return r.data;
  },
  getUserDetails: async (userId: string): Promise<UserDetails> => {
    const r = await api.get(`/admin/users/${userId}`);
    return r.data;
  },
  createUser: async (data: { email: string; full_name: string; role: string; password: string }) => {
    try {
      const r = await api.post('/admin/users', data);
      return r.data;
    } catch (e: any) {
      throw apiError(e, 'Failed to create user');
    }
  },
  deleteUser: async (userId: string) => {
    try {
      const r = await api.delete(`/admin/users/${userId}`);
      return r.data;
    } catch (e: any) {
      throw apiError(e, 'Failed to delete user');
    }
  },
  updateSubscription: async (userId: string, data: any) => {
    const r = await api.patch(`/admin/users/${userId}/subscription`, data);
    return r.data;
  },
  suspendUser: async (userId: string, reason: string) => {
    const r = await api.post(`/admin/users/${userId}/suspend`, { reason });
    return r.data;
  },
  activateUser: async (userId: string) => {
    const r = await api.post(`/admin/users/${userId}/activate`);
    return r.data;
  },
  getMetrics: async (): Promise<SystemMetrics> => {
    const r = await api.get('/admin/metrics');
    return r.data;
  },
  getSquareConfig: async () => {
    const r = await api.get('/admin/square-config');
    return r.data;
  },
  updateSquareConfig: async (data: Record<string, string>) => {
    try {
      const r = await api.post('/admin/square-config', data);
      return r.data;
    } catch (e: any) {
      throw apiError(e, 'Failed to save configuration');
    }
  },
  testSquareConnection: async () => {
    const r = await api.post('/admin/square-test-connection');
    return r.data;
  },
};

function Avatar({ name, email }: { name?: string; email: string }) {
  const initials = name
    ? name.split(' ').filter((w) => w).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : email.slice(0, 2).toUpperCase();
  const colors = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'];
  const color = colors[email.charCodeAt(0) % colors.length];
  return (
    <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center text-white text-sm font-semibold flex-shrink-0`}>
      {initials}
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const map: Record<string, { style: CSSProperties; icon: ReactNode }> = {
    free:       { style: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#8090c2' }, icon: null },
    starter:    { style: { background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.25)', color: '#00e5ff' }, icon: <Zap className="w-3 h-3" /> },
    pro:        { style: { background: 'rgba(124,77,255,0.1)', border: '1px solid rgba(124,77,255,0.3)', color: '#a78bfa' }, icon: <Crown className="w-3 h-3" /> },
    enterprise: { style: { background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }, icon: <TrendingUp className="w-3 h-3" /> },
  };
  const { style, icon } = map[tier] ?? map.free;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={style}>
      {icon}{tier.toUpperCase()}
    </span>
  );
}

function SubStatusBadge({ status }: { status: string }) {
  const map: Record<string, CSSProperties> = {
    active:    { background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399' },
    trial:     { background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8' },
    suspended: { background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' },
    cancelled: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' },
    expired:   { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#8090c2' },
  };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={map[status] ?? map.expired}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

type Tab = 'users' | 'metrics' | 'analytics' | 'revenue' | 'email' | 'moderation' | 'platforms' | 'square';

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('users');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [editingSubscription, setEditingSubscription] = useState(false);
  const [subscriptionForm, setSubscriptionForm] = useState({ tier: '', status: '', admin_notes: '' });
  const [suspendReason, setSuspendReason] = useState('');

  const [showAddUser, setShowAddUser] = useState(false);
  const [addUserForm, setAddUserForm] = useState({ email: '', full_name: '', role: 'editor', password: '' });
  const [addUserError, setAddUserError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Square config form state
  const [squareForm, setSquareForm] = useState({
    access_token: '',
    environment: 'sandbox',
    location_id: '',
    webhook_signature_key: '',
    catalog_starter: '',
    catalog_pro: '',
    catalog_enterprise: '',
  });
  const [squareFormDirty, setSquareFormDirty] = useState(false);
  const [squareSaveResult, setSquareSaveResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [showWebhookKey, setShowWebhookKey] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showSmtpModal, setShowSmtpModal] = useState(false);

  const { data: usersData, isLoading: usersLoading, isError: usersError } = useQuery({
    queryKey: ['admin-users'],
    queryFn: adminApi.getUsers,
  });

  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: adminApi.getMetrics,
    refetchInterval: 30000,
  });

  const { data: userDetails } = useQuery({
    queryKey: ['admin-user-details', selectedUser],
    queryFn: () => adminApi.getUserDetails(selectedUser!),
    enabled: !!selectedUser,
  });

  const { data: squareConfig, isLoading: squareConfigLoading, isError: squareConfigError } = useQuery({
    queryKey: ['admin-square-config'],
    queryFn: adminApi.getSquareConfig,
    enabled: activeTab === 'square',
  });

  // Pre-populate non-sensitive form fields from saved config
  // (sensitive fields – access_token, webhook_signature_key – are masked and must be re-entered to change)
  const squareFormInitialized = squareConfig && !squareFormDirty;
  if (squareFormInitialized && squareForm.location_id === '' && squareConfig.location_id) {
    setSquareForm((f) => ({
      ...f,
      environment: squareConfig.environment || 'sandbox',
      location_id: squareConfig.location_id || '',
      catalog_starter: squareConfig.catalog_starter || '',
      catalog_pro: squareConfig.catalog_pro || '',
      catalog_enterprise: squareConfig.catalog_enterprise || '',
    }));
  }

  const createUserMutation = useMutation({
    mutationFn: adminApi.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setShowAddUser(false);
      setAddUserForm({ email: '', full_name: '', role: 'editor', password: '' });
      setAddUserError('');
    },
    onError: (e: Error) => setAddUserError(e.message),
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => adminApi.deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setDeleteTarget(null);
    },
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: any }) =>
      adminApi.updateSubscription(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-details'] });
      setEditingSubscription(false);
    },
  });

  const suspendMutation = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      adminApi.suspendUser(userId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-details'] });
      setSelectedUser(null);
      setSuspendReason('');
    },
  });

  const activateMutation = useMutation({
    mutationFn: adminApi.activateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-details'] });
    },
  });

  const saveSquareConfigMutation = useMutation({
    mutationFn: adminApi.updateSquareConfig,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-square-config'] });
      setSquareFormDirty(false);
      setSquareSaveResult({ success: true, message: data.message || 'Configuration saved successfully' });
      // Clear access_token / webhook_key fields since they are now persisted (show masked on next load)
      setSquareForm((f) => ({ ...f, access_token: '', webhook_signature_key: '' }));
    },
    onError: (e: Error) => setSquareSaveResult({ success: false, message: e.message }),
  });

  const handleSquareFieldChange = (field: string, value: string) => {
    setSquareForm((f) => ({ ...f, [field]: value }));
    setSquareFormDirty(true);
    setSquareSaveResult(null);
  };

  const handleCopyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return (usersData?.users ?? []).filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.full_name ?? '').toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [usersData, searchQuery]);

  const handleTestSquareConnection = async () => {
    setTestingConnection(true);
    setConnectionTestResult(null);
    try {
      const result = await adminApi.testSquareConnection();
      setConnectionTestResult({
        success: result.success,
        message: result.message + (result.locations_count !== undefined ? ` (${result.locations_count} locations found)` : ''),
      });
    } catch (error: any) {
      setConnectionTestResult({ success: false, message: error.message || 'Failed to test connection' });
    } finally {
      setTestingConnection(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: 'users',      label: 'Users',      icon: <Users className="w-4 h-4" /> },
    { id: 'metrics',    label: 'Metrics',    icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'analytics',  label: 'Analytics',  icon: <Activity className="w-4 h-4" /> },
    { id: 'revenue',    label: 'Revenue',    icon: <DollarSign className="w-4 h-4" /> },
    { id: 'email',      label: 'Email',      icon: <Mail className="w-4 h-4" /> },
    { id: 'moderation', label: 'Moderation', icon: <Flag className="w-4 h-4" /> },
    { id: 'platforms',  label: 'Platforms',  icon: <Globe className="w-4 h-4" /> },
    { id: 'square',     label: 'Square',     icon: <CreditCard className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen">

      {/* Header */}
      <div className="px-6 py-8" style={{ background: 'linear-gradient(135deg, rgba(2,4,18,0.95) 0%, rgba(12,18,50,0.9) 100%)', borderBottom: '1px solid rgba(0,229,255,0.15)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/20 border border-blue-500/30 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Admin Dashboard</h1>
              <p className="text-slate-400 text-sm mt-0.5">Manage users, subscriptions, and system health</p>
            </div>
          </div>
          {metricsData && (
            <div className="hidden md:flex items-center gap-6 text-center">
              <div>
                <p className="text-2xl font-bold text-white">{metricsData.users.total}</p>
                <p className="text-xs text-slate-400 uppercase tracking-wide">Total Users</p>
              </div>
              <div className="w-px h-10 bg-slate-700" />
              <div>
                <p className="text-2xl font-bold text-emerald-400">{metricsData.users.active}</p>
                <p className="text-xs text-slate-400 uppercase tracking-wide">Active</p>
              </div>
              <div className="w-px h-10 bg-slate-700" />
              <div>
                <p className="text-2xl font-bold text-white">{metricsData.usage_this_month.posts_created}</p>
                <p className="text-xs text-slate-400 uppercase tracking-wide">Posts / Month</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ background: 'rgba(5,7,30,0.9)', borderBottom: '1px solid rgba(0,229,255,0.15)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-2 -mb-px overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors rounded-t-lg ${
                  activeTab === tab.id
                    ? 'border-cyan-400 text-cyan-400 bg-cyan-400/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500 hover:bg-white/5'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div style={{ background: 'rgba(5,7,30,0.85)', border: '1px solid rgba(255,255,255,0.08)' }} className="rounded-xl overflow-hidden shadow-lg">
            <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by name, email, or role…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-slate-500"
                />
              </div>
              <button
                onClick={() => setShowAddUser(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap text-white"
                style={{ background: 'linear-gradient(120deg, #00e5ff 0%, #7c4dff 100%)' }}
              >
                <UserPlus className="w-4 h-4" />
                Add User
              </button>
            </div>

            {usersLoading ? (
              <div className="py-16 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3" />
                Loading users…
              </div>
            ) : usersError ? (
              <div className="py-16 text-center text-red-400">
                <XCircle className="w-8 h-8 mx-auto mb-3 opacity-70" />
                <p className="text-sm">Failed to load users. Please refresh or check your connection.</p>
                <button
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-users'] })}
                  className="mt-3 text-xs text-cyan-400 hover:text-cyan-300 underline"
                >
                  Try again
                </button>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <Users className="w-8 h-8 mx-auto mb-3 opacity-40" />
                {searchQuery ? 'No users match your search.' : 'No users yet.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Plan</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Subscription</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Joined</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody style={{ borderTop: 'none' }}>
                    {filteredUsers.map((user) => (
                      <tr
                        key={user.id}
                        className="transition-colors hover:bg-white/5"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={user.full_name} email={user.email} />
                            <div>
                              <p className="text-sm font-medium text-white">{user.full_name || '—'}</p>
                              <p className="text-xs text-slate-400">{user.email}</p>
                            </div>
                            <span className={`inline-block w-2 h-2 rounded-full ${user.is_active ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-medium text-slate-300 px-2 py-0.5 rounded-full capitalize" style={{ background: 'rgba(255,255,255,0.08)' }}>{user.role}</span>
                        </td>
                        <td className="px-6 py-4">
                          {user.subscription ? <TierBadge tier={user.subscription.tier} /> : <span className="text-slate-500 text-xs">—</span>}
                        </td>
                        <td className="px-6 py-4">
                          {user.subscription ? <SubStatusBadge status={user.subscription.status} /> : <span className="text-slate-500 text-xs">—</span>}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400">
                          {formatDateTime.date(user.created_at)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setSelectedUser(user.id);
                                setSubscriptionForm({
                                  tier: user.subscription?.tier || 'free',
                                  status: user.subscription?.status || 'trial',
                                  admin_notes: user.subscription?.admin_notes || '',
                                });
                              }}
                              className="text-xs font-medium text-cyan-400 hover:text-cyan-300 px-2 py-1 rounded transition-colors"
                              style={{ background: 'rgba(0,229,255,0.08)' }}
                            >
                              Details
                            </button>
                            {user.role !== 'admin' && (
                              <>
                                {user.is_active ? (
                                  <button
                                    onClick={() => { setSuspendReason(''); setSelectedUser(user.id); }}
                                    title="Suspend user"
                                    className="p-1.5 rounded text-amber-400 hover:text-amber-300 transition-colors"
                                  >
                                    <Ban className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => activateMutation.mutate(user.id)}
                                    disabled={activateMutation.isPending}
                                    title="Activate user"
                                    className="p-1.5 rounded text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => setDeleteTarget(user)}
                                  title="Delete user"
                                  className="p-1.5 rounded text-slate-500 hover:text-red-400 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-6 py-3 text-xs text-slate-500" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                  Showing {filteredUsers.length} of {usersData?.total ?? 0} users
                </div>
              </div>
            )}
          </div>
        )}

        {/* Metrics Tab */}
        {activeTab === 'metrics' && (
          <div className="space-y-6">
            {metricsLoading ? (
              <div className="py-16 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3" />
                Loading metrics…
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {[
                    { label: 'Total Users', value: metricsData?.users.total, icon: <Users className="w-5 h-5" />, color: 'text-cyan-400', iconBg: 'rgba(0,229,255,0.1)', sub: `${metricsData?.users.active} active · ${metricsData?.users.inactive} inactive` },
                    { label: 'Posts / Month', value: metricsData?.usage_this_month.posts_created, icon: <BarChart3 className="w-5 h-5" />, color: 'text-emerald-400', iconBg: 'rgba(52,211,153,0.1)', sub: undefined },
                    { label: 'API Calls', value: metricsData?.usage_this_month.api_calls?.toLocaleString(), icon: <Zap className="w-5 h-5" />, color: 'text-violet-400', iconBg: 'rgba(124,77,255,0.1)', sub: undefined },
                    { label: 'AI Requests', value: metricsData?.usage_this_month.ai_requests, icon: <Activity className="w-5 h-5" />, color: 'text-amber-400', iconBg: 'rgba(251,191,36,0.1)', sub: undefined },
                  ].map((card) => (
                    <div key={card.label} className="rounded-xl p-6 shadow-lg" style={{ background: 'rgba(5,7,30,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-medium text-slate-400">{card.label}</p>
                        <div className={`w-9 h-9 ${card.color} rounded-lg flex items-center justify-center`} style={{ background: card.iconBg }}>{card.icon}</div>
                      </div>
                      <p className="text-3xl font-bold text-white">{card.value ?? '—'}</p>
                      {card.sub && <p className="text-xs text-slate-500 mt-1">{card.sub}</p>}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="rounded-xl p-6 shadow-lg" style={{ background: 'rgba(5,7,30,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <h3 className="text-xs font-semibold text-slate-400 mb-4 uppercase tracking-wide">By Tier</h3>
                    <div className="space-y-3">
                      {Object.entries(metricsData?.subscriptions.by_tier || {}).map(([tier, count]) => (
                        <div key={tier} className="flex items-center justify-between">
                          <TierBadge tier={tier} />
                          <span className="text-xl font-bold text-white">{count as number}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl p-6 shadow-lg" style={{ background: 'rgba(5,7,30,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <h3 className="text-xs font-semibold text-slate-400 mb-4 uppercase tracking-wide">By Status</h3>
                    <div className="space-y-3">
                      {Object.entries(metricsData?.subscriptions.by_status || {}).map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between">
                          <SubStatusBadge status={status} />
                          <span className="text-xl font-bold text-white">{count as number}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <SystemHealthPanel />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <UserGrowthChart />
              <RevenueChart />
            </div>
            <SubscriptionDistributionChart />
          </div>
        )}

        {/* Revenue Tab */}
        {activeTab === 'revenue' && (
          <div className="space-y-6">
            <RevenueSummaryCards />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RevenueChart days={180} />
              <SubscriptionDistributionChart />
            </div>
            <FailedPaymentsTable />
          </div>
        )}

        {/* Email Tab */}
        {activeTab === 'email' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Email</h2>
              <button
                onClick={() => setShowSmtpModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-200 rounded-lg hover:text-white transition-colors"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                <Settings className="w-4 h-4" />
                Configure SMTP
              </button>
            </div>
            <EmailComposer />
          </div>
        )}

        {/* Moderation Tab */}
        {activeTab === 'moderation' && <PostModerationTable />}

        {/* Platforms Tab */}
        {activeTab === 'platforms' && <PlatformConfigTab />}

        {/* Square Tab */}
        {activeTab === 'square' && (
          <div className="space-y-6">

            {/* ── Status bar ─────────────────────────────────────────────────── */}
            {squareConfigLoading ? (
              <div className="rounded-xl p-8 text-center text-slate-400" style={{ background: 'rgba(5,7,30,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3" />Loading…
              </div>
            ) : squareConfigError ? (
              <div className="rounded-xl p-8 text-center text-red-400" style={{ background: 'rgba(5,7,30,0.85)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <XCircle className="w-6 h-6 mx-auto mb-2" />
                <p className="text-sm">Failed to load Square configuration. Please refresh or check your connection.</p>
              </div>
            ) : (
              <>
                {/* Config status summary */}
                <div className="rounded-xl p-6 shadow-lg" style={{ background: 'rgba(5,7,30,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${squareConfig.configured ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                        <CreditCard className={`w-5 h-5 ${squareConfig.configured ? 'text-emerald-600' : 'text-amber-600'}`} />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-white">Square Payment Integration</h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {squareConfig.configured
                            ? `Connected · ${squareConfig.environment === 'production' ? 'Production' : 'Sandbox'} mode`
                            : 'Not configured — complete the setup below'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <a
                        href="https://developer.squareup.com/apps"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg transition-colors" style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Square Developer Console
                      </a>
                      <button
                        onClick={handleTestSquareConnection}
                        disabled={testingConnection || !squareConfig.configured}
                        className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
                      >
                        {testingConnection ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        {testingConnection ? 'Testing…' : 'Test Connection'}
                      </button>
                    </div>
                  </div>

                  {/* Connection test result */}
                  {connectionTestResult && (
                    <div className={`mb-5 p-3 rounded-lg flex items-center gap-3 text-sm border ${connectionTestResult.success ? 'border-emerald-500/40 text-emerald-300' : 'border-red-500/40 text-red-300'}`} style={{ background: connectionTestResult.success ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)' }}>
                      {connectionTestResult.success ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                      {connectionTestResult.message}
                    </div>
                  )}

                  {/* Configured fields checklist */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { key: 'access_token', label: 'Access Token' },
                      { key: 'location_id', label: 'Location ID' },
                      { key: 'webhook_signature_key', label: 'Webhook Key' },
                      { key: 'catalog_starter', label: 'Catalog IDs' },
                    ].map(({ key, label }) => {
                      const isOk = key === 'catalog_starter'
                        ? squareConfig.configured_fields?.catalog_starter || squareConfig.configured_fields?.catalog_pro || squareConfig.configured_fields?.catalog_enterprise
                        : squareConfig.configured_fields?.[key as keyof typeof squareConfig.configured_fields];
                      return (
                        <div key={key} className={`flex items-center gap-2 p-3 rounded-lg border ${isOk ? 'border-emerald-500/40' : 'border-white/10'}`} style={{ background: isOk ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.04)' }}>
                          {isOk ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-slate-600 flex-shrink-0" />}
                          <span className={`text-xs font-medium ${isOk ? 'text-emerald-400' : 'text-slate-500'}`}>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Save result banner */}
                {squareSaveResult && (
                  <div className={`p-4 rounded-lg flex items-center gap-3 text-sm border ${squareSaveResult.success ? 'border-emerald-500/40 text-emerald-300' : 'border-red-500/40 text-red-300'}`} style={{ background: squareSaveResult.success ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)' }}>
                    {squareSaveResult.success ? <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />}
                    {squareSaveResult.message}
                  </div>
                )}

                {/* ── Two-column layout: setup guide + credentials form ──────── */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                  {/* Setup Guide */}
                  <div className="lg:col-span-2 rounded-xl p-6 shadow-lg" style={{ background: 'rgba(5,7,30,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Setup Guide</h3>
                    <ol className="space-y-4">
                      {[
                        {
                          step: 1,
                          title: 'Create a Square Developer App',
                          desc: 'Go to the Square Developer Console, create a new application and note your Application ID.',
                          link: 'https://developer.squareup.com/apps',
                          linkLabel: 'Open Developer Console →',
                        },
                        {
                          step: 2,
                          title: 'Copy your Access Token',
                          desc: 'In your app\'s Credentials tab, copy either the Sandbox or Production Access Token.',
                          link: 'https://developer.squareup.com/apps',
                          linkLabel: 'View credentials →',
                        },
                        {
                          step: 3,
                          title: 'Get your Location ID',
                          desc: 'Open the Square Dashboard → Locations. Copy the Location ID for your business location.',
                          link: 'https://squareup.com/dashboard/locations',
                          linkLabel: 'Open Locations →',
                        },
                        {
                          step: 4,
                          title: 'Configure Webhook (optional)',
                          desc: 'In Developer Console → Webhooks, create a subscription for payment.completed. Set endpoint to your server URL + /api/square/webhook.',
                          link: 'https://developer.squareup.com/apps',
                          linkLabel: 'Manage Webhooks →',
                        },
                        {
                          step: 5,
                          title: 'Create Catalog Items',
                          desc: 'In Square Dashboard → Items, create subscription items for Starter, Pro, and Enterprise. Copy each item\'s Catalog Object ID.',
                          link: 'https://squareup.com/dashboard/items',
                          linkLabel: 'Manage Items →',
                        },
                        {
                          step: 6,
                          title: 'Save & Test',
                          desc: 'Fill in the form on the right, click Save, then click Test Connection to verify everything works.',
                          link: null,
                          linkLabel: null,
                        },
                      ].map(({ step, title, desc, link, linkLabel }) => (
                        <li key={step} className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center mt-0.5">{step}</span>
                          <div>
                            <p className="text-sm font-medium text-slate-200">{title}</p>
                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
                            {link && (
                              <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1">
                                {linkLabel}<ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Credentials Form */}
                  <div className="lg:col-span-3 rounded-xl shadow-lg" style={{ background: 'rgba(5,7,30,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Credentials</h3>
                      {squareFormDirty && (
                        <span className="text-xs text-amber-400 font-medium">Unsaved changes</span>
                      )}
                    </div>
                    <div className="p-6 space-y-5">

                      {/* Environment */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Environment</label>
                        <div className="flex gap-3">
                          {(['sandbox', 'production'] as const).map((env) => (
                            <button
                              key={env}
                              onClick={() => handleSquareFieldChange('environment', env)}
                              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                                squareForm.environment === env
                                  ? env === 'production'
                                    ? 'border-emerald-400 text-emerald-300'
                                    : 'border-cyan-400 text-cyan-300'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                              style={{ border: squareForm.environment === env ? (env === 'production' ? '2px solid rgba(52,211,153,0.6)' : '2px solid rgba(0,229,255,0.6)') : '2px solid rgba(255,255,255,0.1)', background: squareForm.environment === env ? (env === 'production' ? 'rgba(52,211,153,0.1)' : 'rgba(0,229,255,0.1)') : 'rgba(255,255,255,0.04)' }}
                            >
                              {env === 'sandbox' ? '🧪 Sandbox' : '🚀 Production'}
                            </button>
                          ))}
                        </div>
                        {squareForm.environment === 'production' && (
                          <p className="mt-1.5 text-xs text-amber-400 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Production mode processes real payments.
                          </p>
                        )}
                      </div>

                      {/* Access Token */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                          Access Token <span className="text-red-500">*</span>
                          {squareConfig.configured_fields?.access_token && !squareForm.access_token && (
                            <span className="ml-2 text-emerald-400 normal-case font-normal">✓ saved</span>
                          )}
                        </label>
                        <div className="relative">
                          <input
                            type={showAccessToken ? 'text' : 'password'}
                            value={squareForm.access_token}
                            onChange={(e) => handleSquareFieldChange('access_token', e.target.value)}
                          placeholder={squareConfig.configured_fields?.access_token ? '(saved — enter new value to replace)' : 'EAAAl...'}
                            className="w-full pl-3 pr-10 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-white placeholder-slate-600" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowAccessToken((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                          >
                            {showAccessToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">Found in Square Developer Console → Credentials</p>
                      </div>

                      {/* Location ID */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                          Location ID <span className="text-red-500">*</span>
                          {squareConfig.configured_fields?.location_id && (
                            <span className="ml-2 text-emerald-400 normal-case font-normal">✓ saved</span>
                          )}
                        </label>
                        <input
                          type="text"
                          value={squareForm.location_id}
                          onChange={(e) => handleSquareFieldChange('location_id', e.target.value)}
                          placeholder={squareConfig.location_id || 'L0XXXXXXXXXXXXXXXXXX'}
                          className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-white placeholder-slate-600" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                        />
                        <p className="mt-1 text-xs text-slate-400">
                          Found in{' '}
                          <a href="https://squareup.com/dashboard/locations" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                            Square Dashboard → Locations
                          </a>
                        </p>
                      </div>

                      {/* Webhook Signature Key */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                          Webhook Signature Key
                          {squareConfig.configured_fields?.webhook_signature_key && !squareForm.webhook_signature_key && (
                            <span className="ml-2 text-emerald-400 normal-case font-normal">✓ saved</span>
                          )}
                        </label>
                        <div className="relative">
                          <input
                            type={showWebhookKey ? 'text' : 'password'}
                            value={squareForm.webhook_signature_key}
                            onChange={(e) => handleSquareFieldChange('webhook_signature_key', e.target.value)}
                            placeholder={squareConfig.configured_fields?.webhook_signature_key ? '(saved — enter new value to replace)' : 'Optional — required for webhook verification'}
                            className="w-full pl-3 pr-10 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-white placeholder-slate-600" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowWebhookKey((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                          >
                            {showWebhookKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">Set your webhook endpoint to: <code className="px-1 rounded text-cyan-400" style={{ background: 'rgba(0,229,255,0.1)' }}>/api/square/webhook</code></p>
                      </div>

                      {/* Catalog IDs */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                          Subscription Catalog IDs
                        </label>
                        <div className="space-y-3">
                          {[
                            { field: 'catalog_starter', label: '⚡ Starter Plan', configKey: 'catalog_starter', placeholder: 'CATALOG_ITEM_ID_FOR_STARTER' },
                            { field: 'catalog_pro', label: '👑 Pro Plan', configKey: 'catalog_pro', placeholder: 'CATALOG_ITEM_ID_FOR_PRO' },
                            { field: 'catalog_enterprise', label: '📈 Enterprise Plan', configKey: 'catalog_enterprise', placeholder: 'CATALOG_ITEM_ID_FOR_ENTERPRISE' },
                          ].map(({ field, label, configKey, placeholder }) => (
                            <div key={field} className="flex items-center gap-3">
                              <span className="text-xs font-medium text-slate-400 w-28 flex-shrink-0">{label}</span>
                              <input
                                type="text"
                                value={squareForm[field as keyof typeof squareForm]}
                                onChange={(e) => handleSquareFieldChange(field, e.target.value)}
                                placeholder={squareConfig[configKey] || placeholder}
                                className="flex-1 px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-white placeholder-slate-600" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                              />
                              {squareConfig.configured_fields?.[configKey as keyof typeof squareConfig.configured_fields] && (
                                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                              )}
                            </div>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          Create subscription items in{' '}
                          <a href="https://squareup.com/dashboard/items" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                            Square Dashboard → Items
                          </a>{' '}
                          and paste their Catalog Object IDs here.
                        </p>
                      </div>

                      {/* Save button */}
                      <div className="pt-2 flex items-center gap-3">
                        <button
                          onClick={() => saveSquareConfigMutation.mutate(squareForm)}
                          disabled={saveSquareConfigMutation.isPending || !squareFormDirty}
                          className="flex items-center gap-2 px-5 py-2.5 text-white text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors" style={{ background: 'linear-gradient(120deg, #00e5ff 0%, #7c4dff 100%)' }}
                        >
                          {saveSquareConfigMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          {saveSquareConfigMutation.isPending ? 'Saving…' : 'Save Configuration'}
                        </button>
                        <p className="text-xs text-slate-500">Changes apply immediately — no restart needed</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Env variable reference ──────────────────────────────────── */}
                <div className="bg-slate-900 rounded-xl p-6 text-slate-300">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-white">Environment Variable Reference</h3>
                    <button
                      onClick={() => {
                        const vars = `SQUARE_ACCESS_TOKEN=your_token\nSQUARE_ENVIRONMENT=sandbox\nSQUARE_LOCATION_ID=your_location_id\nSQUARE_WEBHOOK_SIGNATURE_KEY=your_webhook_key\nSQUARE_CATALOG_STARTER=your_catalog_id\nSQUARE_CATALOG_PRO=your_catalog_id\nSQUARE_CATALOG_ENTERPRISE=your_catalog_id`;
                        handleCopyToClipboard(vars, 'all_vars');
                      }}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded border border-slate-700 hover:border-slate-500 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiedField === 'all_vars' ? 'Copied!' : 'Copy all'}
                    </button>
                  </div>
                  <div className="space-y-1.5 font-mono text-xs">
                    {[
                      { key: 'SQUARE_ACCESS_TOKEN', desc: 'API Access Token from Developer Console' },
                      { key: 'SQUARE_ENVIRONMENT', desc: '"sandbox" or "production"' },
                      { key: 'SQUARE_LOCATION_ID', desc: 'Business location ID from Square Dashboard' },
                      { key: 'SQUARE_WEBHOOK_SIGNATURE_KEY', desc: 'Webhook signature key (for verifying webhooks)' },
                      { key: 'SQUARE_CATALOG_STARTER', desc: 'Catalog Object ID for Starter subscription' },
                      { key: 'SQUARE_CATALOG_PRO', desc: 'Catalog Object ID for Pro subscription' },
                      { key: 'SQUARE_CATALOG_ENTERPRISE', desc: 'Catalog Object ID for Enterprise subscription' },
                    ].map(({ key, desc }) => (
                      <div key={key} className="flex items-center gap-3 group">
                        <code className="text-emerald-400">{key}</code>
                        <span className="text-slate-600">=</span>
                        <span className="text-slate-500 text-xs">{'# '}{desc}</span>
                        <button
                          onClick={() => handleCopyToClipboard(key, key)}
                          className="ml-auto opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-300 transition-opacity"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {copiedField === key && <span className="text-xs text-emerald-400">Copied!</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="rounded-2xl shadow-2xl w-full max-w-md" style={{ background: 'rgba(5,7,30,0.98)', border: '1px solid rgba(0,229,255,0.2)' }}>
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,229,255,0.1)' }}>
                  <UserPlus className="w-5 h-5 text-cyan-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Add New User</h2>
              </div>
              <button onClick={() => { setShowAddUser(false); setAddUserError(''); }} className="text-slate-500 hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {addUserError && (
                <div className="p-3 rounded-lg text-sm text-red-300 flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />{addUserError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Email <span className="text-red-400">*</span></label>
                <input type="email" value={addUserForm.email} onChange={(e) => setAddUserForm({ ...addUserForm, email: e.target.value })} placeholder="user@example.com" className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white placeholder-slate-600" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Full Name</label>
                <input type="text" value={addUserForm.full_name} onChange={(e) => setAddUserForm({ ...addUserForm, full_name: e.target.value })} placeholder="Jane Smith" className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white placeholder-slate-600" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Role</label>
                <select value={addUserForm.role} onChange={(e) => setAddUserForm({ ...addUserForm, role: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white" style={{ background: 'rgba(5,7,30,0.95)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
                {addUserForm.role === 'admin' && (
                  <p className="mt-1.5 text-xs text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Admin users have full access to all system settings.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Password <span className="text-red-400">*</span></label>
                <input type="password" value={addUserForm.password} onChange={(e) => setAddUserForm({ ...addUserForm, password: e.target.value })} placeholder="Min. 8 characters" className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white placeholder-slate-600" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
            </div>
            <div className="px-6 py-4 flex justify-end gap-3 rounded-b-2xl" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
              <button onClick={() => { setShowAddUser(false); setAddUserError(''); }} className="px-4 py-2 text-sm font-medium text-slate-300 rounded-lg transition-colors hover:text-white" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>Cancel</button>
              <button onClick={() => createUserMutation.mutate(addUserForm)} disabled={!addUserForm.email || addUserForm.password.length < 8 || createUserMutation.isPending} className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors" style={{ background: 'linear-gradient(120deg, #00e5ff 0%, #7c4dff 100%)' }}>
                {createUserMutation.isPending ? 'Creating…' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

            {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="rounded-2xl shadow-2xl w-full max-w-sm" style={{ background: 'rgba(5,7,30,0.98)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(239,68,68,0.1)' }}>
                <Trash2 className="w-7 h-7 text-red-400" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">Delete User</h2>
              <p className="text-sm text-slate-400">
                Are you sure you want to permanently delete <strong className="text-slate-200">{deleteTarget.email}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2 text-sm font-medium text-slate-300 rounded-lg transition-colors hover:text-white" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>Cancel</button>
              <button onClick={() => deleteUserMutation.mutate(deleteTarget.id)} disabled={deleteUserMutation.isPending} className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
                {deleteUserMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

            {/* User Details Modal */}
      {selectedUser && userDetails && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ background: 'rgba(5,7,30,0.98)', border: '1px solid rgba(0,229,255,0.2)' }}>
            <div className="sticky top-0 px-6 py-5 flex items-center gap-4 rounded-t-2xl" style={{ background: 'rgba(5,7,30,0.98)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <Avatar name={userDetails.full_name} email={userDetails.email} />
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-white truncate">{userDetails.full_name || userDetails.email}</h2>
                <p className="text-sm text-slate-400 truncate">{userDetails.email}</p>
              </div>
              <span className={`inline-block w-2 h-2 rounded-full ${userDetails.is_active ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              <button onClick={() => { setSelectedUser(null); setEditingSubscription(false); setSuspendReason(''); }} className="text-slate-500 hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Role', value: userDetails.role },
                  { label: 'Auth Provider', value: userDetails.auth_provider },
                  { label: 'Joined', value: formatDateTime.date(userDetails.created_at) },
                  { label: 'Last Login', value: userDetails.last_login ? formatDateTime.date(userDetails.last_login) : '—' },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                    <p className="text-sm font-medium text-slate-200 capitalize">{item.value}</p>
                  </div>
                ))}
              </div>

              {userDetails.subscription && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Subscription</h3>
                    {!editingSubscription && (
                      <button onClick={() => setEditingSubscription(true)} className="text-xs text-cyan-400 hover:text-cyan-300 font-medium">Edit</button>
                    )}
                  </div>
                  {editingSubscription ? (
                    <div className="space-y-3 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Tier</label>
                          <select value={subscriptionForm.tier} onChange={(e) => setSubscriptionForm({ ...subscriptionForm, tier: e.target.value })} className="w-full text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white" style={{ background: 'rgba(5,7,30,0.95)', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <option value="starter">Starter</option>
                            <option value="pro">Pro</option>
                            <option value="enterprise">Enterprise</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
                          <select value={subscriptionForm.status} onChange={(e) => setSubscriptionForm({ ...subscriptionForm, status: e.target.value })} className="w-full text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white" style={{ background: 'rgba(5,7,30,0.95)', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <option value="trial">Trial</option>
                            <option value="active">Active</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="expired">Expired</option>
                            <option value="suspended">Suspended</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Admin Notes</label>
                        <textarea value={subscriptionForm.admin_notes} onChange={(e) => setSubscriptionForm({ ...subscriptionForm, admin_notes: e.target.value })} className="w-full text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white placeholder-slate-600" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} rows={2} />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => updateSubscriptionMutation.mutate({ userId: selectedUser, data: subscriptionForm })} disabled={updateSubscriptionMutation.isPending} className="flex-1 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50" style={{ background: 'linear-gradient(120deg, #00e5ff 0%, #7c4dff 100%)' }}>Save</button>
                        <button onClick={() => setEditingSubscription(false)} className="flex-1 text-sm px-4 py-2 rounded-lg text-slate-300 hover:text-white" style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <p className="text-xs text-slate-500 mb-1">Tier</p>
                        <TierBadge tier={userDetails.subscription.tier} />
                      </div>
                      <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <p className="text-xs text-slate-500 mb-1">Status</p>
                        <SubStatusBadge status={userDetails.subscription.status} />
                      </div>
                      {userDetails.subscription.current_period_end && (
                        <div className="rounded-lg p-3 col-span-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <p className="text-xs text-slate-500 mb-1">Period Ends</p>
                          <p className="text-sm font-medium text-slate-200">{formatDateTime.full(userDetails.subscription.current_period_end)}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {userDetails.usage && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Usage This Month</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Posts', value: userDetails.usage.posts_created },
                      { label: 'API Calls', value: userDetails.usage.api_calls },
                      { label: 'AI Requests', value: userDetails.usage.ai_requests },
                      { label: 'Storage', value: `${userDetails.usage.storage_used_mb.toFixed(1)} MB` },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-lg p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <p className="text-xl font-bold text-white">{stat.value}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {userDetails.role !== 'admin' && (
                <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Actions</h3>
                  <div className="flex flex-col gap-3">
                    {userDetails.is_active && userDetails.subscription?.status !== 'suspended' && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Suspension reason (required)…"
                          value={suspendReason}
                          onChange={(e) => setSuspendReason(e.target.value)}
                          className="flex-1 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 text-white placeholder-slate-600"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                        />
                        <button
                          onClick={() => suspendMutation.mutate({ userId: selectedUser, reason: suspendReason })}
                          disabled={!suspendReason.trim() || suspendMutation.isPending}
                          className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-50 whitespace-nowrap"
                          style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
                        >
                          <Ban className="w-4 h-4" />
                          Suspend
                        </button>
                      </div>
                    )}
                    {(!userDetails.is_active || userDetails.subscription?.status === 'suspended' || userDetails.subscription?.status === 'expired') && (
                      <button
                        onClick={() => activateMutation.mutate(selectedUser)}
                        disabled={activateMutation.isPending}
                        className="flex items-center justify-center gap-2 w-full px-4 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                      >
                        <CheckCircle className="w-4 h-4" />
                        {activateMutation.isPending ? 'Activating…' : 'Activate User'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SMTP Configuration Modal */}
      {showSmtpModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl" style={{ background: 'rgba(5,7,30,0.98)', border: '1px solid rgba(0,229,255,0.2)' }}>
            <div className="sticky top-0 flex items-center justify-between px-6 py-4 rounded-t-2xl" style={{ background: 'rgba(5,7,30,0.98)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <h2 className="text-lg font-semibold text-white">SMTP Configuration</h2>
              <button onClick={() => setShowSmtpModal(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <SmtpConfigPanel />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}