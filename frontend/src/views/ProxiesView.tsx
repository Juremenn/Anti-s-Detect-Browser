import { useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import { AddProxyModal } from '../modals/AddProxyModal';
import { ProxyItem } from '../types';

interface ProxiesViewProps {
  proxies: ProxyItem[];
  onAddProxy: (title: string, url: string) => Promise<void>;
  onDeleteProxy: (id: string) => void;
}

export function ProxiesView({
  proxies,
  onAddProxy,
  onDeleteProxy,
}: ProxiesViewProps) {
  const [modalOpen, setModalOpen] = useState(false);

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
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#ffffff' }}>Proxy Manager</h2>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          Add Proxy
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
                <th style={{ width: 220, backgroundColor: '#121522', color: 'var(--text-dim)', fontWeight: 600, padding: '10px 14px', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>
                  Label
                </th>
                <th style={{ backgroundColor: '#121522', color: 'var(--text-dim)', fontWeight: 600, padding: '10px 14px', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>
                  Proxy Address
                </th>
                <th style={{ width: 160, backgroundColor: '#121522', color: 'var(--text-dim)', fontWeight: 600, padding: '10px 14px', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>
                  Date Added
                </th>
                <th style={{ width: 100, textAlign: 'right', backgroundColor: '#121522', color: 'var(--text-dim)', fontWeight: 600, padding: '10px 14px', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {proxies.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 0 }}>
                    <EmptyState
                      title="Belum Ada Proxy Tersimpan"
                      description="Tambahkan konfigurasi proxy HTTP atau SOCKS5 untuk digunakan pada profil browser Anda."
                      actions={
                        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                          </svg>
                          Add Proxy
                        </button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                proxies.map((p) => {
                  const dateStr = p.added_at
                    ? new Date(p.added_at * 1000).toLocaleDateString('id-ID')
                    : '-';

                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#ffffff' }}>
                          {p.title}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontFamily: 'monospace', color: '#38bdf8', fontSize: 12 }}>
                          {p.url}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-dim)', fontSize: 11.5 }}>
                        {dateStr}
                      </td>
                      <td style={{ textAlign: 'right', padding: '12px 14px' }}>
                        <button
                          className="btn-icon danger"
                          title="Hapus Proxy"
                          onClick={() => {
                            if (confirm(`Hapus proxy '${p.title}'?`)) {
                              onDeleteProxy(p.id);
                            }
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <AddProxyModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={onAddProxy}
      />
    </div>
  );
}
