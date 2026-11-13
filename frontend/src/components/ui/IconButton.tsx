import React, { useState } from 'react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tooltip?: string;
  size?: 'sm' | 'md';
  variant?: 'ghost' | 'danger';
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ children, tooltip, size = 'md', variant = 'ghost', style, disabled, ...props }, ref) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const dim = size === 'sm' ? 28 : 32;

    return (
      <div style={{ position: 'relative', display: 'inline-flex' }}>
        <button
          ref={ref}
          disabled={disabled}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: dim,
            height: dim,
            borderRadius: 'var(--radius-control)',
            backgroundColor: 'transparent',
            border: '1px solid transparent',
            color: variant === 'danger' ? 'var(--status-danger)' : 'var(--text-secondary)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.35 : 1,
            outline: 'none',
            ...style,
          }}
          onMouseEnter={(e) => {
            if (!disabled) {
              if (variant === 'danger') {
                e.currentTarget.style.backgroundColor = 'rgba(242, 85, 90, 0.12)';
                e.currentTarget.style.borderColor = 'rgba(242, 85, 90, 0.3)';
              } else {
                e.currentTarget.style.backgroundColor = 'var(--bg-raised)';
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }
              if (tooltip) setShowTooltip(true);
            }
          }}
          onMouseLeave={(e) => {
            if (!disabled) {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.color =
                variant === 'danger' ? 'var(--status-danger)' : 'var(--text-secondary)';
              setShowTooltip(false);
            }
          }}
          onFocus={() => {
            if (tooltip && !disabled) setShowTooltip(true);
          }}
          onBlur={() => setShowTooltip(false)}
          {...props}
        >
          {children}
        </button>

        {tooltip && showTooltip && (
          <div
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 6px)',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'var(--bg-overlay)',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              padding: '3px 8px',
              fontSize: 'var(--text-caption)',
              fontWeight: 500,
              color: 'var(--text-primary)',
              boxShadow: 'var(--shadow-popover)',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex: 9999,
            }}
          >
            {tooltip}
          </div>
        )}
      </div>
    );
  }
);

IconButton.displayName = 'IconButton';

