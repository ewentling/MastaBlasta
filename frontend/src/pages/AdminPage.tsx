import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Users, BarChart3, CreditCard, CheckCircle, XCircle, Clock, AlertTriangle, Crown, Zap, TrendingUp } from 'lucide-react';
import { formatDateTime } from '../utils/timezone';

// Types
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
  users: {
    total: number;
    active: number;
    inactive: number;
  };
  subscriptions: {
    by_tier: Record<string, number>;
    by_status: Record<string, number>;
  };
  usage_this_month: {
    posts_created: number;
    api_calls: number;
    storage_used_mb: number;
    ai_requests: number;
  };
  timestamp: string;
}

// API Functions
const adminApi = {
  getUsers: async (): Promise<{ users: User[]; total: number }> => {
    const response = await fetch('/api/admin/users', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch users');
    return response.json();
  },

  getUserDetails: async (userId: string): Promise<UserDetails> => {
    const response = await fetch(`/api/admin/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch user details');
    return response.json();
  },

  updateSubscription: async (userId: string, data: any) => {
    const response = await fetch(`/api/admin/users/${userId}/subscription`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update subscription');
    return response.json();
  },

  suspendUser: async (userId: string, reason: string) => {
    const response = await fetch(`/api/admin/users/${userId}/suspend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ reason }),
    });
    if (!response.ok) throw new Error('Failed to suspend user');
    return response.json();
  },

  activateUser: async (userId: string) => {
    const response = await fetch(`/api/admin/users/${userId}/activate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });
    if (!response.ok) throw new Error('Failed to activate user');
    return response.json();
  },

  getMetrics: async (): Promise<SystemMetrics> => {
    const response = await fetch('/api/admin/metrics', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch metrics');
    return response.json();
  },

  getTiers: async () => {
    const response = await fetch('/api/admin/subscription-tiers', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch tiers');
    return response.json();
  },
};

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'users' | 'metrics'>('users');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [editingSubscription, setEditingSubscription] = useState(false);
  const [subscriptionForm, setSubscriptionForm] = useState({
    tier: '',
    status: '',
    admin_notes: '',
  });
  const [suspendReason, setSuspendReason] = useState('');

  // Queries
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: adminApi.getUsers,
  });

  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: adminApi.getMetrics,
    refetchInterval: 30000, // Refresh every 30s
  });

  const { data: userDetails } = useQuery({
    queryKey: ['admin-user-details', selectedUser],
    queryFn: () => adminApi.getUserDetails(selectedUser!),
    enabled: !!selectedUser,
  });

  // Mutations
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
    },
  });

  const activateMutation = useMutation({
    mutationFn: adminApi.activateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-details'] });
    },
  });

  // Helper functions
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'trial':
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'expired':
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'suspended':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTierBadge = (tier: string) => {
    const colors = {
      free: 'bg-gray-100 text-gray-800',
      starter: 'bg-blue-100 text-blue-800',
      pro: 'bg-purple-100 text-purple-800',
      enterprise: 'bg-yellow-100 text-yellow-800',
    };
    const icons = {
      free: null,
      starter: <Zap className="w-3 h-3" />,
      pro: <Crown className="w-3 h-3" />,
      enterprise: <TrendingUp className="w-3 h-3" />,
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${colors[tier as keyof typeof colors] || colors.free}`}>
        {icons[tier as keyof typeof icons]}
        {tier.toUpperCase()}
      </span>
    );
  };

  const handleUpdateSubscription = () => {
    if (!selectedUser) return;
    updateSubscriptionMutation.mutate({
      userId: selectedUser,
      data: subscriptionForm,
    });
  };

  const handleSuspend = () => {
    if (!selectedUser || !suspendReason.trim()) return;
    suspendMutation.mutate({
      userId: selectedUser,
      reason: suspendReason,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          </div>
          <p className="text-gray-600">Manage users, subscriptions, and monitor system metrics</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('users')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="w-5 h-5 inline-block mr-2" />
              User Management
            </button>
            <button
              onClick={() => setActiveTab('metrics')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'metrics'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <BarChart3 className="w-5 h-5 inline-block mr-2" />
              System Metrics
            </button>
          </nav>
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Users</h2>
              
              {usersLoading ? (
                <div className="text-center py-8">Loading users...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tier</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {usersData?.users.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{user.full_name || user.email}</div>
                              <div className="text-sm text-gray-500">{user.email}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {user.subscription ? getTierBadge(user.subscription.tier) : <span className="text-gray-400">No subscription</span>}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {user.subscription ? (
                              <div className="flex items-center gap-2">
                                {getStatusIcon(user.subscription.status)}
                                <span className="text-sm text-gray-900 capitalize">{user.subscription.status}</span>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDateTime.date(user.created_at)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => {
                                setSelectedUser(user.id);
                                setSubscriptionForm({
                                  tier: user.subscription?.tier || 'free',
                                  status: user.subscription?.status || 'trial',
                                  admin_notes: user.subscription?.admin_notes || '',
                                });
                              }}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Manage
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Metrics Tab */}
        {activeTab === 'metrics' && (
          <div className="space-y-6">
            {metricsLoading ? (
              <div className="text-center py-8">Loading metrics...</div>
            ) : (
              <>
                {/* Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Users</p>
                        <p className="text-3xl font-bold text-gray-900">{metricsData?.users.total}</p>
                      </div>
                      <Users className="w-12 h-12 text-blue-500" />
                    </div>
                    <div className="mt-4 text-sm text-gray-600">
                      {metricsData?.users.active} active · {metricsData?.users.inactive} inactive
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Posts This Month</p>
                        <p className="text-3xl font-bold text-gray-900">{metricsData?.usage_this_month.posts_created}</p>
                      </div>
                      <BarChart3 className="w-12 h-12 text-green-500" />
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">API Calls</p>
                        <p className="text-3xl font-bold text-gray-900">{metricsData?.usage_this_month.api_calls.toLocaleString()}</p>
                      </div>
                      <Zap className="w-12 h-12 text-purple-500" />
                    </div>
                  </div>
                </div>

                {/* Subscription Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold mb-4">Subscriptions by Tier</h3>
                    <div className="space-y-3">
                      {Object.entries(metricsData?.subscriptions.by_tier || {}).map(([tier, count]) => (
                        <div key={tier} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getTierBadge(tier)}
                          </div>
                          <span className="text-2xl font-bold text-gray-900">{count as number}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold mb-4">Subscriptions by Status</h3>
                    <div className="space-y-3">
                      {Object.entries(metricsData?.subscriptions.by_status || {}).map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(status)}
                            <span className="text-sm font-medium capitalize">{status}</span>
                          </div>
                          <span className="text-2xl font-bold text-gray-900">{count as number}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* User Details Modal */}
        {selectedUser && userDetails && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">User Details</h2>
                  <button
                    onClick={() => {
                      setSelectedUser(null);
                      setEditingSubscription(false);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </div>

                {/* User Info */}
                <div className="mb-6">
                  <h3 className="font-semibold mb-2">User Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Name:</span> {userDetails.full_name}
                    </div>
                    <div>
                      <span className="text-gray-600">Email:</span> {userDetails.email}
                    </div>
                    <div>
                      <span className="text-gray-600">Role:</span> {userDetails.role}
                    </div>
                    <div>
                      <span className="text-gray-600">Status:</span> {userDetails.is_active ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                </div>

                {/* Subscription Info */}
                {userDetails.subscription && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">Subscription</h3>
                      {!editingSubscription && (
                        <button
                          onClick={() => setEditingSubscription(true)}
                          className="text-sm text-blue-600 hover:text-blue-700"
                        >
                          Edit
                        </button>
                      )}
                    </div>

                    {editingSubscription ? (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Tier</label>
                          <select
                            value={subscriptionForm.tier}
                            onChange={(e) => setSubscriptionForm({ ...subscriptionForm, tier: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                          >
                            <option value="free">Free</option>
                            <option value="starter">Starter</option>
                            <option value="pro">Pro</option>
                            <option value="enterprise">Enterprise</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                          <select
                            value={subscriptionForm.status}
                            onChange={(e) => setSubscriptionForm({ ...subscriptionForm, status: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                          >
                            <option value="trial">Trial</option>
                            <option value="active">Active</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="expired">Expired</option>
                            <option value="suspended">Suspended</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes</label>
                          <textarea
                            value={subscriptionForm.admin_notes}
                            onChange={(e) => setSubscriptionForm({ ...subscriptionForm, admin_notes: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            rows={3}
                          />
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={handleUpdateSubscription}
                            disabled={updateSubscriptionMutation.isPending}
                            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                          >
                            Save Changes
                          </button>
                          <button
                            onClick={() => setEditingSubscription(false)}
                            className="flex-1 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Tier:</span> {getTierBadge(userDetails.subscription.tier)}
                        </div>
                        <div>
                          <span className="text-gray-600">Status:</span> {userDetails.subscription.status}
                        </div>
                        {userDetails.subscription.current_period_end && (
                          <div className="col-span-2">
                            <span className="text-gray-600">Period ends:</span> {formatDateTime.full(userDetails.subscription.current_period_end)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Usage Stats */}
                {userDetails.usage && (
                  <div className="mb-6">
                    <h3 className="font-semibold mb-2">Usage This Month</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Posts:</span> {userDetails.usage.posts_created}
                      </div>
                      <div>
                        <span className="text-gray-600">API Calls:</span> {userDetails.usage.api_calls}
                      </div>
                      <div>
                        <span className="text-gray-600">AI Requests:</span> {userDetails.usage.ai_requests}
                      </div>
                      <div>
                        <span className="text-gray-600">Storage:</span> {userDetails.usage.storage_used_mb.toFixed(1)} MB
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {userDetails.subscription?.status !== 'suspended' && userDetails.role !== 'admin' && (
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Suspension reason..."
                        value={suspendReason}
                        onChange={(e) => setSuspendReason(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-2"
                      />
                      <button
                        onClick={handleSuspend}
                        disabled={!suspendReason.trim() || suspendMutation.isPending}
                        className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        Suspend User
                      </button>
                    </div>
                  )}
                  {(userDetails.subscription?.status === 'suspended' || userDetails.subscription?.status === 'expired') && (
                    <button
                      onClick={() => activateMutation.mutate(selectedUser)}
                      disabled={activateMutation.isPending}
                      className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      Activate User
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
