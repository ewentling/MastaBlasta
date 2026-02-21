import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface RevenueChartProps {
  days?: number;
}

export function RevenueChart({ days = 90 }: RevenueChartProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['revenue-analytics', days],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/analytics/revenue?days=${days}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch revenue data');
      return response.json();
    },
    refetchInterval: 300000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
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

  const chartData = data?.revenue_trend || [];

  return (
    <div className="rounded-xl p-6 shadow-lg" style={{ background: 'rgba(5,7,30,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Revenue Trend</h3>
          <div className="mt-2 flex gap-6">
            <div>
              <p className="text-xs text-slate-500">MRR</p>
              <p className="text-2xl font-bold text-emerald-400">${data?.mrr?.toFixed(2) || '0.00'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Churn Rate</p>
              <p className="text-2xl font-bold text-red-400">{data?.churn_rate || 0}%</p>
            </div>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: '#8090c2' }}
            angle={-45}
            textAnchor="end"
            height={80}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#8090c2' }}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
          />
          <Tooltip
            formatter={(value) => `$${Number(value).toFixed(2)}`}
            contentStyle={{ background: 'rgba(5,7,30,0.95)', border: '1px solid rgba(0,229,255,0.2)', borderRadius: '0.5rem', color: '#f8fbff' }}
            labelStyle={{ color: '#b2c7ff' }}
          />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="#34d399"
            fill="#34d399"
            fillOpacity={0.15}
            name="Revenue"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
