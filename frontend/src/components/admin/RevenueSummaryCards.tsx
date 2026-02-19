import { useQuery } from '@tanstack/react-query';
import { DollarSign, TrendingUp, Users, AlertCircle } from 'lucide-react';

export function RevenueSummaryCards() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['revenue-summary'],
    queryFn: async () => {
      const response = await fetch('/api/admin/revenue/summary', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch revenue summary');
      return response.json();
    },
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Failed to load revenue data</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* MRR */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">Monthly Recurring Revenue</span>
          <DollarSign className="w-5 h-5 text-green-600" />
        </div>
        <div className="text-2xl font-bold text-gray-900">
          ${data?.mrr?.toFixed(2) || '0.00'}
        </div>
        <div className="mt-2 flex items-center text-sm">
          <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
          <span className={data?.mrr_growth_rate >= 0 ? 'text-green-600' : 'text-red-600'}>
            {data?.mrr_growth_rate >= 0 ? '+' : ''}{data?.mrr_growth_rate?.toFixed(1) || 0}%
          </span>
          <span className="text-gray-500 ml-1">vs last month</span>
        </div>
      </div>

      {/* Active Subscribers */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">Active Subscribers</span>
          <Users className="w-5 h-5 text-blue-600" />
        </div>
        <div className="text-2xl font-bold text-gray-900">
          {data?.active_subscribers || 0}
        </div>
        <div className="mt-2 text-sm text-gray-500">
          Current paying users
        </div>
      </div>

      {/* ARPU */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">Avg Revenue Per User</span>
          <DollarSign className="w-5 h-5 text-purple-600" />
        </div>
        <div className="text-2xl font-bold text-gray-900">
          ${data?.arpu?.toFixed(2) || '0.00'}
        </div>
        <div className="mt-2 text-sm text-gray-500">
          Per month
        </div>
      </div>

      {/* LTV */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">Estimated LTV</span>
          <TrendingUp className="w-5 h-5 text-orange-600" />
        </div>
        <div className="text-2xl font-bold text-gray-900">
          ${data?.estimated_ltv?.toFixed(2) || '0.00'}
        </div>
        <div className="mt-2 text-sm text-gray-500">
          Customer lifetime value
        </div>
      </div>

      {/* Failed Payments Warning */}
      {data?.failed_payments_count > 0 && (
        <div className="md:col-span-2 lg:col-span-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <span className="font-medium text-yellow-800">
              {data.failed_payments_count} failed payment{data.failed_payments_count !== 1 ? 's' : ''} 
              ({' $' + (data.failed_payments_value || 0).toFixed(2)})
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
