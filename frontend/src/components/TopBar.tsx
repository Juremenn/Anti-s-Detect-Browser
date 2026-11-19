import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  FlaskConical,
  Layers,
  Moon,
  Play,
  Plus,
  Search,
  Square,
  Sun,
  Tag,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { t } from '../i18n';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { Kbd } from './ui/Kbd';
import { SegmentedControl } from './ui/SegmentedControl';
import { Select } from './ui/Select';

interface TopBarProps {
  onNewProfile: () => void;
  onQuickProfile: () => void;
  onFromTemplate?: () => void;
  onBulkCreate?: () => void;
  onImportProfile?: () => void;
  onTestFingerprint: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  selectedTag?: string;
  onTagChange?: (tag: string) => void;
  allTags?: string[];
  totalProfilesCount: number;
  selectedCount?: number;
  onBulkStart?: () => void;
  onBulkStop?: () => void;
  onBulkAssignProxy?: () => void;
  onBulkAddTag?: () => void;
  onBulkTrash?: () => void;
  onDeselectAll?: () => void;
  resolvedTheme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export function TopBar({
  onNewProfile,
  onQuickProfile,
  onFromTemplate,
  onBulkCreate,
  onImportProfile,
  onTestFingerprint,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  selectedTag = 'all',
  onTagChange,
  allTags = [],
  totalProfilesCount,
  selectedCount = 0,
  onBulkStart,
  onBulkStop,
  onBulkAssignProxy,
  onBulkAddTag,
  onBulkTrash,
  onDeselectAll,
  resolvedTheme = 'light',
  onToggleTheme,
}: TopBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global Ctrl+K listener
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

  // Contextual Bar when 1+ rows selected
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
              fontSize: 'var(--text-body)',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {t.bulk.selectedCount(selectedCount)}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {onBulkStart && (
            <Button variant="ghost" size="sm" onClick={onBulkStart} title={t.bulk.start}>
              <Play size={12} strokeWidth={2} color="var(--status-success)" />
              <span>{t.bulk.start}</span>
            </Button>
          )}

          {onBulkStop && (
            <Button variant="ghost" size="sm" onClick={onBulkStop} title={t.bulk.stop}>
              <Square size={12} strokeWidth={2} color="var(--status-danger)" />
              <span>{t.bulk.stop}</span>
            </Button>
          )}

          {onBulkAssignProxy && (
            <Button variant="ghost" size="sm" onClick={onBulkAssignProxy} title={t.bulk.assignProxy}>
              <span>{t.bulk.assignProxy}</span>
            </Button>
          )}

          {onBulkAddTag && (
            <Button variant="ghost" size="sm" onClick={onBulkAddTag} title={t.bulk.addTag}>
              <Tag size={12} strokeWidth={1.5} />
              <span>{t.bulk.addTag}</span>
            </Button>
          )}

          {onBulkTrash && (
            <Button variant="danger" size="sm" onClick={onBulkTrash} title={t.bulk.moveToTrash}>
              <Trash2 size={12} strokeWidth={1.5} />
              <span>{t.bulk.moveToTrash}</span>
            </Button>
          )}

          {onDeselectAll && (
            <IconButton size="sm" onClick={onDeselectAll} tooltip={t.bulk.clear}>
              <X size={13} strokeWidth={1.5} />
            </IconButton>
          )}
        </div>
      </header>
    );
  }

  // Normal Top Bar
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
      {/* Title & Total Count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <h1
          style={{
            fontSize: 'var(--text-section)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: -0.2,
          }}
        >
          {t.topbar.title}
        </h1>
        <span
          style={{
            fontSize: 'var(--text-caption)',
            fontWeight: 500,
            color: 'var(--text-tertiary)',
            backgroundColor: 'var(--bg-raised)',
            padding: '1px 6px',
            borderRadius: 4,
            fontFamily: 'var(--font-sans)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {totalProfilesCount}
        </span>
      </div>

      {/* Middle & Right Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
        {/* Search */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: 220 }}>
          <Search
            size={13}
            strokeWidth={1.5}
            color="var(--text-tertiary)"
            style={{ position: 'absolute', left: 8, pointerEvents: 'none' }}
          />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t.topbar.searchPlaceholder}
            style={{
              width: '100%',
              height: 'var(--control-height-sm)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-control)',
              paddingLeft: 26,
              paddingRight: search ? 24 : 48,
              fontSize: 'var(--text-label)',
              color: 'var(--text-primary)',
              outline: 'none',
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
            >
              <X size={12} strokeWidth={1.5} />
            </button>
          ) : (
            <div style={{ position: 'absolute', right: 6 }}>
              <Kbd>{shortcutLabel}</Kbd>
            </div>
          )}
        </div>

        {/* Segmented Control: All / Running / Idle */}
        <SegmentedControl
          size="sm"
          value={statusFilter}
          onChange={onStatusFilterChange}
          options={[
            { value: 'all', label: t.topbar.filterAll },
            { value: 'active', label: t.topbar.filterRunning },
            { value: 'idle', label: t.topbar.filterIdle },
          ]}
        />

        {/* Tag Filter (if tags exist) */}
        {allTags.length > 0 && onTagChange && (
          <div style={{ width: 140 }}>
            <Select
              sizeVariant="sm"
              value={selectedTag}
              onChange={(e) => onTagChange(e.target.value)}
            >
              <option value="all">{t.topbar.filterTag}</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </Select>
          </div>
        )}

        {/* Fingerprint Test Ghost Button */}
        <IconButton size="sm" onClick={onTestFingerprint} tooltip={t.topbar.fingerprintTest}>
          <FlaskConical size={14} strokeWidth={1.5} />
        </IconButton>

        {/* Theme Toggle (Dark / Light) */}
        {onToggleTheme && (
          <IconButton
            size="sm"
            onClick={onToggleTheme}
            tooltip={resolvedTheme === 'dark' ? t.topbar.themeToggleDark : t.topbar.themeToggleLight}
          >
            {resolvedTheme === 'dark' ? (
              <Sun size={14} strokeWidth={1.5} />
            ) : (
              <Moon size={14} strokeWidth={1.5} />
            )}
          </IconButton>
        )}

        {/* Primary Action "New Profile" with split dropdown */}
        <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-flex' }}>
          <div style={{ display: 'inline-flex', alignItems: 'stretch' }}>
            <Button
              variant="primary"
              size="sm"
              onClick={onNewProfile}
              style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}
            >
              <Plus size={13} strokeWidth={2} />
              <span>{t.topbar.newProfile}</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, padding: '0 6px' }}
              title="More creation options"
            >
              <ChevronDown size={12} strokeWidth={2} />
            </Button>
          </div>

          {dropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                width: 170,
                backgroundColor: 'var(--bg-overlay)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-control)',
                boxShadow: 'var(--shadow-popover)',
                padding: 4,
                zIndex: 3000,
                animation: 'fadeIn 100ms ease-out',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  onQuickProfile();
                }}
                className="menu-item"
              >
                <Zap size={13} strokeWidth={1.5} color="var(--accent)" />
                <span>{t.topbar.quickProfile}</span>
              </button>

              {onFromTemplate && (
                <button
                  type="button"
                  onClick={() => {
                    setDropdownOpen(false);
                    onFromTemplate();
                  }}
                  className="menu-item"
                >
                  <Layers size={13} strokeWidth={1.5} />
                  <span>{t.topbar.fromTemplate}</span>
                </button>
              )}

              {onBulkCreate && (
                <button
                  type="button"
                  onClick={() => {
                    setDropdownOpen(false);
                    onBulkCreate();
                  }}
                  className="menu-item"
                >
                  <FileSpreadsheet size={13} strokeWidth={1.5} />
                  <span>{t.topbar.bulkCreate}</span>
                </button>
              )}

              {onImportProfile && (
                <button
                  type="button"
                  onClick={() => {
                    setDropdownOpen(false);
                    onImportProfile();
                  }}
                  className="menu-item"
                >
                  <Download size={13} strokeWidth={1.5} />
                  <span>{t.topbar.importProfile}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
