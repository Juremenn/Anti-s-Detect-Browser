import { useState } from 'react';
import { Globe, Plus, Trash2 } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { t } from '../i18n';
import { AddProxyModal } from '../modals/AddProxyModal';
import { ProxyItem } from '../types';
import { formatProxy } from '../utils/formatters';

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
  const { confirm } = useConfirm();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
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
            {t.proxies.title}
          </h2>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--text-tertiary)',
              backgroundColor: 'var(--bg-raised)',
              padding: '1px 6px',
              borderRadius: 4,
              fontFamily: 'var(--font-mono)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {proxies.length}
          </span>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          <Plus size={14} strokeWidth={2} />
          <span>{t.proxies.addProxy}</span>
        </button>
      </header>

      {/* Table */}
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
              <th style={{ minWidth: 180, padding: '0 16px' }}>{t.proxies.colTitle}</th>
              <th style={{ minWidth: 260, padding: '0 12px' }}>{t.proxies.colUrl}</th>
              <th style={{ width: 140, padding: '0 12px' }}>{t.proxies.colType}</th>
              <th style={{ width: 100, textAlign: 'right', padding: '0 16px' }}>
                {t.proxies.colActions}
              </th>
            </tr>
          </thead>
          <tbody>
            {proxies.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 0 }}>
                  <EmptyState
                    title={t.empty.proxiesEmptyTitle}
                    description={t.empty.proxiesEmptyDesc}
                    actions={
                      <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
                        <Plus size={14} strokeWidth={2} />
                        <span>{t.proxies.addProxy}</span>
                      </button>
                    }
                  />
                </td>
              </tr>
            ) : (
              proxies.map((p) => {
                const proxyInfo = formatProxy(p.url);

                return (
                  <tr
                    key={p.id}
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
                        {p.title || proxyInfo.hostPort}
                      </div>
                    </td>
                    <td style={{ padding: '0 12px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Globe size={13} strokeWidth={1.5} color="var(--text-secondary)" />
                        <span className="mono-tech">{proxyInfo.hostPort}</span>
                      </div>
                    </td>
                    <td style={{ padding: '0 12px', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--text-tertiary)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {proxyInfo.protocol}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', padding: '0 16px', whiteSpace: 'nowrap' }}>
                      <button
                        className="btn-icon danger"
                        title={t.proxies.delete}
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'Delete Proxy',
                            description: `Are you sure you want to delete proxy "${p.title || p.url}"?`,
                            confirmLabel: 'Delete Proxy',
                            cancelLabel: 'Cancel',
                            variant: 'danger',
                          });
                          if (ok) {
                            onDeleteProxy(p.id);
                          }
                        }}
                      >
                        <Trash2 size={13} strokeWidth={1.5} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <AddProxyModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={onAddProxy}
      />
    </div>
  );
}
