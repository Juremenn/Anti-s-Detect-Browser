import { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  actions?: ReactNode;
}

export function EmptyState({
  title,
  description,
  icon,
  actions,
}: EmptyStateProps) {
  return (
    <div
      style={{
        padding: '48px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {icon ? (
        <div style={{ marginBottom: 14, color: 'var(--text-dim)' }}>{icon}</div>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          style={{ width: 46, height: 46, marginBottom: 14, color: 'var(--text-dim)' }}
        >
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <circle cx="6" cy="6.5" r="1" fill="currentColor" />
          <circle cx="9" cy="6.5" r="1" fill="currentColor" />
        </svg>
      )}
      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: '#ffffff',
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: 'var(--text-muted)',
          maxWidth: 440,
          lineHeight: 1.5,
          marginBottom: actions ? 20 : 0,
        }}
      >
        {description}
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {actions}
        </div>
      )}
    </div>
  );
}
