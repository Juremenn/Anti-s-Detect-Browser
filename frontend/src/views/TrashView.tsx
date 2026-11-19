import { RotateCcw, Trash2 } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { t } from '../i18n';
import { TrashItem } from '../types';
import { parseGpuName } from '../utils/formatters';

interface TrashViewProps {
  items: TrashItem[];
  onRestore: (trashId: string) => void;
  onPurge: (trashId: string) => void;
  onPurgeAll: () => void;
}

export function TrashView({
  items,
  onRestore,
  onPurge,
  onPurgeAll,
}: TrashViewProps) {
  const { confirm } = useConfirm();
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top Header */}
      <header
        style={{
          height: 48,
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: -0.2 }}>
            {t.trash.title}
          </h2>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--text-tertiary)',
              backgroundColor: 'var(--bg-raised)',
              padding: '1px 6px',
              borderRadius: 4,
              fontFamily: 'var(--font-sans)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {items.length}
          </span>
        </div>
        <button
          className="btn btn-danger"
          disabled={items.length === 0}
          onClick={async () => {
            const ok = await confirm({
              title: t.trash.emptyTrash,
              description: t.trash.confirmPurgeAll,
              confirmLabel: t.trash.emptyTrash,
              cancelLabel: 'Cancel',
              variant: 'danger',
            });
            if (ok) {
              onPurgeAll();
            }
          }}
        >
          <Trash2 size={13} strokeWidth={1.5} />
          <span>{t.trash.emptyTrash}</span>
        </button>
      </header>

      {/* Table Section */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontSize: 12.5,
          }}
        >
          <thead>
            <tr
              style={{
                height: 36,
                backgroundColor: 'var(--bg-surface)',
                borderBottom: '1px solid var(--border)',
                color: 'var(--text-tertiary)',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 0.3,
                userSelect: 'none',
              }}
            >
              <th style={{ minWidth: 200, padding: '0 16px' }}>{t.trash.colOriginalName}</th>
              <th style={{ minWidth: 240, padding: '0 12px' }}>{t.table.fingerprint}</th>
              <th style={{ width: 180, padding: '0 12px' }}>{t.trash.colDeletedAt}</th>
              <th style={{ width: 180, textAlign: 'right', padding: '0 16px' }}>
                {t.trash.colActions}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 0 }}>
                  <EmptyState
                    title={t.empty.trashEmptyTitle}
                    description={t.empty.trashEmptyDesc}
                  />
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const dateStr = item.trashed_at
                  ? new Date(
                      typeof item.trashed_at === 'number'
                        ? item.trashed_at * 1000
                        : parseInt(item.trashed_at, 10) * 1000
                    ).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '-';

                const gpuName = parseGpuName(item.webgl_renderer);

                return (
                  <tr
                    key={item.trash_id}
                    style={{
                      height: 44,
                      borderBottom: '1px solid var(--border)',
                      transition: 'background-color 120ms ease-out',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-hover-row)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <td style={{ padding: '0 16px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-primary)' }}>
                        {item.name}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-tertiary)',
                        }}
                      >
                        ID: {item.trash_id.substring(0, 16)}...
                      </div>
                    </td>
                    <td
                      style={{
                        padding: '0 12px',
                        whiteSpace: 'nowrap',
                        color: 'var(--text-secondary)',
                      }}
                      title={item.webgl_renderer || ''}
                    >
                      {gpuName}
                    </td>
                    <td
                      style={{
                        padding: '0 12px',
                        whiteSpace: 'nowrap',
                        color: 'var(--text-tertiary)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {dateStr}
                    </td>
                    <td style={{ textAlign: 'right', padding: '0 16px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <button
                          className="btn btn-ghost"
                          style={{ height: 28, padding: '0 8px' }}
                          title={t.trash.restore}
                          onClick={() => onRestore(item.trash_id)}
                        >
                          <RotateCcw size={13} strokeWidth={1.5} color="var(--accent)" />
                          <span>{t.trash.restore}</span>
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ height: 28, padding: '0 8px' }}
                          title={t.trash.purge}
                          onClick={async () => {
                            const ok = await confirm({
                              title: t.trash.purge,
                              description: t.trash.confirmPurgeItem(item.name),
                              confirmLabel: t.trash.purge,
                              cancelLabel: 'Cancel',
                              variant: 'danger',
                            });
                            if (ok) {
                              onPurge(item.trash_id);
                            }
                          }}
                        >
                          <Trash2 size={13} strokeWidth={1.5} />
                          <span>{t.trash.purge}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
