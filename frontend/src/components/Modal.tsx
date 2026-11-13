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
  maxWidth = 480,
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
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        animation: 'fadeIn 120ms ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-panel)',
          width: '92%',
          maxWidth,
          boxShadow: 'var(--shadow-popover)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            height: 44,
            padding: '0 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: -0.1,
            }}
          >
            {title}
          </span>
          <button
            className="btn-icon"
            onClick={onClose}
            style={{ width: 24, height: 24 }}
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '16px', overflowY: 'auto', maxHeight: '75vh' }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              height: 48,
              padding: '0 16px',
              borderTop: '1px solid var(--border)',
              backgroundColor: 'var(--bg-base)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 8,
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
