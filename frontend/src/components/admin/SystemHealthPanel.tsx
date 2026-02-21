import type { CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Database, HardDrive, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

export function SystemHealthPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const response = await fetch('/api/admin/health/system', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch system health');
      return response.json();
    },
    refetchInterval: 30000,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case 'unhealthy':
      case 'error':
        return <XCircle className="w-5 h-5 text-red-400" />;
      default:
        return <Activity className="w-5 h-5 text-slate-500" />;
    }
  };

  const getStatusStyle = (status: string): CSSProperties => {
    switch (status) {
      case 'healthy':
        return { background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)' };
      case 'warning':
        return { background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)' };
      case 'unhealthy':
      case 'error':
        return { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' };
      default:
        return { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' };
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-xl p-6 shadow-lg" style={{ background: 'rgba(5,7,30,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 className="text-sm font-semibold text-white mb-4">System Health</h3>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-6 shadow-lg" style={{ background: 'rgba(5,7,30,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <h3 className="text-sm font-semibold text-white mb-4">System Health</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Database Health */}
        <div className="rounded-lg p-4" style={getStatusStyle(data?.database?.status || 'unknown')}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-slate-300" />
              <span className="font-medium text-slate-200">Database</span>
            </div>
            {getStatusIcon(data?.database?.status)}
          </div>
          <p className="text-sm text-slate-400 capitalize">
            {data?.database?.status || 'Unknown'}
          </p>
        </div>

        {/* Storage Health */}
        <div className="rounded-lg p-4" style={getStatusStyle(data?.storage?.status || 'unknown')}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-slate-300" />
              <span className="font-medium text-slate-200">Storage</span>
            </div>
            {getStatusIcon(data?.storage?.status)}
          </div>
          <p className="text-sm text-slate-400">
            {data?.storage?.usage_percent
              ? `${data.storage.usage_percent}% Used`
              : 'Unknown'}
          </p>
        </div>

        {/* API Health */}
        <div className="rounded-lg p-4" style={getStatusStyle(data?.api?.status || 'healthy')}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-slate-300" />
              <span className="font-medium text-slate-200">API</span>
            </div>
            {getStatusIcon(data?.api?.status || 'healthy')}
          </div>
          <p className="text-sm text-slate-400 capitalize">
            {data?.api?.status || 'Healthy'}
          </p>
        </div>
      </div>

      {/* Overall Status */}
      <div className="mt-4 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-400">Overall Status:</span>
          <div className="flex items-center gap-2">
            {getStatusIcon(data?.overall)}
            <span className="text-sm font-medium text-slate-200 capitalize">{data?.overall || 'Unknown'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
