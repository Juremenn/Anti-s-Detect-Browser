import { useEffect, useRef } from 'react';

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

  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        position: 'relative',
        width: 18,
        height: 18,
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
          appearance: 'none',
          WebkitAppearance: 'none',
          width: 17,
          height: 17,
          margin: 0,
          backgroundColor: checked || indeterminate ? 'var(--primary)' : '#121522',
          border: `1.5px solid ${
            checked || indeterminate ? 'var(--primary)' : '#2d354d'
          }`,
          borderRadius: 4,
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          transition: 'all 0.12s ease',
          display: 'grid',
          placeContent: 'center',
        }}
      />
      {checked && !indeterminate && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            position: 'absolute',
            width: 10,
            height: 10,
            pointerEvents: 'none',
          }}
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {indeterminate && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth="4"
          strokeLinecap="round"
          style={{
            position: 'absolute',
            width: 9,
            height: 9,
            pointerEvents: 'none',
          }}
        >
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      )}
    </label>
  );
}
