import { Play, Square, Trash2, X } from 'lucide-react';
import { t } from '../i18n';

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
        padding: '0 16px',
        height: 40,
        backgroundColor: 'var(--bg-raised)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-control)',
        marginBottom: 8,
        animation: 'fadeIn 120ms ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          {t.bulk.selectedCount(selectedCount)}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button className="btn btn-ghost" onClick={onStartSelected}>
          <Play size={12} strokeWidth={1.5} color="var(--status-running)" />
          <span>{t.bulk.start}</span>
        </button>
        <button className="btn btn-ghost" onClick={onStopSelected}>
          <Square size={12} strokeWidth={1.5} color="var(--status-error)" />
          <span>{t.bulk.stop}</span>
        </button>
        <button className="btn btn-danger" onClick={onTrashSelected}>
          <Trash2 size={12} strokeWidth={1.5} />
          <span>{t.bulk.moveToTrash}</span>
        </button>
        <button className="btn btn-ghost" onClick={onDeselectAll}>
          <X size={12} strokeWidth={1.5} />
          <span>{t.bulk.clear}</span>
        </button>
      </div>
    </div>
  );
}
