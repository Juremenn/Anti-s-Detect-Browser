import { useEffect, useRef } from 'react';
import { MenuItem } from './DropdownMenu';

export interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
  width?: number;
}

export function ContextMenu({ x, y, items, onClose, width = 180 }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Ensure menu stays within screen boundaries
  const adjustedX = Math.min(x, window.innerWidth - width - 10);
  const adjustedY = Math.min(y, window.innerHeight - items.length * 30 - 20);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: adjustedX,
        top: adjustedY,
        width,
        backgroundColor: 'var(--bg-overlay)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-control)',
        boxShadow: 'var(--shadow-popover)',
        padding: 4,
        zIndex: 9999,
        animation: 'fadeIn 100ms ease-out',
      }}
    >
      {items.map((item, idx) => {
        if (item.separator) {
          return (
            <div
              key={idx}
              style={{ height: 1, backgroundColor: 'var(--border)', margin: '4px 0' }}
            />
          );
        }

        return (
          <button
            key={idx}
            type="button"
            disabled={item.disabled}
            onClick={() => {
              onClose();
              item.onClick?.();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              height: 28,
              padding: '0 8px',
              borderRadius: 4,
              border: 'none',
              background: 'transparent',
              color: item.danger ? 'var(--status-danger)' : 'var(--text-secondary)',
              fontSize: 'var(--text-label)',
              textAlign: 'left',
              cursor: item.disabled ? 'not-allowed' : 'pointer',
              opacity: item.disabled ? 0.4 : 1,
              outline: 'none',
            }}
            onMouseEnter={(e) => {
              if (!item.disabled) {
                e.currentTarget.style.backgroundColor = item.danger
                  ? 'rgba(242, 85, 90, 0.12)'
                  : 'var(--bg-raised)';
                e.currentTarget.style.color = item.danger
                  ? 'var(--status-danger)'
                  : 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!item.disabled) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = item.danger
                  ? 'var(--status-danger)'
                  : 'var(--text-secondary)';
              }
            }}
          >
            {item.icon}
            <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
