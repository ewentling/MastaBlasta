import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const accentMap = {
    danger: { color: '#fca5a5', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', btnBg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' },
    warning: { color: '#fcd34d', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)', btnBg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
    info: { color: '#93c5fd', bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)', btnBg: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' },
  };
  const accent = accentMap[variant];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '0.75rem',
                background: accent.bg,
                border: `1px solid ${accent.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: accent.color,
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={20} />
            </div>
            <h3 style={{ margin: 0 }}>{title}</h3>
          </div>
          <button className="close-button" onClick={onClose} disabled={loading}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--color-textSecondary)', fontSize: '0.9375rem', margin: 0, lineHeight: 1.6 }}>
            {message}
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            className="btn"
            disabled={loading}
            onClick={() => { onConfirm(); onClose(); }}
            style={{
              background: accent.btnBg,
              color: 'white',
              boxShadow: `0 4px 16px ${accent.border}`,
            }}
          >
            {loading ? 'Processing…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
