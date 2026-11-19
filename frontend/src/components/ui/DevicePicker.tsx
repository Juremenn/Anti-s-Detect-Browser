import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Laptop,
  Monitor,
  Search,
  Smartphone,
  Tablet,
  X,
} from 'lucide-react';

export interface DevicePresetItem {
  id: string;
  name: string;
  label?: string;
  category?: string;
  os?: string;
  os_name?: string;
  platform?: string;
  webgl_vendor?: string;
  webgl_renderer?: string;
  hardware_concurrency?: number;
  device_memory?: number;
  screen_width?: number;
  screen_height?: number;
  device_pixel_ratio?: number;
  max_touch_points?: number;
  user_agent?: string;
  model?: string;
}

interface DevicePickerProps {
  presets: DevicePresetItem[];
  selectedId: string;
  onChange: (presetId: string, preset: DevicePresetItem) => void;
  disabled?: boolean;
}

function getCategoryIcon(category?: string, size = 15) {
  switch (category) {
    case 'mobile':
      return <Smartphone size={size} strokeWidth={1.5} color="#4F46E5" style={{ flexShrink: 0 }} />;
    case 'tablet':
      return <Tablet size={size} strokeWidth={1.5} color="#4F46E5" style={{ flexShrink: 0 }} />;
    case 'desktop':
      return <Monitor size={size} strokeWidth={1.5} color="#4F46E5" style={{ flexShrink: 0 }} />;
    default:
      return <Laptop size={size} strokeWidth={1.5} color="#4F46E5" style={{ flexShrink: 0 }} />;
  }
}

function getOsBadgeLabel(os?: string): string {
  if (!os) return 'DEV';
  const lower = os.toLowerCase();
  if (lower.includes('win')) return 'WIN';
  if (lower.includes('mac')) return 'MAC';
  if (lower.includes('ios') || lower.includes('iphone') || lower.includes('ipad')) return 'IOS';
  if (lower.includes('and')) return 'AND';
  return os.toUpperCase().slice(0, 3);
}

// Memoized Single Device Row for 120fps Rendering
interface DeviceRowProps {
  preset: DevicePresetItem;
  isSelected: boolean;
  isFocused: boolean;
  onSelect: (p: DevicePresetItem) => void;
}

