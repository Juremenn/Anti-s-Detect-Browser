import { useEffect, useRef } from 'react';
import { Check, Minus } from 'lucide-react';

interface CheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel?: string;
  disabled?: boolean;
}

export function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  ariaLabel,
  disabled = false,
}: CheckboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  const isCheckedOrIndeterminate = checked || indeterminate;

  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        position: 'relative',
        width: 16,
        height: 16,
      }}
    >
      <input
        ref={inputRef}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          position: 'absolute',
          opacity: 0,
          width: 0,
          height: 0,
          margin: 0,
          pointerEvents: 'none',
        }}
      />
      <div
        tabIndex={disabled ? -1 : 0}
        role="checkbox"
        aria-checked={indeterminate ? 'mixed' : checked}
        onKeyDown={(e) => {
          if (!disabled && (e.key === ' ' || e.key === 'Enter')) {
            e.preventDefault();
            onChange(!checked);
          }
        }}
        style={{
          width: 15,
          height: 15,
          borderRadius: 4,
          backgroundColor: isCheckedOrIndeterminate ? 'var(--accent)' : 'var(--bg-surface)',
          border: `1px solid ${isCheckedOrIndeterminate ? 'var(--accent)' : 'var(--border)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 120ms ease-out',
          outline: 'none',
        }}
        onMouseEnter={(e) => {
          if (!disabled && !isCheckedOrIndeterminate) {
            e.currentTarget.style.borderColor = 'var(--text-secondary)';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && !isCheckedOrIndeterminate) {
            e.currentTarget.style.borderColor = 'var(--border)';
          }
        }}
        onFocus={(e) => {
          if (!disabled) {
            e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent-ring)';
            e.currentTarget.style.borderColor = 'var(--accent)';
          }
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = 'none';
          if (!isCheckedOrIndeterminate) {
            e.currentTarget.style.borderColor = 'var(--border)';
          }
        }}
      >
        {indeterminate ? (
          <Minus size={11} strokeWidth={2.5} color="#FFFFFF" />
        ) : checked ? (
          <Check size={11} strokeWidth={2.5} color="#FFFFFF" />
        ) : null}
      </div>
    </label>
  );
}
