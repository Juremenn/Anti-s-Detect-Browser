import React from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  sizeVariant?: 'sm' | 'md';
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, sizeVariant = 'md', children, style, ...props }, ref) => {
    const isSm = sizeVariant === 'sm';
    const height = isSm ? 'var(--control-height-sm)' : 'var(--control-height)';
    const fontSize = isSm ? 'var(--text-label)' : 'var(--text-body)';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
        <select
          ref={ref}
          style={{
            height,
            backgroundColor: 'var(--bg-surface)',
            border: `1px solid ${error ? 'var(--status-danger)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-control)',
            padding: '0 10px',
            fontSize,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
            outline: 'none',
            cursor: 'pointer',
            width: '100%',
            ...style,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = error ? 'var(--status-danger)' : 'var(--accent)';
            e.currentTarget.style.boxShadow = `0 0 0 2px ${
              error ? 'rgba(242, 85, 90, 0.25)' : 'var(--accent-ring)'
            }`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error ? 'var(--status-danger)' : 'var(--border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          {...props}
        >
          {children}
        </select>
        {error && (
          <span style={{ fontSize: 'var(--text-caption)', color: 'var(--status-danger)' }}>
            {error}
          </span>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
