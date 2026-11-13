import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy,
  FlaskConical,
  Folder,
  Globe,
  Monitor,
  MoreHorizontal,
  Play,
  Square,
  Trash2,
} from 'lucide-react';
import { Checkbox } from '../components/Checkbox';
import { EmptyState } from '../components/EmptyState';
import { StatusPill } from '../components/StatusPill';
import { t } from '../i18n';
import { Profile } from '../types';
import { formatFingerprintSpec, formatProxy } from '../utils/formatters';

interface ProfilesViewProps {
  profiles: Profile[];
  selectedProfiles: Set<string>;
  onToggleSelect: (name: string, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onDeselectAll: () => void;
  onStartProfile: (name: string) => Promise<void> | void;
  onStopProfile: (name: string) => Promise<void> | void;
  onOpenFolder: (name: string) => void;
  onTrashProfile: (name: string) => void;
  onDuplicateProfile?: (name: string) => void;
  onTestProfile?: (name: string) => void;
  onOpenNewProfileModal: () => void;
  searchQuery: string;
  statusFilter: string;
}

export function ProfilesView({
  profiles,
  selectedProfiles,
  onToggleSelect,
  onToggleSelectAll,
  onStartProfile,
  onStopProfile,
  onOpenFolder,
  onTrashProfile,
  onDuplicateProfile,
  onTestProfile,
  onOpenNewProfileModal,
  searchQuery,
  statusFilter,
}: ProfilesViewProps) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [startingProfiles, setStartingProfiles] = useState<Set<string>>(new Set());
  const menuRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  // Filter profiles based on search and status
  const filteredProfiles = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return profiles.filter((p) => {
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

      return matchQuery && matchStatus;
    });
  }, [profiles, searchQuery, statusFilter]);

  const allSelected =
    filteredProfiles.length > 0 &&
    filteredProfiles.every((p) => selectedProfiles.has(p.name));
  const someSelected =
    filteredProfiles.some((p) => selectedProfiles.has(p.name)) && !allSelected;

  // Close overflow menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation: Arrow Up/Down, Enter, Delete, Space
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger if typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev < filteredProfiles.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : filteredProfiles.length - 1));
      } else if (e.key === 'Enter') {
        if (focusedIndex >= 0 && focusedIndex < filteredProfiles.length) {
          e.preventDefault();
          const targetProfile = filteredProfiles[focusedIndex];
          if (targetProfile.is_active) {
            onStopProfile(targetProfile.name);
          } else {
            handleStartWithProgress(targetProfile.name);
          }
        }
      } else if (e.key === 'Delete') {
        if (focusedIndex >= 0 && focusedIndex < filteredProfiles.length) {
          e.preventDefault();
          const targetProfile = filteredProfiles[focusedIndex];
          if (confirm(t.actions.confirmDelete(targetProfile.name))) {
            onTrashProfile(targetProfile.name);
          }
        }
      } else if (e.key === ' ') {
        if (focusedIndex >= 0 && focusedIndex < filteredProfiles.length) {
          e.preventDefault();
          const targetProfile = filteredProfiles[focusedIndex];
          onToggleSelect(targetProfile.name, !selectedProfiles.has(targetProfile.name));
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, filteredProfiles, selectedProfiles, onToggleSelect, onStopProfile, onTrashProfile]);

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
          ref={tableRef}
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
              <th style={{ width: 40, textAlign: 'center', padding: '0 8px' }}>
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  disabled={filteredProfiles.length === 0}
                  ariaLabel={t.table.selectAll}
                  onChange={onToggleSelectAll}
                />
              </th>
              <th style={{ minWidth: 180, padding: '0 12px' }}>{t.table.name}</th>
              <th style={{ width: 110, padding: '0 12px' }}>{t.table.status}</th>
              <th style={{ minWidth: 260, padding: '0 12px' }}>{t.table.fingerprint}</th>
              <th style={{ width: 160, padding: '0 12px' }}>{t.table.proxy}</th>
              <th style={{ width: 140, padding: '0 12px' }}>{t.table.tags}</th>
              <th style={{ width: 100, textAlign: 'right', padding: '0 16px' }}>
                {t.table.actions}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredProfiles.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 0 }}>
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
                        <button
                          className="btn btn-primary"
                          onClick={onOpenNewProfileModal}
                        >
                          {t.empty.createFirstProfile}
                        </button>
                      ) : undefined
                    }
                  />
                </td>
              </tr>
            ) : (
              filteredProfiles.map((p, idx) => {
                const isSelected = selectedProfiles.has(p.name);
                const isFocused = idx === focusedIndex;
                const isStarting = startingProfiles.has(p.name);
                const isMac = (p.platform || '').toLowerCase().includes('mac');
                const isMenuOpen = activeMenu === p.name;
                const specSummary = formatFingerprintSpec(p);
                const proxyInfo = formatProxy(p.proxy);

                // Filter out "Default" tag when it's the only one
                const visibleTags = (p.tags || []).filter(
                  (tag) => tag.toLowerCase() !== 'default'
                );

                return (
                  <tr
                    key={p.name}
                    tabIndex={0}
                    onFocus={() => setFocusedIndex(idx)}
                    style={{
                      height: 44,
                      borderBottom: '1px solid var(--border)',
                      backgroundColor: isSelected
                        ? 'var(--accent-subtle)'
                        : isFocused
                        ? 'var(--bg-hover-row)'
                        : 'transparent',
                      transition: 'background-color 120ms ease-out',
                      outline: 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected && !isFocused) {
                        e.currentTarget.style.backgroundColor = 'var(--bg-hover-row)';
                      }
                      const actionGroup = e.currentTarget.querySelector('.row-actions') as HTMLElement;
                      if (actionGroup) actionGroup.style.opacity = '1';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected && !isFocused) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                      const actionGroup = e.currentTarget.querySelector('.row-actions') as HTMLElement;
                      if (actionGroup && !isMenuOpen) actionGroup.style.opacity = '0.6';
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

                    {/* Name + Monospace Seed */}
                    <td style={{ padding: '0 12px', whiteSpace: 'nowrap' }}>
                      <div
                        style={{
                          fontWeight: 500,
                          fontSize: 13,
                          color: 'var(--text-primary)',
                          lineHeight: 1.2,
                        }}
                      >
                        {p.name}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-tertiary)',
                          lineHeight: 1.2,
                          marginTop: 2,
                        }}
                      >
                        {t.table.seed(p.canvas_seed || '-')}
                      </div>
                    </td>

                    {/* Status Dot + Label (Inline progress on starting) */}
                    <td style={{ padding: '0 12px', whiteSpace: 'nowrap' }}>
                      <StatusPill
                        isActive={p.is_active}
                        isStarting={isStarting}
                        pid={p.pid}
                      />
                    </td>

                    {/* Fingerprint: OS Icon + Parsed Short Single-Line Spec + Full Tooltip */}
                    <td
                      style={{
                        padding: '0 12px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={p.webgl_renderer || 'WebGL Hardware Profile'}
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {isMac ? (
                          <Monitor size={14} strokeWidth={1.5} color="var(--text-secondary)" />
                        ) : (
                          <Monitor size={14} strokeWidth={1.5} color="var(--text-secondary)" />
                        )}
                        <span
                          style={{
                            fontSize: 12,
                            color: 'var(--text-secondary)',
                            fontFamily: 'var(--font-sans)',
                          }}
                        >
                          {specSummary}
                        </span>
                      </div>
                    </td>

                    {/* Proxy: Direct in tertiary text; Real proxy in mono host:port */}
                    <td style={{ padding: '0 12px', whiteSpace: 'nowrap' }}>
                      {proxyInfo.isDirect ? (
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                          {t.table.directProxy}
                        </span>
                      ) : (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Globe size={13} strokeWidth={1.5} color="var(--text-secondary)" />
                          <span
                            className="mono-tech"
                            style={{ fontSize: 11.5 }}
                            title={p.proxy || ''}
                          >
                            {proxyInfo.hostPort}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Tags: Hidden when only "Default", subtle 1px border chips otherwise */}
                    <td style={{ padding: '0 12px', whiteSpace: 'nowrap' }}>
                      {visibleTags.length > 0 ? (
                        <div style={{ display: 'inline-flex', gap: 4, flexWrap: 'nowrap' }}>
                          {visibleTags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              style={{
                                fontSize: 11,
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

                    {/* Row Actions: 28px ghost Start/Stop button + Overflow Menu */}
                    <td style={{ textAlign: 'right', padding: '0 16px', whiteSpace: 'nowrap' }}>
                      <div
                        className="row-actions"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          opacity: isMenuOpen ? 1 : 0.6,
                          transition: 'opacity 140ms ease-out',
                        }}
                      >
                        {p.is_active ? (
                          <button
                            className="btn btn-ghost"
                            style={{
                              height: 28,
                              padding: '0 8px',
                              fontSize: 12,
                              color: 'var(--status-error)',
                            }}
                            title={t.actions.stop}
                            onClick={() => onStopProfile(p.name)}
                          >
                            <Square size={11} strokeWidth={2} color="var(--status-error)" />
                            <span>{t.actions.stop}</span>
                          </button>
                        ) : (
                          <button
                            className="btn btn-ghost"
                            style={{
                              height: 28,
                              padding: '0 8px',
                              fontSize: 12,
                            }}
                            title={t.actions.start}
                            disabled={isStarting}
                            onClick={() => handleStartWithProgress(p.name)}
                          >
                            <Play size={11} strokeWidth={2} color="var(--status-running)" />
                            <span>{t.actions.start}</span>
                          </button>
                        )}

                        {/* Overflow ⋯ Menu */}
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <button
                            className="btn-icon"
                            title={t.actions.more}
                            onClick={() => setActiveMenu(isMenuOpen ? null : p.name)}
                            style={{ width: 28, height: 28 }}
                          >
                            <MoreHorizontal size={15} strokeWidth={1.5} />
                          </button>

                          {isMenuOpen && (
                            <div
                              ref={menuRef}
                              className="popover-menu"
                              style={{
                                position: 'absolute',
                                right: 0,
                                top: 'calc(100% + 4px)',
                                width: 160,
                                zIndex: 100,
                              }}
                            >
                              <button
                                className="menu-item"
                                onClick={() => {
                                  setActiveMenu(null);
                                  onOpenFolder(p.name);
                                }}
                              >
                                <Folder size={13} strokeWidth={1.5} />
                                <span>{t.actions.openFolder}</span>
                              </button>

                              {onDuplicateProfile && (
                                <button
                                  className="menu-item"
                                  onClick={() => {
                                    setActiveMenu(null);
                                    onDuplicateProfile(p.name);
                                  }}
                                >
                                  <Copy size={13} strokeWidth={1.5} />
                                  <span>{t.actions.duplicate}</span>
                                </button>
                              )}

                              <button
                                className="menu-item"
                                onClick={() => {
                                  setActiveMenu(null);
                                  if (onTestProfile) {
                                    onTestProfile(p.name);
                                  } else {
                                    handleStartWithProgress(p.name);
                                  }
                                }}
                              >
                                <FlaskConical size={13} strokeWidth={1.5} />
                                <span>{t.actions.testFingerprint}</span>
                              </button>

                              <div
                                style={{
                                  height: 1,
                                  backgroundColor: 'var(--border)',
                                  margin: '4px 0',
                                }}
                              />

                              <button
                                className="menu-item danger"
                                onClick={() => {
                                  setActiveMenu(null);
                                  if (confirm(t.actions.confirmDelete(p.name))) {
                                    onTrashProfile(p.name);
                                  }
                                }}
                              >
                                <Trash2 size={13} strokeWidth={1.5} />
                                <span>{t.actions.delete}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer Summary */}
      <div
        style={{
          height: 32,
          padding: '0 16px',
          borderTop: '1px solid var(--border)',
          backgroundColor: 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 11,
          color: 'var(--text-tertiary)',
          flexShrink: 0,
        }}
      >
        <span>
          {filteredProfiles.length} of {profiles.length} profiles displayed
        </span>
        <span>
          {profiles.filter((p) => p.is_active).length} active
        </span>
      </div>
    </section>
  );
}
