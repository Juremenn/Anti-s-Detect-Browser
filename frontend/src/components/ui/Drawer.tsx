import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number | string;
}

export function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 480,
}: DrawerProps) {
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

  const panelWidth = typeof width === 'number' ? `min(${width}px, 100vw)` : width;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.28)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 2000,
        animation: 'fadeIn 140ms ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: panelWidth,
          maxWidth: '100vw',
          height: '100vh',
          backgroundColor: '#FFFFFF',
          borderLeft: '1px solid #E5E7EB',
          boxShadow: '-8px 0 24px rgba(15, 23, 42, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box',
          animation: 'slideInRight 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Sticky Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #E5E7EB',
            backgroundColor: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: '#0F172A',
                letterSpacing: -0.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {title || 'Configuration'}
            </div>
            {subtitle && (
              <div
                style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-mono, monospace)',
                  color: '#64748B',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {subtitle}
              </div>
            )}
          </div>

          <button
            type="button"
            title="Close (Esc)"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: '1px solid transparent',
              background: 'transparent',
              color: '#64748B',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 120ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F1F5F9';
              e.currentTarget.style.color = '#0F172A';
              e.currentTarget.style.borderColor = '#E2E8F0';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#64748B';
              e.currentTarget.style.borderColor = 'transparent';
            }}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        {/* Scrollable Body (overflow-x hidden, quiet scrollbar) */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '20px 24px',
            boxSizing: 'border-box',
          }}
          className="drawer-scroll-body"
        >
          {children}
        </div>

        {/* Sticky Footer */}
        {footer && (
          <div
            style={{
              padding: '14px 24px',
              borderTop: '1px solid #E5E7EB',
              backgroundColor: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexShrink: 0,
              zIndex: 10,
              boxSizing: 'border-box',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
