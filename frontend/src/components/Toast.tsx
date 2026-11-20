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
        alignItems: 'flex-end',
        gap: 8,
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
            role={isError ? 'alert' : 'status'}
            style={{
              pointerEvents: 'auto',
              width: 'calc(100vw - 32px)',
              maxWidth: 380,
              padding: '12px 14px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: 10,
              fontSize: 12.5,
              fontWeight: 500,
              color: '#0F172A',
              boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.12)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              animation: 'fadeIn 120ms ease-out',
            }}
          >
            <span style={{ display: 'inline-flex', paddingTop: 2, flexShrink: 0 }} aria-hidden="true">
              {isSuccess ? (
                <CheckCircle2 size={15} strokeWidth={1.75} color="#15803D" />
              ) : isError ? (
                <XCircle size={15} strokeWidth={1.75} color="#DC2626" />
              ) : (
                <Info size={15} strokeWidth={1.75} color="#4F46E5" />
              )}
            </span>

            <span
              title={t.message}
              style={{
                flex: 1,
                minWidth: 0,
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                wordBreak: 'break-word',
                fontSize: 12.5,
                lineHeight: 1.45,
                color: '#0F172A',
              }}
            >
              {t.message}
            </span>

            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss notification"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 22,
                height: 22,
                padding: 0,
                marginTop: -2,
                marginRight: -4,
                borderRadius: 6,
                border: 'none',
                backgroundColor: 'transparent',
                color: '#64748B',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <X size={13} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
