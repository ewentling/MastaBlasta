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
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
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

  const chartData = data?.revenue_trend || [];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold">Revenue Trend</h3>
          <div className="mt-2 flex gap-6">
            <div>
              <p className="text-sm text-gray-600">MRR</p>
              <p className="text-2xl font-bold text-green-600">${data?.mrr?.toFixed(2) || '0.00'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Churn Rate</p>
              <p className="text-2xl font-bold text-red-600">{data?.churn_rate || 0}%</p>
            </div>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
          <Area 
            type="monotone" 
            dataKey="amount" 
            stroke="#10b981" 
            fill="#10b981" 
            fillOpacity={0.3}
            name="Revenue"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
