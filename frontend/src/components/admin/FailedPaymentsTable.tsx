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
    refetchInterval: 300000,
  });

  const cardStyle = { background: 'rgba(5,7,30,0.85)', border: '1px solid rgba(255,255,255,0.08)' };

  if (isLoading) {
    return (
      <div className="rounded-xl p-6 shadow-lg" style={cardStyle}>
        <h3 className="text-sm font-semibold text-white mb-4">Failed Payments</h3>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-400"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg p-4" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
        <p className="text-red-300">Failed to load failed payments</p>
      </div>
    );
  }

  const failedPayments = data?.failed_payments || [];

  if (failedPayments.length === 0) {
    return (
      <div className="rounded-xl p-6 shadow-lg" style={cardStyle}>
        <h3 className="text-sm font-semibold text-white mb-4">Failed Payments</h3>
        <div className="text-center py-8 text-slate-500">
          <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-emerald-400" />
          <p>No failed payments! 🎉</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl shadow-lg overflow-hidden" style={cardStyle}>
      <div className="flex justify-between items-center px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 className="text-sm font-semibold text-white">Failed Payments</h3>
        <div className="text-sm text-slate-400">
          Total at risk: <span className="font-bold text-red-400">${data?.total_value?.toFixed(2) || '0.00'}</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Tier</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Days Overdue</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {failedPayments.map((payment: any) => (
              <tr key={payment.user_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-white">{payment.user_name || 'N/A'}</div>
                  <div className="text-xs text-slate-400">{payment.user_email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full text-cyan-300" style={{ background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.2)' }}>
                    {payment.tier}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-200">
                  ${payment.amount?.toFixed(2) || '0.00'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-red-400 font-medium">
                    {payment.days_overdue} days
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => {
                      alert(`Email functionality would open for ${payment.user_email}`);
                    }}
                    className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
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
