import type { CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Database, HardDrive, CheckCircle, XCircle, AlertTriangle, RefreshCw, Clock } from 'lucide-react';

export function SystemHealthPanel() {
  const { data, isLoading, refetch, dataUpdatedAt, isFetching } = useQuery({
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg p-4 h-24" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }} />
          ))}
        </div>
        <div className="mt-4 rounded-lg h-10 animate-pulse" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }} />
      </div>
    );
  }

  return (
    <div className="rounded-xl p-6 shadow-lg" style={{ background: 'rgba(5,7,30,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">System Health</h3>
        <div className="flex items-center gap-3">
          {dataUpdatedAt > 0 && (
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Last checked: {new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-1 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            title="Force refresh health status"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>
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
          {data?.database?.response_time_ms && (
            <p className="text-xs text-slate-500 mt-1">
              Response: {data.database.response_time_ms} ms
            </p>
          )}
          {data?.database?.error && (
            <p className="text-xs text-red-400 mt-1 break-words" title={data.database.error}>
              Error: {data.database.error}
            </p>
          )}
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
            {data?.storage?.usage_percent != null
              ? `${data.storage.usage_percent}% Used`
              : data?.storage?.message || data?.storage?.status || 'Unknown'}
          </p>
          {data?.storage?.used_gb != null && data?.storage?.total_gb != null && data?.storage?.free_gb != null && (
            <p className="text-xs text-slate-500 mt-1">
              {data.storage.used_gb} GB used of {data.storage.total_gb} GB ({data.storage.free_gb} GB free)
            </p>
          )}
          {data?.storage?.usage_percent != null && (
            <div className="mt-2 w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(data.storage.usage_percent, 100)}%`,
                  background: data.storage.usage_percent > 85
                    ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                    : data.storage.usage_percent > 65
                      ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                      : 'linear-gradient(90deg, #34d399, #10b981)',
                }}
              />
            </div>
          )}
          {data?.storage?.error && (
            <p className="text-xs text-red-400 mt-1 break-words" title={data.storage.error}>
              Error: {data.storage.error}
            </p>
          )}
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
      <div className="mt-4 p-3 rounded-lg transition-all duration-500" style={getStatusStyle(data?.overall || 'unknown')}>
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
