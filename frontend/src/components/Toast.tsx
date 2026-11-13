import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { ToastMessage } from '../types';

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        zIndex: 2000,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => {
        const isError = t.type === 'error';
        const isSuccess = t.type === 'success';

        return (
          <div
            key={t.id}
            onClick={() => onDismiss(t.id)}
            style={{
              pointerEvents: 'auto',
              padding: '8px 12px',
              backgroundColor: 'var(--bg-raised)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-control)',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--text-primary)',
              boxShadow: 'var(--shadow-popover)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              maxWidth: 360,
              animation: 'fadeIn 120ms ease-out',
            }}
          >
            {isSuccess ? (
              <CheckCircle2 size={14} strokeWidth={1.5} color="var(--status-running)" />
            ) : isError ? (
              <XCircle size={14} strokeWidth={1.5} color="var(--status-error)" />
            ) : (
              <Info size={14} strokeWidth={1.5} color="var(--accent)" />
            )}
            <span style={{ flex: 1, lineHeight: 1.3 }}>{t.message}</span>
            <X size={12} strokeWidth={1.5} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
          </div>
        );
      })}
    </div>
  );
}
