import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'secondary',
      size = 'md',
      loading = false,
      disabled = false,
      icon,
      style,
      className = '',
      ...props
    },
    ref
  ) => {
    const isSm = size === 'sm';
    const height = isSm ? 'var(--control-height-sm)' : 'var(--control-height)';
    const padding = isSm ? '0 10px' : '0 14px';
    const fontSize = isSm ? 'var(--text-label)' : 'var(--text-body)';

    const getVariantStyles = () => {
      switch (variant) {
        case 'primary':
          return {
            backgroundColor: 'var(--accent)',
            color: '#FFFFFF',
            border: '1px solid var(--accent)',
          };
        case 'secondary':
          return {
            backgroundColor: 'var(--bg-raised)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
          };
        case 'ghost':
          return {
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
          };
        case 'danger':
          return {
            backgroundColor: 'transparent',
            color: 'var(--status-danger)',
            border: '1px solid rgba(242, 85, 90, 0.3)',
          };
      }
    };

    const variantStyles = getVariantStyles();

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          height,
          padding,
          fontSize,
          fontWeight: 500,
          borderRadius: 'var(--radius-control)',
          cursor: disabled || loading ? 'not-allowed' : 'pointer',
          opacity: disabled || loading ? 0.45 : 1,
          outline: 'none',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          ...variantStyles,
          ...style,
        }}
        onMouseEnter={(e) => {
          if (!disabled && !loading) {
            if (variant === 'primary') {
              e.currentTarget.style.backgroundColor = 'var(--accent-hover)';
            } else if (variant === 'secondary' || variant === 'ghost') {
              e.currentTarget.style.backgroundColor = 'var(--bg-overlay)';
              e.currentTarget.style.color = 'var(--text-primary)';
            } else if (variant === 'danger') {
              e.currentTarget.style.backgroundColor = 'rgba(242, 85, 90, 0.12)';
            }
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && !loading) {
            const defaultStyles = getVariantStyles();
            e.currentTarget.style.backgroundColor = defaultStyles.backgroundColor;
            e.currentTarget.style.color = defaultStyles.color;
          }
        }}
        {...props}
      >
        {loading ? (
          <Loader2 size={isSm ? 13 : 15} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} />
        ) : (
          icon
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
