import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, style, ...props }, ref) => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
        <textarea
          ref={ref}
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: `1px solid ${error ? 'var(--status-danger)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-control)',
            padding: '8px 10px',
            fontSize: 'var(--text-body)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
            outline: 'none',
            resize: 'vertical',
            minHeight: 64,
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
        />
        {error && (
          <span style={{ fontSize: 'var(--text-caption)', color: 'var(--status-danger)' }}>
            {error}
          </span>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

