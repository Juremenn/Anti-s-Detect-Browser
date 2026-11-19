import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: number;
}

export function Modal({
  isOpen,
  title,
  onClose,
  children,
  footer,
  maxWidth = 520,
}: ModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.48)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-dialog)',
          width: '100%',
          maxWidth,
          maxHeight: '90vh',
          boxShadow: 'var(--shadow-dialog)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            height: 54,
            padding: '0 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </span>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            style={{ width: 28, height: 28 }}
          >
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              height: 58,
              padding: '0 20px',
              borderTop: '1px solid var(--border)',
              backgroundColor: 'var(--bg-base)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10,
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
