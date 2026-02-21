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
    refetchInterval: 300000,
  });

  const cardStyle = { background: 'rgba(5,7,30,0.85)', border: '1px solid rgba(255,255,255,0.08)' };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl p-6 animate-pulse" style={cardStyle}>
            <div className="h-4 rounded w-1/2 mb-4" style={{ background: 'rgba(255,255,255,0.06)' }}></div>
            <div className="h-8 rounded w-3/4" style={{ background: 'rgba(255,255,255,0.06)' }}></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg p-4" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
        <p className="text-red-300">Failed to load revenue data</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* MRR */}
      <div className="rounded-xl p-6 shadow-lg" style={cardStyle}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400">Monthly Recurring Revenue</span>
          <DollarSign className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="text-2xl font-bold text-white">
          ${data?.mrr?.toFixed(2) || '0.00'}
        </div>
        <div className="mt-2 flex items-center text-sm">
          <TrendingUp className="w-4 h-4 text-emerald-400 mr-1" />
          <span className={data?.mrr_growth_rate >= 0 ? 'text-emerald-400' : 'text-red-400'}>
            {data?.mrr_growth_rate >= 0 ? '+' : ''}{data?.mrr_growth_rate?.toFixed(1) || 0}%
          </span>
          <span className="text-slate-500 ml-1">vs last month</span>
        </div>
      </div>

      {/* Active Subscribers */}
      <div className="rounded-xl p-6 shadow-lg" style={cardStyle}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400">Active Subscribers</span>
          <Users className="w-5 h-5 text-cyan-400" />
        </div>
        <div className="text-2xl font-bold text-white">
          {data?.active_subscribers || 0}
        </div>
        <div className="mt-2 text-xs text-slate-500">
          Current paying users
        </div>
      </div>

      {/* ARPU */}
      <div className="rounded-xl p-6 shadow-lg" style={cardStyle}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400">Avg Revenue Per User</span>
          <DollarSign className="w-5 h-5 text-violet-400" />
        </div>
        <div className="text-2xl font-bold text-white">
          ${data?.arpu?.toFixed(2) || '0.00'}
        </div>
        <div className="mt-2 text-xs text-slate-500">
          Per month
        </div>
      </div>

      {/* LTV */}
      <div className="rounded-xl p-6 shadow-lg" style={cardStyle}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400">Estimated LTV</span>
          <TrendingUp className="w-5 h-5 text-amber-400" />
        </div>
        <div className="text-2xl font-bold text-white">
          ${data?.estimated_ltv?.toFixed(2) || '0.00'}
        </div>
        <div className="mt-2 text-xs text-slate-500">
          Customer lifetime value
        </div>
      </div>

      {/* Failed Payments Warning */}
      {data?.failed_payments_count > 0 && (
        <div className="md:col-span-2 lg:col-span-4 rounded-lg p-4" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)' }}>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            <span className="font-medium text-amber-300">
              {data.failed_payments_count} failed payment{data.failed_payments_count !== 1 ? 's' : ''}
              ({' $' + (data.failed_payments_value || 0).toFixed(2)})
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