const DeviceRow = memo(({ preset, isSelected, isFocused, onSelect }: DeviceRowProps) => {
  const osBadge = getOsBadgeLabel(preset.os);
  const specs = useMemo(() => {
    const parts: string[] = [];
    if (preset.hardware_concurrency) parts.push(`${preset.hardware_concurrency}C`);
    if (preset.device_memory) parts.push(`${preset.device_memory}GB`);
    if (preset.screen_width && preset.screen_height) {
      parts.push(`${preset.screen_width}×${preset.screen_height}`);
    }
    if (preset.device_pixel_ratio && preset.device_pixel_ratio !== 1) {
      parts.push(`@${preset.device_pixel_ratio}x`);
    }
    return parts.join(' · ');
  }, [preset.hardware_concurrency, preset.device_memory, preset.screen_width, preset.screen_height, preset.device_pixel_ratio]);

  const gpuName = useMemo(() => {
    if (!preset.webgl_renderer) return '';
    const raw = preset.webgl_renderer;
    const match = raw.match(/,\s*([^,]+?)(?:\s+Direct3D11|\s+\(Metal\)|\s+vs_|\))/i);
    return match ? match[1].trim() : raw.split('(')[0].trim();
  }, [preset.webgl_renderer]);

  return (
    <div
      role="option"
      aria-selected={isSelected}
      onClick={() => onSelect(preset)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        cursor: 'pointer',
        backgroundColor: isFocused ? '#F1F5F9' : isSelected ? '#EEF2FF' : 'transparent',
        borderLeft: isSelected ? '3px solid #4F46E5' : '3px solid transparent',
        transition: 'background-color 80ms ease',
        userSelect: 'none',
        minHeight: 48,
        boxSizing: 'border-box',
      }}
      onMouseEnter={(e) => {
        if (!isFocused) e.currentTarget.style.backgroundColor = isSelected ? '#EEF2FF' : '#F8FAFC';
      }}
      onMouseLeave={(e) => {
        if (!isFocused) e.currentTarget.style.backgroundColor = isSelected ? '#EEF2FF' : 'transparent';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {getCategoryIcon(preset.category, 14)}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: isSelected ? 600 : 500,
                color: isSelected ? '#4F46E5' : '#0F172A',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={preset.name}
            >
              {preset.name}
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                padding: '1px 5px',
                borderRadius: 4,
                backgroundColor: '#F1F5F9',
                color: '#475569',
                flexShrink: 0,
                letterSpacing: 0.3,
              }}
            >
              {osBadge}
            </span>
          </div>

          <div
            style={{
              fontSize: 10.5,
              color: '#64748B',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {gpuName && (
              <span style={{ color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {gpuName}
              </span>
            )}
            {gpuName && specs && <span>·</span>}
            {specs && <span>{specs}</span>}
          </div>
        </div>
      </div>

      {isSelected && (
        <div style={{ flexShrink: 0, marginLeft: 8, display: 'flex', alignItems: 'center', color: '#4F46E5' }}>
          <Check size={14} strokeWidth={2.5} />
        </div>
      )}
    </div>
  );
});

DeviceRow.displayName = 'DeviceRow';

export function DevicePicker({ presets, selectedId, onChange, disabled }: DevicePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [osFilter, setOsFilter] = useState<'all' | 'win' | 'mac' | 'ios' | 'android'>('all');
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Selected Preset Object
  const selectedPreset = useMemo(() => {
    return presets.find((p) => p.id === selectedId) || presets[0] || null;
  }, [presets, selectedId]);

  // Counts per Category for Filter Pills
  const counts = useMemo(() => {
    const c = { all: presets.length, win: 0, mac: 0, ios: 0, android: 0 };
    presets.forEach((p) => {
      const os = (p.os || '').toLowerCase();
      if (os === 'win' || os === 'windows') c.win += 1;
      else if (os === 'mac' || os === 'macos') c.mac += 1;
      else if (os === 'ios') c.ios += 1;
      else if (os === 'android') c.android += 1;
    });
    return c;
  }, [presets]);

  // Pre-indexed normalized search text for < 0.2ms keystroke filtering
  const indexedPresets = useMemo(() => {
    return presets.map((p) => {
      const searchKey = `${p.name} ${p.label || ''} ${p.os || ''} ${p.platform || ''} ${p.webgl_renderer || ''} ${p.model || ''}`.toLowerCase();
      return { item: p, searchKey };
    });
  }, [presets]);

  // Filtered List
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return indexedPresets.filter(({ item, searchKey }) => {
      if (osFilter !== 'all') {
        const itemOs = (item.os || '').toLowerCase();
        if (osFilter === 'win' && itemOs !== 'win' && itemOs !== 'windows') return false;
        if (osFilter === 'mac' && itemOs !== 'mac' && itemOs !== 'macos') return false;
        if (osFilter === 'ios' && itemOs !== 'ios') return false;
        if (osFilter === 'android' && itemOs !== 'android') return false;
      }
      if (!q) return true;
      return searchKey.includes(q);
    }).map(({ item }) => item);
  }, [indexedPresets, query, osFilter]);

  // Toggle Dropdown
  const handleToggle = useCallback(() => {
    if (disabled) return;
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        setQuery('');
        setFocusedIndex(-1);
        setTimeout(() => searchInputRef.current?.focus(), 40);
      }
      return next;
    });
  }, [disabled]);

  // Handle Preset Selection
  const handleSelect = useCallback(
    (preset: DevicePresetItem) => {
      onChange(preset.id, preset);
      setIsOpen(false);
    },
    [onChange]
  );

  // Close when clicked outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Keyboard Navigation: Up, Down, Enter, Escape
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleToggle();
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < filtered.length) {
          handleSelect(filtered[focusedIndex]);
        }
      }
    },
    [isOpen, filtered, focusedIndex, handleToggle, handleSelect]
  );

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const focusedEl = listRef.current.children[focusedIndex] as HTMLElement | undefined;
      if (focusedEl) {
        focusedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [focusedIndex]);

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      style={{
        position: 'relative',
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
      }}
    >
      {/* 42px Surface Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        style={{
          width: '100%',
          minWidth: 0,
          height: 42,
          padding: '0 12px',
          backgroundColor: '#FFFFFF',
          border: isOpen ? '1px solid #4F46E5' : '1px solid #E2E8F0',
          borderRadius: 8,
          boxShadow: isOpen ? '0 0 0 3px rgba(79, 70, 229, 0.12)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          transition: 'border-color 140ms ease, box-shadow 140ms ease',
          boxSizing: 'border-box',
        }}
        onMouseEnter={(e) => {
          if (!isOpen && !disabled) e.currentTarget.style.borderColor = '#CBD5E1';
        }}
        onMouseLeave={(e) => {
          if (!isOpen && !disabled) e.currentTarget.style.borderColor = '#E2E8F0';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 5,
              backgroundColor: '#F8FAFC',
              border: '1px solid #E5E7EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {getCategoryIcon(selectedPreset?.category, 14)}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#0F172A',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {selectedPreset ? selectedPreset.name : 'Select Device Preset...'}
            </span>
            {selectedPreset && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  padding: '1px 6px',
                  borderRadius: 4,
                  backgroundColor: '#F1F5F9',
                  color: '#475569',
                  flexShrink: 0,
                  letterSpacing: 0.3,
                }}
              >
                {getOsBadgeLabel(selectedPreset.os)}
              </span>
            )}
          </div>
        </div>

        <ChevronDown
          size={14}
          strokeWidth={1.75}
          color="#64748B"
          style={{
            flexShrink: 0,
            marginLeft: 8,
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 150ms ease',
          }}
        />
      </button>

      {/* Popover Panel */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 48,
            left: 0,
            right: 0,
            zIndex: 9999,
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: 8,
            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 380,
            overflow: 'hidden',
            animation: 'fadeIn 120ms ease-out',
          }}
        >
          {/* Header Strip: Search Bar */}
          <div
            style={{
              padding: '8px 10px',
              borderBottom: '1px solid #F1F5F9',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: '#FAFAFA',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                position: 'relative',
                flex: 1,
              }}
            >
              <Search
                size={13}
                strokeWidth={1.75}
                color="#94A3B8"
                style={{ position: 'absolute', left: 8, pointerEvents: 'none' }}
              />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setFocusedIndex(0);
                }}
                placeholder="Search 100 devices (ThinkPad, XPS, M3, iPhone, Pixel, S24)..."
                style={{
                  width: '100%',
                  height: 30,
                  paddingLeft: 28,
                  paddingRight: query ? 24 : 8,
                  fontSize: 12,
                  color: '#0F172A',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: 6,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#4F46E5';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#E2E8F0';
                }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    searchInputRef.current?.focus();
                  }}
                  style={{
                    position: 'absolute',
                    right: 6,
                    background: 'none',
                    border: 'none',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 2,
                  }}
                >
                  <X size={12} strokeWidth={2} />
                </button>
              )}
            </div>
          </div>

          {/* Segmented OS Filter Bar */}
          <div
            style={{
              display: 'flex',
              gap: 4,
              padding: '6px 10px',
              backgroundColor: '#FFFFFF',
              borderBottom: '1px solid #F1F5F9',
              overflowX: 'auto',
              flexShrink: 0,
            }}
          >
            {[
              { id: 'all', label: 'All', count: counts.all },
              { id: 'win', label: 'Windows', count: counts.win },
              { id: 'mac', label: 'macOS', count: counts.mac },
              { id: 'ios', label: 'iOS', count: counts.ios },
              { id: 'android', label: 'Android', count: counts.android },
            ].map((f) => {
              const active = osFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setOsFilter(f.id as typeof osFilter);
                    setFocusedIndex(0);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    height: 24,
                    padding: '0 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: active ? 600 : 500,
                    backgroundColor: active ? '#EEF2FF' : 'transparent',
                    color: active ? '#4F46E5' : '#64748B',
                    border: active ? '1px solid #C7D2FE' : '1px solid transparent',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 100ms ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.backgroundColor = '#F8FAFC';
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span>{f.label}</span>
                  <span
                    style={{
                      fontSize: 9.5,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      opacity: active ? 1 : 0.7,
                    }}
                  >
                    ({f.count})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Scrollable Virtual Option List */}
          <div
            ref={listRef}
            role="listbox"
            style={{
              flex: 1,
              overflowY: 'auto',
              maxHeight: 280,
              padding: '4px 0',
            }}
          >
            {filtered.length === 0 ? (
              <div
                style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  fontSize: 12,
                  color: '#94A3B8',
                }}
              >
                No devices found matching &quot;{query}&quot;
              </div>
            ) : (
              filtered.map((preset, idx) => (
                <DeviceRow
                  key={preset.id}
                  preset={preset}
                  isSelected={preset.id === selectedId}
                  isFocused={idx === focusedIndex}
                  onSelect={handleSelect}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
