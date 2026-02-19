import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield, Users, BarChart3, CreditCard, CheckCircle, XCircle, Clock,
  AlertTriangle, Crown, Zap, TrendingUp, Settings, DollarSign, Mail,
  Flag, Activity, UserPlus, Trash2, Ban, RefreshCw, Search, X,
} from 'lucide-react';
import { formatDateTime } from '../utils/timezone';
import { UserGrowthChart } from '../components/admin/UserGrowthChart';
import { RevenueChart } from '../components/admin/RevenueChart';
import { SubscriptionDistributionChart } from '../components/admin/SubscriptionDistributionChart';
import { SystemHealthPanel } from '../components/admin/SystemHealthPanel';
import { RevenueSummaryCards } from '../components/admin/RevenueSummaryCards';
import { FailedPaymentsTable } from '../components/admin/FailedPaymentsTable';
import { EmailComposer } from '../components/admin/EmailComposer';
import { PostModerationTable } from '../components/admin/PostModerationTable';

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

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('accessToken')}` });

const adminApi = {
  getUsers: async (): Promise<{ users: User[]; total: number }> => {
    const r = await fetch('/api/admin/users', { headers: authHeader() });
    if (!r.ok) throw new Error('Failed to fetch users');
    return r.json();
  },
  getUserDetails: async (userId: string): Promise<UserDetails> => {
    const r = await fetch(`/api/admin/users/${userId}`, { headers: authHeader() });
    if (!r.ok) throw new Error('Failed to fetch user details');
    return r.json();
  },
  createUser: async (data: { email: string; full_name: string; role: string; password: string }) => {
    const r = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(data),
    });
    if (!r.ok) {
      const err = await r.json();
      throw new Error(err.error || 'Failed to create user');
    }
    return r.json();
  },
  deleteUser: async (userId: string) => {
    const r = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE', headers: authHeader() });
    if (!r.ok) {
      const err = await r.json();
      throw new Error(err.error || 'Failed to delete user');
    }
    return r.json();
  },
  updateSubscription: async (userId: string, data: any) => {
    const r = await fetch(`/api/admin/users/${userId}/subscription`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error('Failed to update subscription');
    return r.json();
  },
  suspendUser: async (userId: string, reason: string) => {
    const r = await fetch(`/api/admin/users/${userId}/suspend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ reason }),
    });
    if (!r.ok) throw new Error('Failed to suspend user');
    return r.json();
  },
  activateUser: async (userId: string) => {
    const r = await fetch(`/api/admin/users/${userId}/activate`, { method: 'POST', headers: authHeader() });
    if (!r.ok) throw new Error('Failed to activate user');
    return r.json();
  },
  getMetrics: async (): Promise<SystemMetrics> => {
    const r = await fetch('/api/admin/metrics', { headers: authHeader() });
    if (!r.ok) throw new Error('Failed to fetch metrics');
    return r.json();
  },
  getSquareConfig: async () => {
    const r = await fetch('/api/admin/square-config', { headers: authHeader() });
    if (!r.ok) throw new Error('Failed to fetch Square config');
    return r.json();
  },
  testSquareConnection: async () => {
    const r = await fetch('/api/admin/square-test-connection', { method: 'POST', headers: authHeader() });
    if (!r.ok) throw new Error('Failed to test Square connection');
    return r.json();
  },
};

function Avatar({ name, email }: { name?: string; email: string }) {
  const initials = name
    ? name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
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
  const map: Record<string, { cls: string; icon: React.ReactNode }> = {
    free:       { cls: 'bg-slate-100 text-slate-600 border border-slate-200', icon: null },
    starter:    { cls: 'bg-blue-50 text-blue-700 border border-blue-200', icon: <Zap className="w-3 h-3" /> },
    pro:        { cls: 'bg-violet-50 text-violet-700 border border-violet-200', icon: <Crown className="w-3 h-3" /> },
    enterprise: { cls: 'bg-amber-50 text-amber-700 border border-amber-200', icon: <TrendingUp className="w-3 h-3" /> },
  };
  const { cls, icon } = map[tier] ?? map.free;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {icon}{tier.toUpperCase()}
    </span>
  );
}

function SubStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:    'bg-emerald-50 text-emerald-700 border border-emerald-200',
    trial:     'bg-sky-50 text-sky-700 border border-sky-200',
    suspended: 'bg-amber-50 text-amber-700 border border-amber-200',
    cancelled: 'bg-red-50 text-red-700 border border-red-200',
    expired:   'bg-slate-100 text-slate-600 border border-slate-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? map.expired}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

