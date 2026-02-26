import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Clock, CheckCircle2, XCircle, Shield, Globe, MousePointerClick } from 'lucide-react';
import { accountsApi } from '../api';
import type { Account } from '../types';

interface AuditLogModalProps {
    account: Account | null;
    onClose: () => void;
}

export default function AuditLogModal({ account, onClose }: AuditLogModalProps) {
    const [page, setPage] = useState(0);
    const limit = 20;

    const { data, isLoading } = useQuery({
        queryKey: ['accountLogs', account?.id, page],
        queryFn: () => accountsApi.getLogs(account!.id, limit, page * limit),
        enabled: !!account,
    });

    if (!account) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl dark:bg-gray-800 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Connection History</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Audit logs for {account.display_name} ({account.platform})
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto w-full">
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600"></div>
                        </div>
                    ) : data && data.logs.length > 0 ? (
                        <div className="divide-y divide-gray-200 dark:divide-gray-700 w-full">
                            {data.logs.map((log: any) => (
                                <div key={log.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors w-full">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center space-x-3">
                                            {log.status === 'success' ? (
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30">
                                                    <CheckCircle2 className="h-5 w-5" />
                                                </div>
                                            ) : (
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30">
                                                    <XCircle className="h-5 w-5" />
                                                </div>
                                            )}

                                            <div>
                                                <div className="flex items-center space-x-2">
                                                    <span className="font-medium text-gray-900 dark:text-white capitalize">
                                                        {log.action}
                                                    </span>
                                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${log.status === 'success'
                                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                                        }`}>
                                                        {log.status}
                                                    </span>
                                                </div>
                                                <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                                                    <div className="flex items-center space-x-1">
                                                        <Clock className="h-4 w-4" />
                                                        <span>{new Date(log.created_at).toLocaleString()}</span>
                                                    </div>
                                                    {log.ip_address && (
                                                        <div className="flex items-center space-x-1">
                                                            <Globe className="h-4 w-4" />
                                                            <span>{log.ip_address}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Details Grid */}
                                    <div className="mt-4 ml-13 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        {log.scopes && log.scopes.length > 0 && (
                                            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                                                <div className="flex items-center space-x-2 mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                                    <Shield className="h-4 w-4 text-indigo-500" />
                                                    <span>Granted Scopes</span>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {log.scopes.map((scope: string) => (
                                                        <span key={scope} className="inline-flex rounded bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                                                            {scope}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {log.user_agent && (
                                            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                                                <div className="flex items-center space-x-2 mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                                    <MousePointerClick className="h-4 w-4 text-blue-500" />
                                                    <span>Browser / Client</span>
                                                </div>
                                                <p className="text-xs text-gray-600 dark:text-gray-400 break-words">
                                                    {log.user_agent}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {log.error_message && (
                                        <div className="mt-4 ml-13 rounded-md bg-red-50 p-4 dark:bg-red-900/20">
                                            <div className="flex">
                                                <div className="flex-shrink-0">
                                                    <XCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                                                </div>
                                                <div className="ml-3">
                                                    <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Error Details</h3>
                                                    <div className="mt-2 text-sm text-red-700 dark:text-red-400">
                                                        <p>{log.error_message}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                            <Shield className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4 opacity-50" />
                            <p>No audit logs found for this account.</p>
                        </div>
                    )}
                </div>

                {/* Footer pagination */}
                {data && data.count > limit && (
                    <div className="border-t border-gray-200 p-4 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
                        <button
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            Showing {page * limit + 1} to {Math.min((page + 1) * limit, data.count)} of {data.count}
                        </span>
                        <button
                            onClick={() => setPage((p) => p + 1)}
                            disabled={(page + 1) * limit >= data.count}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
