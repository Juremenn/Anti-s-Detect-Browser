import { ReactNode, useEffect, useRef, useState } from 'react';

export interface MenuItem {
  id?: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
  onClick?: () => void;
}

export interface DropdownMenuProps {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  items: MenuItem[];
  align?: 'left' | 'right';
  width?: number;
}

export function DropdownMenu({ trigger, items, align = 'right', width = 180 }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {trigger({ open, toggle: () => setOpen(!open) })}

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            [align === 'right' ? 'right' : 'left']: 0,
            width,
            backgroundColor: 'var(--bg-overlay)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-control)',
            boxShadow: 'var(--shadow-popover)',
            padding: 4,
            zIndex: 3000,
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
                  setOpen(false);
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
      )}
    </div>
  );
}
