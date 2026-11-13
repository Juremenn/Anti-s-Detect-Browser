import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';

export interface ComboboxProps {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
  allowCustom?: boolean;
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Select or type...',
  allowCustom = true,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(query.toLowerCase().trim())
  );

  const canCreate =
    allowCustom &&
    query.trim().length > 0 &&
    !options.some((o) => o.toLowerCase() === query.trim().toLowerCase());

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
        <input
          type="text"
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          style={{
            height: 'var(--control-height)',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-control)',
            padding: '0 28px 0 10px',
            fontSize: 'var(--text-body)',
            color: 'var(--text-primary)',
            outline: 'none',
            width: '100%',
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setOpen(!open)}
          style={{
            position: 'absolute',
            right: 6,
            background: 'none',
            border: 'none',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ChevronDown size={14} strokeWidth={1.5} />
        </button>
      </div>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            backgroundColor: 'var(--bg-overlay)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-control)',
            boxShadow: 'var(--shadow-popover)',
            maxHeight: 180,
            overflowY: 'auto',
            zIndex: 1000,
            padding: 4,
          }}
        >
          {filtered.map((opt) => (
            <div
              key={opt}
              onClick={() => {
                onChange(opt);
                setQuery(opt);
                setOpen(false);
              }}
              style={{
                padding: '6px 10px',
                fontSize: 'var(--text-label)',
                borderRadius: 4,
                cursor: 'pointer',
                color: opt === value ? 'var(--accent)' : 'var(--text-primary)',
                backgroundColor: opt === value ? 'var(--accent-subtle)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-raised)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor =
                  opt === value ? 'var(--accent-subtle)' : 'transparent';
              }}
            >
              {opt}
            </div>
          ))}

          {canCreate && (
            <div
              onClick={() => {
                onChange(query.trim());
                setOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                fontSize: 'var(--text-label)',
                borderRadius: 4,
                cursor: 'pointer',
                color: 'var(--accent)',
                borderTop: '1px solid var(--border)',
                marginTop: 4,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-raised)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Plus size={13} strokeWidth={2} />
              <span>Create "{query.trim()}"</span>
            </div>
          )}

          {filtered.length === 0 && !canCreate && (
            <div
              style={{
                padding: '8px 10px',
                fontSize: 'var(--text-caption)',
                color: 'var(--text-tertiary)',
                textAlign: 'center',
              }}
            >
              No options
            </div>
          )}
        </div>
      )}
    </div>
  );
}

