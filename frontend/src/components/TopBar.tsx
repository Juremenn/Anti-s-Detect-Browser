import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  FlaskConical,
  Play,
  Plus,
  Search,
  Square,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { t } from '../i18n';

interface TopBarProps {
  onNewProfile: () => void;
  onQuickProfile: () => void;
  onTestFingerprint: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  totalProfilesCount: number;
  selectedCount?: number;
  onBulkStart?: () => void;
  onBulkStop?: () => void;
  onBulkTrash?: () => void;
  onDeselectAll?: () => void;
}

export function TopBar({
  onNewProfile,
  onQuickProfile,
  onTestFingerprint,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  totalProfilesCount,
  selectedCount = 0,
  onBulkStart,
  onBulkStop,
  onBulkTrash,
  onDeselectAll,
}: TopBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close split dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global Ctrl+K / Cmd+K listener to focus search input
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent);
  const shortcutLabel = isMac ? t.topbar.searchShortcutMac : t.topbar.searchShortcut;

  // Render Bulk Selection Contextual Bar when rows are selected
  if (selectedCount > 0) {
    return (
      <header
        style={{
          height: 48,
          backgroundColor: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          flexShrink: 0,
          animation: 'fadeIn 120ms ease-out',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {t.bulk.selectedCount(selectedCount)}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {onBulkStart && (
            <button
              className="btn btn-ghost"
              onClick={onBulkStart}
              title={t.bulk.start}
            >
              <Play size={13} strokeWidth={1.5} color="var(--status-running)" />
              <span>{t.bulk.start}</span>
            </button>
          )}

          {onBulkStop && (
            <button
              className="btn btn-ghost"
              onClick={onBulkStop}
              title={t.bulk.stop}
            >
              <Square size={12} strokeWidth={1.5} color="var(--status-error)" />
              <span>{t.bulk.stop}</span>
            </button>
          )}

          {onBulkTrash && (
            <button
              className="btn btn-danger"
              onClick={onBulkTrash}
              title={t.bulk.moveToTrash}
            >
              <Trash2 size={13} strokeWidth={1.5} />
              <span>{t.bulk.moveToTrash}</span>
            </button>
          )}

          {onDeselectAll && (
            <button
              className="btn btn-ghost"
              onClick={onDeselectAll}
              title={t.bulk.clear}
              style={{ marginLeft: 4 }}
            >
              <X size={13} strokeWidth={1.5} />
              <span>{t.bulk.clear}</span>
            </button>
          )}
        </div>
      </header>
    );
  }

  // Standard Top Bar
  return (
    <header
      style={{
        height: 48,
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        flexShrink: 0,
        gap: 12,
      }}
    >
      {/* Title & Count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <h1
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: -0.2,
          }}
        >
          {t.topbar.title}
        </h1>
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--text-tertiary)',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            padding: '1px 6px',
            borderRadius: 4,
            fontFamily: 'var(--font-mono)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {totalProfilesCount}
        </span>
      </div>

      {/* Middle-Right: Search & Segmented Filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'flex-end' }}>
        {/* Search Input with Ctrl+K shortcut hint */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            width: 220,
          }}
        >
          <Search
            size={13}
            strokeWidth={1.5}
            color="var(--text-tertiary)"
            style={{
              position: 'absolute',
              left: 8,
              pointerEvents: 'none',
            }}
          />
          <input
            ref={searchInputRef}
            type="text"
            className="input-field"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t.topbar.searchPlaceholder}
            style={{
              width: '100%',
              paddingLeft: 26,
              paddingRight: search ? 24 : 48,
              height: 28,
              fontSize: 12,
            }}
          />
          {search ? (
            <button
              onClick={() => onSearchChange('')}
              style={{
                position: 'absolute',
                right: 6,
                background: 'none',
                border: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: 2,
              }}
              title="Clear search"
            >
              <X size={12} strokeWidth={1.5} />
            </button>
          ) : (
            <kbd
              style={{
                position: 'absolute',
                right: 6,
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-tertiary)',
                backgroundColor: 'var(--bg-raised)',
                border: '1px solid var(--border)',
                borderRadius: 3,
                padding: '1px 4px',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              {shortcutLabel}
            </kbd>
          )}
        </div>

        {/* Status Filter as Segmented Control (All / Running / Idle) */}
        <div className="segmented-control">
          <button
            className={`segmented-item ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => onStatusFilterChange('all')}
          >
            {t.topbar.filterAll}
          </button>
          <button
            className={`segmented-item ${statusFilter === 'active' ? 'active' : ''}`}
            onClick={() => onStatusFilterChange('active')}
          >
            {t.topbar.filterRunning}
          </button>
          <button
            className={`segmented-item ${statusFilter === 'idle' ? 'active' : ''}`}
            onClick={() => onStatusFilterChange('idle')}
          >
            {t.topbar.filterIdle}
          </button>
        </div>

        {/* Ghost Icon Button: Fingerprint Test */}
        <button
          className="btn-icon"
          onClick={onTestFingerprint}
          title={t.topbar.testFingerprintTooltip}
        >
          <FlaskConical size={15} strokeWidth={1.5} />
        </button>

        {/* Far Right: ONE Primary Action "New Profile" with split dropdown */}
        <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-flex' }}>
          <div style={{ display: 'inline-flex', alignItems: 'stretch' }}>
            <button
              className="btn btn-primary"
              onClick={onNewProfile}
              style={{
                borderTopRightRadius: 0,
                borderBottomRightRadius: 0,
                borderRight: '1px solid rgba(255, 255, 255, 0.2)',
                padding: '0 10px',
              }}
            >
              <Plus size={14} strokeWidth={2} />
              <span>{t.topbar.newProfile}</span>
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              title={t.topbar.quickProfile}
              style={{
                borderTopLeftRadius: 0,
                borderBottomLeftRadius: 0,
                padding: '0 6px',
              }}
            >
              <ChevronDown size={12} strokeWidth={2} />
            </button>
          </div>

          {/* Popover Menu for Quick Profile */}
          {dropdownOpen && (
            <div
              className="popover-menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                width: 170,
                animation: 'fadeIn 100ms ease-out',
              }}
            >
              <button
                className="menu-item"
                onClick={() => {
                  setDropdownOpen(false);
                  onQuickProfile();
                }}
              >
                <Zap size={14} strokeWidth={1.5} color="var(--accent)" />
                <span>{t.topbar.quickProfile}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
