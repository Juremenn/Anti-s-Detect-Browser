import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  Edit2,
  FlaskConical,
  Folder,
  Globe,
  Monitor,
  MoreHorizontal,
  Play,
  RefreshCw,
  Square,
  Trash2,
} from 'lucide-react';
import { Checkbox } from '../components/Checkbox';
import { EmptyState } from '../components/EmptyState';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { ContextMenu } from '../components/ui/ContextMenu';
import { DropdownMenu, MenuItem } from '../components/ui/DropdownMenu';
import { IconButton } from '../components/ui/IconButton';
import { StatusDot } from '../components/ui/StatusDot';
import { t } from '../i18n';
import { Profile, SortDirection, SortField } from '../types';
import {
  formatFingerprintSpec,
  formatProxy,
  formatRelativeTime,
} from '../utils/formatters';

interface ProfilesViewProps {
  profiles: Profile[];
  selectedProfiles: Set<string>;
  onToggleSelect: (name: string, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onDeselectAll: () => void;
  onStartProfile: (name: string) => Promise<void> | void;
  onStopProfile: (name: string) => Promise<void> | void;
  onEditProfile?: (name: string) => void;
  onOpenFolder: (name: string) => void;
  onTrashProfile: (name: string) => void;
  onDuplicateProfile?: (name: string) => void;
  onTestProfile?: (name: string) => void;
  onRegenerateIdentity?: (name: string) => void;
  onExportProfile?: (name: string) => void;
  onOpenNewProfileModal: () => void;
  searchQuery: string;
  statusFilter: string;
  tagFilter?: string;
}

export function ProfilesView({
  profiles,
  selectedProfiles,
  onToggleSelect,
  onToggleSelectAll,
  onStartProfile,
  onStopProfile,
  onEditProfile,
  onOpenFolder,
  onTrashProfile,
  onDuplicateProfile,
  onTestProfile,
  onRegenerateIdentity,
  onExportProfile,
  onOpenNewProfileModal,
  searchQuery,
  statusFilter,
  tagFilter = 'all',
}: ProfilesViewProps) {
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [startingProfiles, setStartingProfiles] = useState<Set<string>>(new Set());
  const [contextMenuState, setContextMenuState] = useState<{
    x: number;
    y: number;
    profile: Profile;
  } | null>(null);

  // Confirm Dialog state
  const [confirmDeleteProfile, setConfirmDeleteProfile] = useState<string | null>(null);
  const [confirmRegenerateProfile, setConfirmRegenerateProfile] = useState<string | null>(null);

  // Saved sorting in localStorage
  const [sortField, setSortField] = useState<SortField>(() => {
    return (localStorage.getItem('octo_sort_field') as SortField) || 'name';
  });
  const [sortDir, setSortDir] = useState<SortDirection>(() => {
    return (localStorage.getItem('octo_sort_dir') as SortDirection) || 'asc';
  });

  useEffect(() => {
    localStorage.setItem('octo_sort_field', sortField);
    localStorage.setItem('octo_sort_dir', sortDir);
  }, [sortField, sortDir]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  // Filter & Sort
  const processedProfiles = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const filtered = profiles.filter((p) => {
      const matchQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.webgl_renderer || '').toLowerCase().includes(q) ||
        (p.tags || []).some((tag) => tag.toLowerCase().includes(q)) ||
        (p.proxy || '').toLowerCase().includes(q);

      const matchStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
          ? p.is_active
          : !p.is_active;

      const matchTag =
        tagFilter === 'all' || !tagFilter
          ? true
          : (p.tags || []).includes(tagFilter);

      return matchQuery && matchStatus && matchTag;
    });

    return filtered.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === 'status') {
        cmp = (a.is_active ? 1 : 0) - (b.is_active ? 1 : 0);
      } else if (sortField === 'last_used') {
        const tA = Number(a.last_used_at || 0);
        const tB = Number(b.last_used_at || 0);
        cmp = tA - tB;
      } else if (sortField === 'proxy') {
        cmp = (a.proxy || '').localeCompare(b.proxy || '');
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [profiles, searchQuery, statusFilter, tagFilter, sortField, sortDir]);

  const allSelected =
    processedProfiles.length > 0 &&
    processedProfiles.every((p) => selectedProfiles.has(p.name));
  const someSelected =
    processedProfiles.some((p) => selectedProfiles.has(p.name)) && !allSelected;

