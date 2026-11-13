import { EmptyState } from '../components/EmptyState';
import { TrashItem } from '../types';

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
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <header
        style={{
          height: 60,
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          flexShrink: 0,
        }}
      >
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#ffffff' }}>Trash Bin</h2>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            {items.length} profil di tempat sampah
          </span>
        </div>
        <button
          className="btn btn-danger"
          disabled={items.length === 0}
          onClick={() => {
            if (confirm('Kosongkan semua item di Trash Bin secara permanen?')) {
              onPurgeAll();
            }
          }}
        >
          Empty Trash Bin
        </button>
      </header>

      <section style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={{ width: 260, backgroundColor: '#121522', color: 'var(--text-dim)', fontWeight: 600, padding: '10px 14px', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>
                  Profile Name
                </th>
                <th style={{ backgroundColor: '#121522', color: 'var(--text-dim)', fontWeight: 600, padding: '10px 14px', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>
                  Hardware Specification
                </th>
                <th style={{ width: 180, backgroundColor: '#121522', color: 'var(--text-dim)', fontWeight: 600, padding: '10px 14px', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>
                  Date Trashed
                </th>
                <th style={{ width: 220, textAlign: 'right', backgroundColor: '#121522', color: 'var(--text-dim)', fontWeight: 600, padding: '10px 14px', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 0 }}>
                    <EmptyState
                      title="Trash Bin Kosong"
                      description="Tidak ada profil yang dihapus sementara. Profil yang Anda hapus dari menu utama akan tersimpan aman di sini."
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
                      ).toLocaleString('id-ID')
                    : '-';

                  return (
                    <tr
                      key={item.trash_id}
                      style={{ borderBottom: '1px solid var(--border)' }}
                    >
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#ffffff' }}>
                          {item.name}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                        {item.webgl_renderer || 'Default GPU'}
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-dim)', fontSize: 11.5 }}>
                        {dateStr}
                      </td>
                      <td style={{ textAlign: 'right', padding: '12px 14px' }}>
                        <div style={{ display: 'inline-flex', gap: 8 }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: 11.5 }}
                            onClick={() => onRestore(item.trash_id)}
                          >
                            Restore
                          </button>
                          <button
                            className="btn btn-danger"
                            style={{ padding: '4px 10px', fontSize: 11.5 }}
                            onClick={() => {
                              if (confirm(`Hapus permanen '${item.name}'?`)) {
                                onPurge(item.trash_id);
                              }
                            }}
                          >
                            Delete Permanently
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
      </section>
    </div>
  );
}
