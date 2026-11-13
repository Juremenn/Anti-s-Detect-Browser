export type StatusDotVariant = 'running' | 'idle' | 'error' | 'warning' | 'launching';

export interface StatusDotProps {
  status: StatusDotVariant;
  label?: string;
  subLabel?: string;
}

export function StatusDot({ status, label, subLabel }: StatusDotProps) {
  const getColor = () => {
    switch (status) {
      case 'running':
        return 'var(--status-success)';
      case 'error':
        return 'var(--status-danger)';
      case 'warning':
        return 'var(--status-warning)';
      case 'launching':
        return 'var(--accent)';
      case 'idle':
      default:
        return 'var(--text-tertiary)';
    }
  };

  const isLaunching = status === 'launching';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 'var(--text-label)',
        fontWeight: 500,
        color: status === 'idle' ? 'var(--text-tertiary)' : 'var(--text-primary)',
        userSelect: 'none',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: getColor(),
          flexShrink: 0,
          animation: isLaunching ? 'pulse 1s infinite alternate' : 'none',
        }}
      />
      {label && <span>{label}</span>}
      {subLabel && (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-caption)',
            color: 'var(--text-tertiary)',
          }}
        >
          {subLabel}
        </span>
      )}
    </span>
  );
}

