import { useState, useCallback, createContext, useContext, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Check, X, AlertTriangle, Info } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
    exiting?: boolean;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType, duration?: number) => void;
}

// ── Context ──────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within a ToastProvider');
    return ctx;
}

// ── Provider (wraps app) ─────────────────────────────────────────────────────
let _nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

    const dismiss = useCallback((id: number) => {
        // mark as exiting to trigger slide-out animation
        setToasts(prev => prev.map(t => (t.id === id ? { ...t, exiting: true } : t)));
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300);
    }, []);

    const showToast = useCallback(
        (message: string, type: ToastType = 'info', duration = 4000) => {
            const id = ++_nextId;
            setToasts(prev => [...prev, { id, message, type }]);
            const timer = setTimeout(() => dismiss(id), duration);
            timers.current.set(id, timer);
        },
        [dismiss],
    );

    // Clean up timers
    useEffect(() => {
        return () => {
            timers.current.forEach(t => clearTimeout(t));
        };
    }, []);

    const iconMap: Record<ToastType, ReactNode> = {
        success: <Check size={18} />,
        error: <X size={18} />,
        warning: <AlertTriangle size={18} />,
        info: <Info size={18} />,
    };

    const colorMap: Record<ToastType, { bg: string; border: string; icon: string }> = {
        success: { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)', icon: '#6ee7b7' },
        error: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', icon: '#fca5a5' },
        warning: { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)', icon: '#fcd34d' },
        info: { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)', icon: '#93c5fd' },
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}

            {/* Toast container — fixed bottom-right */}
            <div
                style={{
                    position: 'fixed',
                    bottom: '1.5rem',
                    right: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column-reverse',
                    gap: '0.625rem',
                    zIndex: 9999,
                    pointerEvents: 'none',
                }}
            >
                {toasts.map(toast => {
                    const c = colorMap[toast.type];
                    return (
                        <div
                            key={toast.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.875rem 1.25rem',
                                minWidth: '280px',
                                maxWidth: '420px',
                                background: c.bg,
                                backdropFilter: 'blur(16px)',
                                WebkitBackdropFilter: 'blur(16px)',
                                border: `1px solid ${c.border}`,
                                borderRadius: '0.875rem',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
                                color: 'var(--color-textPrimary)',
                                fontSize: '0.9rem',
                                fontWeight: 500,
                                pointerEvents: 'auto',
                                animation: toast.exiting
                                    ? 'toastSlideOut 0.3s ease forwards'
                                    : 'toastSlideIn 0.3s ease',
                            }}
                        >
                            <span style={{ color: c.icon, flexShrink: 0, display: 'flex' }}>
                                {iconMap[toast.type]}
                            </span>
                            <span style={{ flex: 1 }}>{toast.message}</span>
                            <button
                                onClick={() => dismiss(toast.id)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--color-textSecondary)',
                                    cursor: 'pointer',
                                    padding: '2px',
                                    display: 'flex',
                                    flexShrink: 0,
                                }}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}
