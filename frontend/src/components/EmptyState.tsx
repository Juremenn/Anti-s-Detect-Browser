import { ReactNode } from 'react';
import { Layers } from 'lucide-react';

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
        padding: '64px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
      }}
    >
      <div style={{ marginBottom: 12, color: 'var(--text-tertiary)' }}>
        {icon ? icon : <Layers size={36} strokeWidth={1.2} />}
      </div>
      <div
        style={{
          fontSize: 13.5,
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 4,
          letterSpacing: -0.1,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          maxWidth: 360,
          lineHeight: 1.5,
          marginBottom: actions ? 16 : 0,
        }}
      >
        {description}
      </div>
      {actions && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {actions}
        </div>
      )}
    </div>
  );
}