  async function handleStartWithProgress(name: string) {
    setStartingProfiles((prev) => new Set(prev).add(name));
    try {
      await onStartProfile(name);
    } finally {
      setStartingProfiles((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
    }
  }

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      ) {
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev < processedProfiles.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : processedProfiles.length - 1));
      } else if (e.key === 'Enter') {
        if (focusedIndex >= 0 && focusedIndex < processedProfiles.length) {
          e.preventDefault();
          const p = processedProfiles[focusedIndex];
          if (e.shiftKey) {
            onStopProfile(p.name);
          } else {
            if (p.is_active) onStopProfile(p.name);
            else handleStartWithProgress(p.name);
          }
        }
      } else if (e.key.toLowerCase() === 'e' && !e.ctrlKey && !e.metaKey) {
        if (focusedIndex >= 0 && focusedIndex < processedProfiles.length && onEditProfile) {
          e.preventDefault();
          onEditProfile(processedProfiles[focusedIndex].name);
        }
      } else if (e.key === 'Delete') {
        if (focusedIndex >= 0 && focusedIndex < processedProfiles.length) {
          e.preventDefault();
          setConfirmDeleteProfile(processedProfiles[focusedIndex].name);
        }
      } else if (e.key === ' ') {
        if (focusedIndex >= 0 && focusedIndex < processedProfiles.length) {
          e.preventDefault();
          const p = processedProfiles[focusedIndex];
          onToggleSelect(p.name, !selectedProfiles.has(p.name));
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, processedProfiles, selectedProfiles, onToggleSelect, onStopProfile, onEditProfile]);

  function getRowMenuItems(p: Profile): MenuItem[] {
    return [
      {
        label: t.actions.edit,
        icon: <Edit2 size={13} strokeWidth={1.5} />,
        onClick: () => onEditProfile?.(p.name),
      },
      {
        label: t.actions.duplicate,
        icon: <Copy size={13} strokeWidth={1.5} />,
        onClick: () => onDuplicateProfile?.(p.name),
      },
      {
        label: t.actions.openFolder,
        icon: <Folder size={13} strokeWidth={1.5} />,
        onClick: () => onOpenFolder(p.name),
      },
      {
        label: t.actions.testFingerprint,
        icon: <FlaskConical size={13} strokeWidth={1.5} />,
        onClick: () => {
          if (onTestProfile) onTestProfile(p.name);
          else handleStartWithProgress(p.name);
        },
      },
      {
        label: t.actions.regenerateIdentity,
        icon: <RefreshCw size={13} strokeWidth={1.5} />,
        onClick: () => setConfirmRegenerateProfile(p.name),
      },
      {
        label: t.actions.export,
        icon: <Download size={13} strokeWidth={1.5} />,
        onClick: () => onExportProfile?.(p.name),
      },
      { separator: true, label: '' },
      {
        label: t.actions.moveToTrash,
        danger: true,
        icon: <Trash2 size={13} strokeWidth={1.5} />,
        onClick: () => setConfirmDeleteProfile(p.name),
      },
    ];
  }

  return (
    <section
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-base)',
      }}
    >
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontSize: 'var(--text-body)',
          }}
        >
          <thead>
            <tr
              style={{
                height: 36,
                backgroundColor: 'var(--bg-surface)',
                borderBottom: '1px solid var(--border)',
                color: 'var(--text-tertiary)',
                fontSize: 'var(--text-caption)',
                fontWeight: 600,
                letterSpacing: 0.3,
                userSelect: 'none',
              }}
            >
              <th style={{ width: 40, textAlign: 'center', padding: '0 8px' }}>
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  disabled={processedProfiles.length === 0}
                  ariaLabel={t.table.selectAll}
                  onChange={onToggleSelectAll}
                />
              </th>
              <th
                onClick={() => handleSort('name')}
                style={{ minWidth: 180, padding: '0 12px', cursor: 'pointer' }}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span>{t.table.name}</span>
                  {sortField === 'name' &&
                    (sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                </div>
              </th>
              <th
                onClick={() => handleSort('status')}
                style={{ width: 110, padding: '0 12px', cursor: 'pointer' }}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span>{t.table.status}</span>
                  {sortField === 'status' &&
                    (sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                </div>
              </th>
              <th style={{ minWidth: 260, padding: '0 12px' }}>{t.table.fingerprint}</th>
              <th
                onClick={() => handleSort('proxy')}
                style={{ width: 160, padding: '0 12px', cursor: 'pointer' }}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span>{t.table.proxy}</span>
                  {sortField === 'proxy' &&
                    (sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                </div>
              </th>
              <th style={{ width: 140, padding: '0 12px' }}>{t.table.tags}</th>
              <th
                onClick={() => handleSort('last_used')}
                style={{ width: 110, padding: '0 12px', cursor: 'pointer' }}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span>{t.table.lastUsed}</span>
                  {sortField === 'last_used' &&
                    (sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                </div>
              </th>
              <th style={{ width: 100, textAlign: 'right', padding: '0 16px' }}>
                {t.table.actions}
              </th>
            </tr>
          </thead>
          <tbody>
            {processedProfiles.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 0 }}>
                  <EmptyState
                    title={
                      profiles.length === 0
                        ? t.empty.noProfilesTitle
                        : t.empty.noResultsTitle
                    }
                    description={
                      profiles.length === 0
                        ? t.empty.noProfilesDesc
                        : t.empty.noResultsDesc
                    }
                    actions={
                      profiles.length === 0 ? (
                        <Button variant="primary" size="md" onClick={onOpenNewProfileModal}>
                          {t.empty.createProfile}
                        </Button>
                      ) : undefined
                    }
                  />
                </td>
              </tr>
            ) : (
              processedProfiles.map((p, idx) => {
                const isSelected = selectedProfiles.has(p.name);
                const isFocused = idx === focusedIndex;
                const isLaunching = startingProfiles.has(p.name);
                const specSummary = formatFingerprintSpec(p);
                const proxyInfo = formatProxy(p.proxy);
                const relativeTime = formatRelativeTime(p.last_used_at);

                const visibleTags = (p.tags || []).filter(
                  (tag) => tag.toLowerCase() !== 'default'
                );

                return (
                  <tr
                    key={p.name}
                    tabIndex={0}
                    onFocus={() => setFocusedIndex(idx)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenuState({ x: e.clientX, y: e.clientY, profile: p });
                    }}
                    style={{
                      height: 'var(--row-height)',
                      borderBottom: '1px solid var(--border)',
                      backgroundColor: isSelected
                        ? 'var(--accent-subtle)'
                        : isFocused
                        ? 'var(--bg-row-hover)'
                        : 'transparent',
                      transition: 'background-color 120ms ease-out',
                      outline: 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected && !isFocused) {
                        e.currentTarget.style.backgroundColor = 'var(--bg-row-hover)';
                      }
                      const actionGroup = e.currentTarget.querySelector(
                        '.row-actions'
                      ) as HTMLElement;
                      if (actionGroup) actionGroup.style.opacity = '1';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected && !isFocused) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                      const actionGroup = e.currentTarget.querySelector(
                        '.row-actions'
                      ) as HTMLElement;
                      if (actionGroup) actionGroup.style.opacity = '0.6';
                    }}
                  >
                    {/* Checkbox */}
                    <td style={{ textAlign: 'center', padding: '0 8px' }}>
                      <Checkbox
                        checked={isSelected}
                        ariaLabel={t.table.selectRow(p.name)}
                        onChange={(checked) => onToggleSelect(p.name, checked)}
                      />
                    </td>

                    {/* Name + Seed */}
                    <td style={{ padding: '0 12px', whiteSpace: 'nowrap' }}>
                      <div
                        style={{
                          fontWeight: 500,
                          fontSize: 'var(--text-body)',
                          color: 'var(--text-primary)',
                          lineHeight: 1.2,
                        }}
                      >
                        {p.name}
                      </div>
                      <div
                        style={{
                          fontSize: 'var(--text-caption)',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-tertiary)',
                          lineHeight: 1.2,
                          marginTop: 2,
                        }}
                      >
                        {t.table.seed(p.canvas_seed || '-')}
                      </div>
                    </td>

                    {/* Status Dot + Text (inline progress on launching) */}
                    <td style={{ padding: '0 12px', whiteSpace: 'nowrap' }}>
                      {isLaunching ? (
                        <StatusDot status="launching" label={t.status.launching} />
                      ) : p.is_active ? (
                        <StatusDot
                          status="running"
                          label={t.status.running}
                          subLabel={p.pid ? `(${p.pid})` : undefined}
                        />
                      ) : (
                        <StatusDot status="idle" label={t.status.idle} />
                      )}
                    </td>

                    {/* Fingerprint Spec + Active Anti-Detect Shields */}
                    <td
                      style={{
                        padding: '0 12px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={p.webgl_renderer || 'Standard Profile'}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <Monitor size={14} strokeWidth={1.75} color="var(--accent)" />
                          <span
                            style={{
                              fontSize: 'var(--text-label)',
                              fontWeight: 500,
                              color: 'var(--text-primary)',
                            }}
                          >
                            {specSummary}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--text-tertiary)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <span style={{ color: 'var(--status-success)', fontWeight: 500 }}>
                            Anti-Detect:
                          </span>
                          <span>
                            {[
                              p.canvas_noise !== false && 'Canvas',
                              p.webgl_noise !== false && 'WebGL',
                              p.audio_noise !== false && 'Audio',
                              p.font_noise !== false && 'Fonts',
                              p.timezone_mode !== 'system' && 'IP-TZ',
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Proxy */}
                    <td style={{ padding: '0 12px', whiteSpace: 'nowrap' }}>
                      {proxyInfo.isDirect ? (
                        <span style={{ fontSize: 'var(--text-label)', color: 'var(--text-tertiary)' }}>
                          {t.table.directProxy}
                        </span>
                      ) : (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Globe size={13} strokeWidth={1.5} color="var(--text-secondary)" />
                          <span
                            className="mono-tech"
                            style={{ fontSize: 'var(--text-label)' }}
                            title={p.proxy || ''}
                          >
                            {proxyInfo.hostPort}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Tags */}
                    <td style={{ padding: '0 12px', whiteSpace: 'nowrap' }}>
                      {visibleTags.length > 0 ? (
                        <div style={{ display: 'inline-flex', gap: 4, flexWrap: 'nowrap' }}>
                          {visibleTags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              style={{
                                fontSize: 'var(--text-caption)',
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border)',
                                borderRadius: 4,
                                padding: '1px 6px',
                                lineHeight: 1.3,
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                          {visibleTags.length > 2 && (
                            <span
                              style={{
                                fontSize: 10,
                                color: 'var(--text-tertiary)',
                                padding: '1px 4px',
                              }}
                            >
                              +{visibleTags.length - 2}
                            </span>
                          )}
                        </div>
                      ) : null}
                    </td>

                    {/* Last Used (Relative) */}
                    <td style={{ padding: '0 12px', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          fontSize: 'var(--text-label)',
                          color: 'var(--text-tertiary)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {relativeTime}
                      </span>
                    </td>

                    {/* Actions: Compact 28px ghost Start/Stop + ⋯ menu */}
                    <td style={{ textAlign: 'right', padding: '0 16px', whiteSpace: 'nowrap' }}>
                      <div
                        className="row-actions"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          opacity: 0.6,
                          transition: 'opacity 140ms ease-out',
                        }}
                      >
                        {p.is_active ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            style={{ color: 'var(--status-danger)' }}
                            onClick={() => onStopProfile(p.name)}
                            title={t.actions.stop}
                          >
                            <Square size={11} strokeWidth={2} color="var(--status-danger)" />
                            <span>{t.actions.stop}</span>
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isLaunching}
                            onClick={() => handleStartWithProgress(p.name)}
                            title={t.actions.start}
                          >
                            <Play size={11} strokeWidth={2} color="var(--status-success)" />
                            <span>{t.actions.start}</span>
                          </Button>
                        )}

                        <DropdownMenu
                          align="right"
                          items={getRowMenuItems(p)}
                          trigger={({ toggle }) => (
                            <IconButton size="sm" onClick={toggle} tooltip={t.actions.more}>
                              <MoreHorizontal size={14} strokeWidth={1.5} />
                            </IconButton>
                          )}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div
        style={{
          height: 32,
          padding: '0 16px',
          borderTop: '1px solid var(--border)',
          backgroundColor: 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 'var(--text-caption)',
          color: 'var(--text-tertiary)',
          flexShrink: 0,
        }}
      >
        <span>
          {processedProfiles.length} of {profiles.length} profiles displayed
        </span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {profiles.filter((p) => p.is_active).length} active
        </span>
      </div>

      {/* Right-click Context Menu */}
      {contextMenuState && (
        <ContextMenu
          x={contextMenuState.x}
          y={contextMenuState.y}
          items={getRowMenuItems(contextMenuState.profile)}
          onClose={() => setContextMenuState(null)}
        />
      )}

      {/* Confirm Delete Dialog */}
      {confirmDeleteProfile && (
        <ConfirmDialog
          isOpen={true}
          danger={true}
          title={t.actions.moveToTrash}
          description={t.actions.confirmDelete(confirmDeleteProfile)}
          confirmLabel={t.modal.delete}
          cancelLabel={t.modal.cancel}
          onClose={() => setConfirmDeleteProfile(null)}
          onConfirm={() => {
            onTrashProfile(confirmDeleteProfile);
            setConfirmDeleteProfile(null);
          }}
        />
      )}

      {/* Confirm Regenerate Identity Dialog */}
      {confirmRegenerateProfile && (
        <ConfirmDialog
          isOpen={true}
          danger={true}
          title={t.actions.confirmRegenerateTitle}
          description={t.actions.confirmRegenerateDesc}
          confirmLabel={t.actions.regenerateIdentity}
          cancelLabel={t.modal.cancel}
          onClose={() => setConfirmRegenerateProfile(null)}
          onConfirm={() => {
            onRegenerateIdentity?.(confirmRegenerateProfile);
            setConfirmRegenerateProfile(null);
          }}
        />
      )}
    </section>
  );
}
