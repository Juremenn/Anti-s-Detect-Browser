import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

export interface SelectOptionItem {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  error?: string;
  sizeVariant?: 'sm' | 'md';
  options?: SelectOptionItem[];
  onValueChange?: (value: string) => void;
  placeholder?: string;
}

function extractOptions(children: React.ReactNode): SelectOptionItem[] {
  const result: SelectOptionItem[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === React.Fragment) {
      result.push(...extractOptions((child.props as { children?: React.ReactNode }).children));
      return;
    }
    if (child.type === 'option') {
      const props = child.props as {
        value?: string | number;
        disabled?: boolean;
        children?: React.ReactNode;
      };
      const label = React.Children.toArray(props.children)
        .map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : ''))
        .join('')
        .trim();
      const value = props.value !== undefined ? String(props.value) : label;
      result.push({ value, label: label || value, disabled: props.disabled });
    }
  });
  return result;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      error,
      sizeVariant = 'md',
      children,
      options: propOptions,
      value,
      defaultValue,
      onChange,
      onValueChange,
      disabled = false,
      placeholder,
      style,
      ...rest
    },
    _ref
  ) => {
    const isSm = sizeVariant === 'sm';
    const height = isSm ? 'var(--control-height-sm)' : 'var(--control-height)';
    const fontSize = isSm ? 'var(--text-label)' : 'var(--text-body)';

    const parsedOptions = useMemo(
      () => (propOptions && propOptions.length > 0 ? propOptions : extractOptions(children)),
      [propOptions, children]
    );

    const currentValue =
      value !== undefined
        ? String(value)
        : defaultValue !== undefined
          ? String(defaultValue)
          : parsedOptions[0]?.value ?? '';

    const selectedOption = useMemo(
      () => parsedOptions.find((o) => o.value === currentValue),
      [parsedOptions, currentValue]
    );

    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [highlightIdx, setHighlightIdx] = useState(0);
    const [coords, setCoords] = useState<{
      top: number;
      bottom?: number;
      left: number;
      width: number;
      maxHeight: number;
      openUpward: boolean;
    } | null>(null);

    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const showSearch = parsedOptions.length > 8;

    const filteredOptions = useMemo(() => {
      if (!showSearch || !searchQuery.trim()) return parsedOptions;
      const q = searchQuery.toLowerCase().trim();
      return parsedOptions.filter(
        (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
      );
    }, [parsedOptions, showSearch, searchQuery]);

    function updatePosition() {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportH = window.innerHeight;
      const viewportW = window.innerWidth;
      const spaceBelow = viewportH - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const desiredHeight = showSearch ? 300 : Math.min(260, parsedOptions.length * 32 + 12);
      const openUpward = spaceBelow < Math.min(200, desiredHeight) && spaceAbove > spaceBelow;
      const maxHeight = Math.max(140, Math.min(desiredHeight, openUpward ? spaceAbove : spaceBelow));
      const width = Math.min(Math.max(rect.width, 160), viewportW - 24);
      const left = Math.min(rect.left, viewportW - width - 12);

      setCoords({
        top: openUpward ? 0 : rect.bottom + 4,
        bottom: openUpward ? viewportH - rect.top + 4 : undefined,
        left: Math.max(8, left),
        width,
        maxHeight,
        openUpward,
      });
    }

    useEffect(() => {
      if (!open) {
        setSearchQuery('');
        return;
      }
      updatePosition();
      const activeIdx = Math.max(
        0,
        filteredOptions.findIndex((o) => o.value === currentValue)
      );
      setHighlightIdx(activeIdx);

      if (showSearch) {
        requestAnimationFrame(() => {
          searchInputRef.current?.focus();
        });
      }

      function handleOutside(e: MouseEvent) {
        const target = e.target as Node;
        if (
          triggerRef.current &&
          !triggerRef.current.contains(target) &&
          menuRef.current &&
          !menuRef.current.contains(target)
        ) {
          setOpen(false);
        }
      }

      function handleScrollOrResize(e: Event) {
        if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) {
          return;
        }
        updatePosition();
      }

      document.addEventListener('mousedown', handleOutside);
      window.addEventListener('resize', handleScrollOrResize);
      window.addEventListener('scroll', handleScrollOrResize, true);
      return () => {
        document.removeEventListener('mousedown', handleOutside);
        window.removeEventListener('resize', handleScrollOrResize);
        window.removeEventListener('scroll', handleScrollOrResize, true);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
      if (!open || !listRef.current) return;
      const el = listRef.current.querySelector(`[data-opt-idx="${highlightIdx}"]`) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ block: 'nearest' });
      }
    }, [highlightIdx, open]);

    function selectValue(nextVal: string) {
      if (disabled) return;
      onValueChange?.(nextVal);
      if (onChange) {
        const syntheticEvent = {
          target: { value: nextVal },
          currentTarget: { value: nextVal },
          preventDefault: () => {},
          stopPropagation: () => {},
        } as unknown as React.ChangeEvent<HTMLSelectElement>;
        onChange(syntheticEvent);
      }
      setOpen(false);
      triggerRef.current?.focus();
    }

    function handleKeyDown(e: React.KeyboardEvent) {
      if (disabled) return;
      if (!open) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          setOpen(true);
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIdx((prev) =>
          filteredOptions.length === 0 ? 0 : (prev + 1) % filteredOptions.length
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIdx((prev) =>
          filteredOptions.length === 0
            ? 0
            : (prev - 1 + filteredOptions.length) % filteredOptions.length
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const chosen = filteredOptions[highlightIdx];
        if (chosen && !chosen.disabled) {
          selectValue(chosen.value);
        }
      }
    }

    function renderOptionLabel(label: string) {
      if (!label.includes(' · ')) {
        return (
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {label}
          </span>
        );
      }
      const [primary, ...restParts] = label.split(' · ');
      return (
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            width: '100%',
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {primary}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-tertiary)',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            {restParts.join(' · ')}
          </span>
        </span>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={rest['aria-label']}
          onClick={() => !disabled && setOpen((v) => !v)}
          onKeyDown={handleKeyDown}
          style={{
            height,
            backgroundColor: 'var(--bg-surface)',
            border: `1px solid ${
              error ? 'var(--status-danger)' : open ? 'var(--accent)' : 'var(--border)'
            }`,
            boxShadow: open
              ? `0 0 0 2px ${error ? 'rgba(242, 85, 90, 0.25)' : 'var(--accent-ring)'}`
              : 'none',
            borderRadius: 'var(--radius-control)',
            padding: '0 10px',
            fontSize,
            color: selectedOption ? 'var(--text-primary)' : 'var(--text-tertiary)',
            fontFamily: 'var(--font-sans)',
            outline: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            textAlign: 'left',
            ...style,
          }}
        >
          <span
            style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {selectedOption?.label ?? placeholder ?? currentValue}
          </span>
          <ChevronDown
            size={14}
            strokeWidth={1.75}
            color="var(--text-tertiary)"
            style={{
              flexShrink: 0,
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 140ms ease-out',
            }}
          />
        </button>

        {open &&
          coords &&
          createPortal(
            <div
              ref={menuRef}
              role="listbox"
              onKeyDown={handleKeyDown}
              style={{
                position: 'fixed',
                top: coords.openUpward ? undefined : coords.top,
                bottom: coords.openUpward ? coords.bottom : undefined,
                left: coords.left,
                width: coords.width,
                maxHeight: coords.maxHeight,
                backgroundColor: 'var(--bg-overlay)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-panel)',
                boxShadow: 'var(--shadow-popover)',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                animation: 'fadeIn 100ms ease-out',
              }}
            >
              {showSearch && (
                <div
                  style={{
                    padding: '6px 8px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: 'var(--bg-surface)',
                    flexShrink: 0,
                  }}
                >
                  <Search size={13} strokeWidth={1.6} color="var(--text-tertiary)" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setHighlightIdx(0);
                    }}
                    placeholder="Cari opsi / template..."
                    style={{
                      border: 'none',
                      outline: 'none',
                      backgroundColor: 'transparent',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                      fontFamily: 'var(--font-sans)',
                      width: '100%',
                    }}
                  />
                </div>
              )}

              <div
                ref={listRef}
                style={{
                  overflowY: 'auto',
                  padding: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                }}
              >
                {filteredOptions.length === 0 ? (
                  <div
                    style={{
                      padding: '10px 12px',
                      fontSize: 12,
                      color: 'var(--text-tertiary)',
                      textAlign: 'center',
                    }}
                  >
                    Tidak ada hasil yang cocok
                  </div>
                ) : (
                  filteredOptions.map((opt, idx) => {
                    const isSelected = opt.value === currentValue;
                    const isHighlighted = idx === highlightIdx;

                    return (
                      <button
                        key={`${opt.value}_${idx}`}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        data-opt-idx={idx}
                        disabled={opt.disabled}
                        onMouseEnter={() => setHighlightIdx(idx)}
                        onClick={() => !opt.disabled && selectValue(opt.value)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          width: '100%',
                          minHeight: 30,
                          padding: '5px 8px',
                          borderRadius: 'var(--radius-control)',
                          border: 'none',
                          backgroundColor: isSelected
                            ? 'var(--accent-subtle)'
                            : isHighlighted
                              ? 'var(--bg-raised)'
                              : 'transparent',
                          color: isSelected
                            ? 'var(--accent)'
                            : 'var(--text-primary)',
                          fontSize: 'var(--text-label)',
                          fontFamily: 'var(--font-sans)',
                          fontWeight: isSelected ? 600 : 400,
                          textAlign: 'left',
                          cursor: opt.disabled ? 'not-allowed' : 'pointer',
                          opacity: opt.disabled ? 0.45 : 1,
                          outline: 'none',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {renderOptionLabel(opt.label)}
                        </div>
                        {isSelected && (
                          <Check
                            size={13}
                            strokeWidth={2.2}
                            color="var(--accent)"
                            style={{ flexShrink: 0 }}
                          />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>,
            document.body
          )}

        {error && (
          <span style={{ fontSize: 'var(--text-caption)', color: 'var(--status-danger)' }}>
            {error}
          </span>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