type Tab = 'users' | 'metrics' | 'analytics' | 'revenue' | 'email' | 'moderation' | 'square';

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

  const { data: usersData, isLoading: usersLoading } = useQuery({
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

  const { data: squareConfig, isLoading: squareConfigLoading } = useQuery({
    queryKey: ['admin-square-config'],
    queryFn: adminApi.getSquareConfig,
    enabled: activeTab === 'square',
  });

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

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'users',      label: 'Users',      icon: <Users className="w-4 h-4" /> },
    { id: 'metrics',    label: 'Metrics',    icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'analytics',  label: 'Analytics',  icon: <Activity className="w-4 h-4" /> },
    { id: 'revenue',    label: 'Revenue',    icon: <DollarSign className="w-4 h-4" /> },
    { id: 'email',      label: 'Email',      icon: <Mail className="w-4 h-4" /> },
    { id: 'moderation', label: 'Moderation', icon: <Flag className="w-4 h-4" /> },
    { id: 'square',     label: 'Square',     icon: <CreditCard className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-8 shadow-lg">
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
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
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
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, or role\u2026"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => setShowAddUser(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
              >
                <UserPlus className="w-4 h-4" />
                Add User
              </button>
            </div>

            {usersLoading ? (
              <div className="py-16 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3" />
                Loading users\u2026
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
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Plan</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Subscription</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Joined</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={user.full_name} email={user.email} />
                            <div>
                              <p className="text-sm font-medium text-slate-900">{user.full_name || '\u2014'}</p>
                              <p className="text-xs text-slate-500">{user.email}</p>
                            </div>
                            <span className={`inline-block w-2 h-2 rounded-full ${user.is_active ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full capitalize">{user.role}</span>
                        </td>
                        <td className="px-6 py-4">
                          {user.subscription ? <TierBadge tier={user.subscription.tier} /> : <span className="text-slate-400 text-xs">\u2014</span>}
                        </td>
                        <td className="px-6 py-4">
                          {user.subscription ? <SubStatusBadge status={user.subscription.status} /> : <span className="text-slate-400 text-xs">\u2014</span>}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">
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
                              className="text-xs font-medium text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                            >
                              Details
                            </button>
                            {user.role !== 'admin' && (
                              <>
                                {user.is_active ? (
                                  <button
                                    onClick={() => { setSuspendReason(''); setSelectedUser(user.id); }}
                                    title="Suspend user"
                                    className="p-1.5 rounded hover:bg-amber-50 text-amber-500 hover:text-amber-700 transition-colors"
                                  >
                                    <Ban className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => activateMutation.mutate(user.id)}
                                    disabled={activateMutation.isPending}
                                    title="Activate user"
                                    className="p-1.5 rounded hover:bg-emerald-50 text-emerald-500 hover:text-emerald-700 transition-colors disabled:opacity-50"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => setDeleteTarget(user)}
                                  title="Delete user"
                                  className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
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
                <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
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
                Loading metrics\u2026
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {[
                    { label: 'Total Users', value: metricsData?.users.total, icon: <Users className="w-5 h-5" />, color: 'text-blue-500', bg: 'bg-blue-50', sub: `${metricsData?.users.active} active \u00b7 ${metricsData?.users.inactive} inactive` },
                    { label: 'Posts / Month', value: metricsData?.usage_this_month.posts_created, icon: <BarChart3 className="w-5 h-5" />, color: 'text-emerald-500', bg: 'bg-emerald-50', sub: undefined },
                    { label: 'API Calls', value: metricsData?.usage_this_month.api_calls?.toLocaleString(), icon: <Zap className="w-5 h-5" />, color: 'text-violet-500', bg: 'bg-violet-50', sub: undefined },
                    { label: 'AI Requests', value: metricsData?.usage_this_month.ai_requests, icon: <Activity className="w-5 h-5" />, color: 'text-amber-500', bg: 'bg-amber-50', sub: undefined },
                  ].map((card) => (
                    <div key={card.label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-medium text-slate-600">{card.label}</p>
                        <div className={`w-9 h-9 ${card.bg} ${card.color} rounded-lg flex items-center justify-center`}>{card.icon}</div>
                      </div>
                      <p className="text-3xl font-bold text-slate-900">{card.value ?? '\u2014'}</p>
                      {card.sub && <p className="text-xs text-slate-500 mt-1">{card.sub}</p>}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wide">By Tier</h3>
                    <div className="space-y-3">
                      {Object.entries(metricsData?.subscriptions.by_tier || {}).map(([tier, count]) => (
                        <div key={tier} className="flex items-center justify-between">
                          <TierBadge tier={tier} />
                          <span className="text-xl font-bold text-slate-900">{count as number}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wide">By Status</h3>
                    <div className="space-y-3">
                      {Object.entries(metricsData?.subscriptions.by_status || {}).map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between">
                          <SubStatusBadge status={status} />
                          <span className="text-xl font-bold text-slate-900">{count as number}</span>
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
        {activeTab === 'email' && <EmailComposer />}

        {/* Moderation Tab */}
        {activeTab === 'moderation' && <PostModerationTable />}

        {/* Square Tab */}
        {activeTab === 'square' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Square Payment Integration</h2>
                <p className="text-sm text-slate-500 mt-0.5">Manage your Square payment gateway configuration</p>
              </div>
              <button
                onClick={handleTestSquareConnection}
                disabled={testingConnection}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {testingConnection ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {testingConnection ? 'Testing\u2026' : 'Test Connection'}
              </button>
            </div>
            {connectionTestResult && (
              <div className={`mx-6 mt-6 p-4 rounded-lg flex items-center gap-3 ${connectionTestResult.success ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                {connectionTestResult.success ? <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" /> : <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />}
                <span className="text-sm">{connectionTestResult.message}</span>
              </div>
            )}
            <div className="p-6">
              {squareConfigLoading ? (
                <div className="py-12 text-center text-slate-400"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3" />Loading\u2026</div>
              ) : squareConfig ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { label: 'Status', value: squareConfig.configured ? 'Configured' : 'Not Configured', icon: squareConfig.configured ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-red-500" /> },
                      { label: 'Environment', value: squareConfig.environment || 'Not Set', icon: <Settings className="w-5 h-5 text-blue-500" /> },
                      { label: 'Location ID', value: squareConfig.location_id || 'Not Set', icon: <CreditCard className="w-5 h-5 text-violet-500" /> },
                    ].map((item) => (
                      <div key={item.label} className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{item.label}</span>
                          {item.icon}
                        </div>
                        <p className="text-sm font-semibold text-slate-900 break-all">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                      <h3 className="text-sm font-semibold text-slate-700">Credentials</h3>
                    </div>
                    <div className="p-4 space-y-4">
                      {[
                        { label: 'Access Token', value: squareConfig.access_token },
                        { label: 'Webhook Signature Key', value: squareConfig.webhook_signature_key },
                      ].map((field) => (
                        <div key={field.label}>
                          <label className="block text-xs font-medium text-slate-600 mb-1">{field.label}</label>
                          <div className="flex items-center gap-2">
                            <input type="text" value={field.value} readOnly className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-600 font-mono" />
                            <span className="text-xs text-slate-400 whitespace-nowrap">Masked</span>
                          </div>
                        </div>
                      ))}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                          { label: 'Starter Plan ID', value: squareConfig.catalog_starter },
                          { label: 'Pro Plan ID', value: squareConfig.catalog_pro },
                          { label: 'Enterprise Plan ID', value: squareConfig.catalog_enterprise },
                        ].map((field) => (
                          <div key={field.label}>
                            <label className="block text-xs font-medium text-slate-600 mb-1">{field.label}</label>
                            <input type="text" value={field.value || 'Not Set'} readOnly className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-600" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <p className="font-semibold mb-1">Updating Configuration</p>
                      <p>Set environment variables and restart: <code className="bg-blue-100 px-1 rounded">SQUARE_ACCESS_TOKEN</code>, <code className="bg-blue-100 px-1 rounded">SQUARE_ENVIRONMENT</code>, <code className="bg-blue-100 px-1 rounded">SQUARE_LOCATION_ID</code>, <code className="bg-blue-100 px-1 rounded">SQUARE_WEBHOOK_SIGNATURE_KEY</code>, <code className="bg-blue-100 px-1 rounded">SQUARE_CATALOG_*</code>.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500">Failed to load Square configuration</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900">Add New User</h2>
              </div>
              <button onClick={() => { setShowAddUser(false); setAddUserError(''); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {addUserError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />{addUserError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email <span className="text-red-500">*</span></label>
                <input type="email" value={addUserForm.email} onChange={(e) => setAddUserForm({ ...addUserForm, email: e.target.value })} placeholder="user@example.com" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input type="text" value={addUserForm.full_name} onChange={(e) => setAddUserForm({ ...addUserForm, full_name: e.target.value })} placeholder="Jane Smith" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select value={addUserForm.role} onChange={(e) => setAddUserForm({ ...addUserForm, role: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password <span className="text-red-500">*</span></label>
                <input type="password" value={addUserForm.password} onChange={(e) => setAddUserForm({ ...addUserForm, password: e.target.value })} placeholder="Min. 8 characters" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-2xl">
              <button onClick={() => { setShowAddUser(false); setAddUserError(''); }} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={() => createUserMutation.mutate(addUserForm)} disabled={!addUserForm.email || !addUserForm.password || createUserMutation.isPending} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {createUserMutation.isPending ? 'Creating\u2026' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-7 h-7 text-red-500" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Delete User</h2>
              <p className="text-sm text-slate-500">
                Are you sure you want to permanently delete <strong className="text-slate-700">{deleteTarget.email}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={() => deleteUserMutation.mutate(deleteTarget.id)} disabled={deleteUserMutation.isPending} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
                {deleteUserMutation.isPending ? 'Deleting\u2026' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Details Modal */}
      {selectedUser && userDetails && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-5 border-b border-slate-100 flex items-center gap-4 rounded-t-2xl">
              <Avatar name={userDetails.full_name} email={userDetails.email} />
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-slate-900 truncate">{userDetails.full_name || userDetails.email}</h2>
                <p className="text-sm text-slate-500 truncate">{userDetails.email}</p>
              </div>
              <span className={`inline-block w-2 h-2 rounded-full ${userDetails.is_active ? 'bg-emerald-400' : 'bg-slate-300'}`} />
              <button onClick={() => { setSelectedUser(null); setEditingSubscription(false); setSuspendReason(''); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Role', value: userDetails.role },
                  { label: 'Auth Provider', value: userDetails.auth_provider },
                  { label: 'Joined', value: formatDateTime.date(userDetails.created_at) },
                  { label: 'Last Login', value: userDetails.last_login ? formatDateTime.date(userDetails.last_login) : '\u2014' },
                ].map((item) => (
                  <div key={item.label} className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                    <p className="text-sm font-medium text-slate-900 capitalize">{item.value}</p>
                  </div>
                ))}
              </div>

              {userDetails.subscription && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Subscription</h3>
                    {!editingSubscription && (
                      <button onClick={() => setEditingSubscription(true)} className="text-xs text-blue-600 hover:text-blue-700 font-medium">Edit</button>
                    )}
                  </div>
                  {editingSubscription ? (
                    <div className="space-y-3 bg-slate-50 rounded-xl p-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Tier</label>
                          <select value={subscriptionForm.tier} onChange={(e) => setSubscriptionForm({ ...subscriptionForm, tier: e.target.value })} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="starter">Starter</option>
                            <option value="pro">Pro</option>
                            <option value="enterprise">Enterprise</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                          <select value={subscriptionForm.status} onChange={(e) => setSubscriptionForm({ ...subscriptionForm, status: e.target.value })} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="trial">Trial</option>
                            <option value="active">Active</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="expired">Expired</option>
                            <option value="suspended">Suspended</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Admin Notes</label>
                        <textarea value={subscriptionForm.admin_notes} onChange={(e) => setSubscriptionForm({ ...subscriptionForm, admin_notes: e.target.value })} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => updateSubscriptionMutation.mutate({ userId: selectedUser, data: subscriptionForm })} disabled={updateSubscriptionMutation.isPending} className="flex-1 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">Save</button>
                        <button onClick={() => setEditingSubscription(false)} className="flex-1 border border-slate-200 text-sm px-4 py-2 rounded-lg hover:bg-slate-50">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1">Tier</p>
                        <TierBadge tier={userDetails.subscription.tier} />
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1">Status</p>
                        <SubStatusBadge status={userDetails.subscription.status} />
                      </div>
                      {userDetails.subscription.current_period_end && (
                        <div className="bg-slate-50 rounded-lg p-3 col-span-2">
                          <p className="text-xs text-slate-500 mb-1">Period Ends</p>
                          <p className="text-sm font-medium text-slate-900">{formatDateTime.full(userDetails.subscription.current_period_end)}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {userDetails.usage && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Usage This Month</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Posts', value: userDetails.usage.posts_created },
                      { label: 'API Calls', value: userDetails.usage.api_calls },
                      { label: 'AI Requests', value: userDetails.usage.ai_requests },
                      { label: 'Storage', value: `${userDetails.usage.storage_used_mb.toFixed(1)} MB` },
                    ].map((stat) => (
                      <div key={stat.label} className="bg-slate-50 rounded-lg p-3 text-center">
                        <p className="text-xl font-bold text-slate-900">{stat.value}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {userDetails.role !== 'admin' && (
                <div className="border-t border-slate-100 pt-4">
                  <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Actions</h3>
                  <div className="flex flex-col gap-3">
                    {userDetails.is_active && userDetails.subscription?.status !== 'suspended' && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Suspension reason (required)\u2026"
                          value={suspendReason}
                          onChange={(e) => setSuspendReason(e.target.value)}
                          className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                        <button
                          onClick={() => suspendMutation.mutate({ userId: selectedUser, reason: suspendReason })}
                          disabled={!suspendReason.trim() || suspendMutation.isPending}
                          className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50 whitespace-nowrap"
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
                        className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" />
                        {activateMutation.isPending ? 'Activating\u2026' : 'Activate User'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
