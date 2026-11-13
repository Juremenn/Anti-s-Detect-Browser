import { Puzzle } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { t } from '../i18n';

export function ExtensionsView() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
          <h2 style={{ fontSize: 'var(--text-section)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: -0.2 }}>
            {t.nav.extensions}
          </h2>
          <span
            style={{
              fontSize: 'var(--text-caption)',
              fontWeight: 500,
              color: 'var(--text-tertiary)',
              backgroundColor: 'var(--bg-raised)',
              padding: '1px 6px',
              borderRadius: 4,
              fontFamily: 'var(--font-mono)',
            }}
          >
            0
          </span>
        </div>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <EmptyState
          icon={<Puzzle size={36} strokeWidth={1.2} />}
          title="No Extensions Installed"
          description="Manage unpacked extensions or .crx files to inject into your browser profiles."
        />
      </div>
    </div>
  );
}

