import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Clock } from 'lucide-react';

interface UserGrowthChartProps {
  period?: 'daily' | 'weekly' | 'monthly';
  days?: number;
}

export function UserGrowthChart({ period: initPeriod = 'daily', days: initDays = 30 }: UserGrowthChartProps) {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>(initPeriod);
  const [days, setDays] = useState(initDays);
  const { data, isLoading, error, dataUpdatedAt } = useQuery({
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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">User Growth Over Time</h3>
        <div className="flex items-center gap-2">
          {dataUpdatedAt > 0 && (
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <div className="flex gap-1">
            {([30, 60, 90] as const).map((d) => (
              <button
                key={d}
                onClick={() => { setDays(d); setPeriod(d <= 30 ? 'daily' : 'weekly'); }}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${days === d ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                style={days === d ? { background: 'rgba(0,229,255,0.15)', border: '1px solid rgba(0,229,255,0.3)' } : { border: '1px solid transparent' }}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>
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
