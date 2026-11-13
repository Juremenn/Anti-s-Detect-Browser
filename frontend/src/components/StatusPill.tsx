interface StatusPillProps {
  isActive?: boolean;
  pid?: number | null;
}

export function StatusPill({ isActive = false, pid }: StatusPillProps) {
  if (isActive) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 8px',
          borderRadius: 12,
          fontSize: 11,
          fontWeight: 600,
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          color: '#34d399',
          border: '1px solid rgba(16, 185, 129, 0.3)',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: '#10b981',
          }}
        />
        Aktif {pid ? `(PID ${pid})` : ''}
      </span>
    );
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 8px',
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        backgroundColor: 'rgba(148, 163, 184, 0.08)',
        color: '#94a3b8',
        border: '1px solid rgba(148, 163, 184, 0.18)',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: '#94a3b8',
        }}
      />
      Siap
    </span>
  );
}
