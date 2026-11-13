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
        bottom: 24,
        right: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 2000,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => onDismiss(t.id)}
          style={{
            pointerEvents: 'auto',
            padding: '10px 16px',
            backgroundColor: '#192036',
            border: '1px solid #2f54eb',
            borderRadius: 6,
            fontSize: 12.5,
            fontWeight: 500,
            color: '#ffffff',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            maxWidth: 380,
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          <span style={{ flex: 1 }}>{t.message}</span>
          <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>&times;</span>
        </div>
      ))}
    </div>
  );
}
