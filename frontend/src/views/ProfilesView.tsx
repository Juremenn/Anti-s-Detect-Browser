import { useMemo } from 'react';
import { BulkActionBar } from '../components/BulkActionBar';
import { Checkbox } from '../components/Checkbox';
import { EmptyState } from '../components/EmptyState';
import { StatusPill } from '../components/StatusPill';
import { Profile } from '../types';

interface ProfilesViewProps {
  profiles: Profile[];
  selectedProfiles: Set<string>;
  onToggleSelect: (name: string, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onDeselectAll: () => void;
  onStartProfile: (name: string) => void;
  onStopProfile: (name: string) => void;
  onOpenFolder: (name: string) => void;
  onTrashProfile: (name: string) => void;
  onBulkStart: () => void;
  onBulkStop: () => void;
  onBulkTrash: () => void;
  onOpenNewProfileModal: () => void;
  onQuickProfile: () => void;
  searchQuery: string;
  statusFilter: string;
}

export function ProfilesView({
  profiles,
  selectedProfiles,
  onToggleSelect,
  onToggleSelectAll,
  onDeselectAll,
  onStartProfile,
  onStopProfile,
  onOpenFolder,
  onTrashProfile,
  onBulkStart,
  onBulkStop,
  onBulkTrash,
  onOpenNewProfileModal,
  onQuickProfile,
  searchQuery,
  statusFilter,
}: ProfilesViewProps) {
  const filteredProfiles = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return profiles.filter((p) => {
      const matchQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.webgl_renderer || '').toLowerCase().includes(q) ||
        (p.tags || []).some((t) => t.toLowerCase().includes(q));

      const matchStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
          ? p.is_active
          : !p.is_active;

      return matchQuery && matchStatus;
    });
  }, [profiles, searchQuery, statusFilter]);

  const allSelected =
    filteredProfiles.length > 0 &&
    filteredProfiles.every((p) => selectedProfiles.has(p.name));
  const someSelected =
    filteredProfiles.some((p) => selectedProfiles.has(p.name)) && !allSelected;

  return (
    <section style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
      <BulkActionBar
        selectedCount={selectedProfiles.size}
        onStartSelected={onBulkStart}
        onStopSelected={onBulkStop}
        onTrashSelected={onBulkTrash}
        onDeselectAll={onDeselectAll}
      />

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
              <th style={{ width: 44, textAlign: 'center', backgroundColor: '#121522', padding: '10px 8px', borderBottom: '1px solid var(--border)' }}>
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  disabled={filteredProfiles.length === 0}
                  ariaLabel="Pilih Semua Profil"
                  onChange={onToggleSelectAll}
                />
              </th>
              <th style={{ width: 220, backgroundColor: '#121522', color: 'var(--text-dim)', fontWeight: 600, padding: '10px 14px', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>
                Profile Name
              </th>
              <th style={{ width: 130, backgroundColor: '#121522', color: 'var(--text-dim)', fontWeight: 600, padding: '10px 14px', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>
                Status
              </th>
              <th style={{ width: 150, backgroundColor: '#121522', color: 'var(--text-dim)', fontWeight: 600, padding: '10px 14px', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>
                Tags
              </th>
              <th style={{ width: 160, backgroundColor: '#121522', color: 'var(--text-dim)', fontWeight: 600, padding: '10px 14px', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>
                Proxy
              </th>
              <th style={{ backgroundColor: '#121522', color: 'var(--text-dim)', fontWeight: 600, padding: '10px 14px', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>
                Fingerprint Specs
              </th>
              <th style={{ width: 160, textAlign: 'right', backgroundColor: '#121522', color: 'var(--text-dim)', fontWeight: 600, padding: '10px 14px', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredProfiles.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 0 }}>
                  <EmptyState
                    title={profiles.length === 0 ? 'Belum Ada Profil Anti-Detect' : 'Tidak Ada Profil yang Cocok'}
                    description={
                      profiles.length === 0
                        ? 'Belum ada profil browser yang tersimpan. Klik tombol di bawah untuk membuat profil pertama Anda.'
                        : 'Tidak ada profil yang cocok dengan kriteria pencarian atau filter yang dipilih.'
                    }
                    actions={
                      profiles.length === 0 ? (
                        <>
                          <button className="btn btn-primary" onClick={onOpenNewProfileModal}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                            </svg>
                            New Profile
                          </button>
                          <button className="btn btn-secondary" onClick={onQuickProfile}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M7 2v11h3v9l7-12h-4l4-8z" />
                            </svg>
                            Quick Profile
                          </button>
                        </>
                      ) : undefined
                    }
                  />
                </td>
              </tr>
            ) : (
              filteredProfiles.map((p) => {
                const isSelected = selectedProfiles.has(p.name);
                const isMac = (p.platform || '').toLowerCase().includes('mac');

                return (
                  <tr
                    key={p.name}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      backgroundColor: isSelected ? 'rgba(47, 84, 235, 0.08)' : 'transparent',
                      transition: 'background-color 0.12s ease',
                    }}
                  >
                    <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                      <Checkbox
                        checked={isSelected}
                        ariaLabel={`Pilih profil ${p.name}`}
                        onChange={(checked) => onToggleSelect(p.name, checked)}
                      />
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#ffffff' }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                        Seed: {p.canvas_seed || '-'}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <StatusPill isActive={p.is_active} pid={p.pid} />
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {p.tags && p.tags.length > 0 ? (
                        <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', maxWidth: 180 }}>
                          {p.tags.map((t) => (
                            <span
                              key={t}
                              style={{
                                display: 'inline-block',
                                whiteSpace: 'nowrap',
                                backgroundColor: '#1a2238',
                                color: '#93c5fd',
                                border: '1px solid rgba(147, 197, 253, 0.18)',
                                padding: '2px 7px',
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 500,
                                lineHeight: 1.3,
                              }}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-dim)' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', color: p.proxy ? 'var(--text-main)' : 'var(--text-dim)' }}>
                      {p.proxy || 'Direct'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {isMac ? (
                          <svg viewBox="0 0 170 170" width="20" height="20" fill="#94a3b8" style={{ flexShrink: 0 }}>
                            <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.08-7.77-7.92-12.23-14.51-6.19-9.17-11.05-19.65-14.59-31.44-3.53-11.8-5.3-23.01-5.3-33.64 0-14.04 3.65-25.75 10.95-35.15 7.3-9.4 16.51-14.18 27.63-14.35 5.18 0 10.77 1.43 16.76 4.31 5.99 2.87 9.87 4.38 11.64 4.54 1.54 0 5.49-1.57 11.86-4.71 6.37-3.14 11.97-4.47 16.8-4.01 12.82.78 22.95 5.75 30.38 14.93-11.19 6.78-16.65 16.14-16.37 28.09.28 9.58 3.99 17.58 11.13 24 7.14 6.42 15.69 10.05 25.64 10.88-2.13 6.64-4.87 13.52-8.21 20.65zM119.22 31.81c0-7.35 2.65-14.4 7.95-21.14 5.3-6.75 11.97-10.67 20.02-11.77.14 1.13.21 2.14.21 3.03 0 7.34-2.78 14.36-8.34 21.05-5.56 6.7-12.27 10.46-20.13 11.27-.22-.81-.33-1.63-.33-2.44z" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 88 88" width="20" height="20" fill="#38bdf8" style={{ flexShrink: 0 }}>
                            <path d="M0 12.4L35.7 7.5V42H0V12.4zM0 45.6H35.7V80.1L0 75.3V45.6zM39.4 7V42H87.3V0L39.4 7zM39.4 45.6H87.3V87.6L39.4 80.6V45.6z" />
                          </svg>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div style={{ fontWeight: 500, color: '#e2e8f0', fontSize: 12 }}>
                            {p.webgl_renderer || 'GPU'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                            {p.hardware_concurrency || 8} Cores | {p.device_memory || 8} GB | {p.screen_width || 1920}x{p.screen_height || 1080}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', padding: '12px 14px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {p.is_active ? (
                          <button
                            className="btn btn-danger"
                            style={{ padding: '4px 10px', fontSize: 11.5 }}
                            onClick={() => onStopProfile(p.name)}
                          >
                            Stop
                          </button>
                        ) : (
                          <button
                            className="btn"
                            style={{
                              backgroundColor: 'var(--success)',
                              color: '#ffffff',
                              padding: '4px 10px',
                              fontSize: 11.5,
                            }}
                            onClick={() => onStartProfile(p.name)}
                          >
                            Start
                          </button>
                        )}
                        <button
                          className="btn-icon"
                          title="Buka Folder Data"
                          onClick={() => onOpenFolder(p.name)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                          </svg>
                        </button>
                        <button
                          className="btn-icon danger"
                          title="Pindahkan ke Tempat Sampah"
                          onClick={() => onTrashProfile(p.name)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                          </svg>
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
  );
}
