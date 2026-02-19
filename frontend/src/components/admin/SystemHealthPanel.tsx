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
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'unhealthy':
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Activity className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 border-green-200';
      case 'warning':
        return 'bg-yellow-100 border-yellow-200';
      case 'unhealthy':
      case 'error':
        return 'bg-red-100 border-red-200';
      default:
        return 'bg-gray-100 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">System Health</h3>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">System Health</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Database Health */}
        <div className={`border rounded-lg p-4 ${getStatusColor(data?.database?.status || 'unknown')}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              <span className="font-medium">Database</span>
            </div>
            {getStatusIcon(data?.database?.status)}
          </div>
          <p className="text-sm text-gray-600 capitalize">
            {data?.database?.status || 'Unknown'}
          </p>
        </div>

        {/* Storage Health */}
        <div className={`border rounded-lg p-4 ${getStatusColor(data?.storage?.status || 'unknown')}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5" />
              <span className="font-medium">Storage</span>
            </div>
            {getStatusIcon(data?.storage?.status)}
          </div>
          <p className="text-sm text-gray-600">
            {data?.storage?.usage_percent 
              ? `${data.storage.usage_percent}% Used` 
              : 'Unknown'}
          </p>
        </div>

        {/* API Health */}
        <div className={`border rounded-lg p-4 ${getStatusColor(data?.api?.status || 'healthy')}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              <span className="font-medium">API</span>
            </div>
            {getStatusIcon(data?.api?.status || 'healthy')}
          </div>
          <p className="text-sm text-gray-600 capitalize">
            {data?.api?.status || 'Healthy'}
          </p>
        </div>
      </div>
      
      {/* Overall Status */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Overall Status:</span>
          <div className="flex items-center gap-2">
            {getStatusIcon(data?.overall)}
            <span className="text-sm font-medium capitalize">{data?.overall || 'Unknown'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
