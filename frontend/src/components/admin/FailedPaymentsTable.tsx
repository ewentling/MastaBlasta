import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Mail } from 'lucide-react';

export function FailedPaymentsTable() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['failed-payments'],
    queryFn: async () => {
      const response = await fetch('/api/admin/revenue/failed-payments', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch failed payments');
      return response.json();
    },
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Failed Payments</h3>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Failed to load failed payments</p>
      </div>
    );
  }

  const failedPayments = data?.failed_payments || [];

  if (failedPayments.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Failed Payments</h3>
        <div className="text-center py-8 text-gray-500">
          <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-green-500" />
          <p>No failed payments! 🎉</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Failed Payments</h3>
        <div className="text-sm text-gray-600">
          Total at risk: <span className="font-bold text-red-600">${data?.total_value?.toFixed(2) || '0.00'}</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tier
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Days Overdue
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {failedPayments.map((payment: any) => (
              <tr key={payment.user_id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{payment.user_name || 'N/A'}</div>
                  <div className="text-sm text-gray-500">{payment.user_email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    {payment.tier}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  ${payment.amount?.toFixed(2) || '0.00'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-red-600 font-medium">
                    {payment.days_overdue} days
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => {
                      // This would open the email composer with this user pre-selected
                      alert(`Email functionality would open for ${payment.user_email}`);
                    }}
                    className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                  >
                    <Mail className="w-4 h-4" />
                    Send Reminder
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
