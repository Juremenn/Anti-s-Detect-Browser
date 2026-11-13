interface BulkActionBarProps {
  selectedCount: number;
  onStartSelected: () => void;
  onStopSelected: () => void;
  onTrashSelected: () => void;
  onDeselectAll: () => void;
}

export function BulkActionBar({
  selectedCount,
  onStartSelected,
  onStopSelected,
  onTrashSelected,
  onDeselectAll,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        backgroundColor: '#131726',
        border: '1px solid rgba(47, 84, 235, 0.35)',
        borderRadius: 6,
        marginBottom: 12,
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            backgroundColor: 'var(--primary)',
            color: '#ffffff',
            fontSize: 11,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 10,
          }}
        >
          {selectedCount}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#ffffff' }}>
          profil dipilih
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          className="btn btn-secondary"
          style={{ padding: '5px 12px', fontSize: 12 }}
          onClick={onStartSelected}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ marginRight: 4 }}
          >
            <path d="M8 5v14l11-7z" />
          </svg>
          Start Selected
        </button>
        <button
          className="btn btn-secondary"
          style={{ padding: '5px 12px', fontSize: 12 }}
          onClick={onStopSelected}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ marginRight: 4 }}
          >
            <path d="M6 6h12v12H6z" />
          </svg>
          Stop Selected
        </button>
        <button
          className="btn btn-danger"
          style={{ padding: '5px 12px', fontSize: 12 }}
          onClick={onTrashSelected}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ marginRight: 4 }}
          >
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
          </svg>
          Move to Trash
        </button>
        <button
          className="btn btn-secondary"
          style={{ padding: '5px 10px', fontSize: 12 }}
          title="Deselect All"
          onClick={onDeselectAll}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
