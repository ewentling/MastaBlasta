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
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Failed to load user growth data</p>
      </div>
    );
  }

  const chartData = data?.data || [];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">User Growth Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="new_users" 
            stroke="#3b82f6" 
            name="New Users"
            strokeWidth={2}
          />
          <Line 
            type="monotone" 
            dataKey="total_users" 
            stroke="#10b981" 
            name="Total Users"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
