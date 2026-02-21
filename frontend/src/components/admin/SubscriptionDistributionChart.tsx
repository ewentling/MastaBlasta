import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = ['#00e5ff', '#7c4dff', '#ff4fed', '#34d399'];

export function SubscriptionDistributionChart() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['subscription-distribution'],
    queryFn: async () => {
      const response = await fetch(
        '/api/admin/analytics/subscription-distribution',
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch subscription distribution');
      return response.json();
    },
    refetchInterval: 300000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-400"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg p-4" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
        <p className="text-red-300">Failed to load subscription data</p>
      </div>
    );
  }

  const chartData = data?.distribution || [];

  return (
    <div className="rounded-xl p-6 shadow-lg" style={{ background: 'rgba(5,7,30,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <h3 className="text-sm font-semibold text-white mb-4">Subscription Distribution</h3>
      <div className="flex flex-col items-center">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ tier, percentage }) => `${tier}: ${percentage}%`}
              outerRadius={100}
              fill="#7c4dff"
              dataKey="count"
            >
              {chartData.map((_entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: 'rgba(5,7,30,0.95)', border: '1px solid rgba(0,229,255,0.2)', borderRadius: '0.5rem', color: '#f8fbff' }}
            />
            <Legend wrapperStyle={{ color: '#8090c2' }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-4 text-center">
          <p className="text-xs text-slate-500">Total Active Subscriptions</p>
          <p className="text-2xl font-bold text-white">{data?.total_active || 0}</p>
        </div>
      </div>
    </div>
  );
}
