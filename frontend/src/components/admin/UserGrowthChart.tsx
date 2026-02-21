import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface UserGrowthChartProps {
  period?: 'daily' | 'weekly' | 'monthly';
  days?: number;
}

export function UserGrowthChart({ period = 'daily', days = 30 }: UserGrowthChartProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['user-growth', period, days],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/analytics/user-growth?period=${period}&days=${days}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch user growth data');
      return response.json();
    },
    refetchInterval: 300000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg p-4" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
        <p className="text-red-300">Failed to load user growth data</p>
      </div>
    );
  }

  const chartData = data?.data || [];

  return (
    <div className="rounded-xl p-6 shadow-lg" style={{ background: 'rgba(5,7,30,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <h3 className="text-sm font-semibold text-white mb-4">User Growth Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
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
            contentStyle={{ background: 'rgba(5,7,30,0.95)', border: '1px solid rgba(0,229,255,0.2)', borderRadius: '0.5rem', color: '#f8fbff' }}
            labelStyle={{ color: '#b2c7ff' }}
          />
          <Legend wrapperStyle={{ color: '#8090c2' }} />
          <Line
            type="monotone"
            dataKey="new_users"
            stroke="#00e5ff"
            name="New Users"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="total_users"
            stroke="#7c4dff"
            name="Total Users"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
