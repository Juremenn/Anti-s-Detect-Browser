export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, disabled = false }: SwitchProps) {
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <div
        tabIndex={disabled ? -1 : 0}
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        onKeyDown={(e) => {
          if (!disabled && (e.key === ' ' || e.key === 'Enter')) {
            e.preventDefault();
            onChange(!checked);
          }
        }}
        style={{
          width: 32,
          height: 18,
          borderRadius: 10,
          backgroundColor: checked ? 'var(--accent)' : 'var(--border-strong)',
          position: 'relative',
          transition: 'background-color 140ms ease-out',
          outline: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            backgroundColor: '#FFFFFF',
            position: 'absolute',
            top: 2,
            left: checked ? 16 : 2,
            transition: 'left 140ms ease-out',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}
        />
      </div>
      {label && (
        <span style={{ fontSize: 'var(--text-label)', color: 'var(--text-primary)' }}>
          {label}
        </span>
      )}
    </label>
  );
}
