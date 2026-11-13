import { t } from '../i18n';

interface StatusPillProps {
  isActive?: boolean;
  isStarting?: boolean;
  pid?: number | null;
}

export function StatusPill({ isActive = false, isStarting = false, pid }: StatusPillProps) {
  if (isStarting) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--text-secondary)',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: 'var(--accent)',
            animation: 'pulse 1s infinite alternate',
          }}
        />
        {t.status.starting}
      </span>
    );
  }

  if (isActive) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--text-primary)',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: 'var(--status-running)',
            flexShrink: 0,
          }}
        />
        <span>{t.status.running}</span>
        {pid ? (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-tertiary)',
            }}
          >
            ({pid})
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--text-tertiary)',
        userSelect: 'none',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: 'var(--status-idle)',
          flexShrink: 0,
        }}
      />
      {t.status.idle}
    </span>
  );
}
