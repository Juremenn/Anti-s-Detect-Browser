export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string = string> {
  value: T;
  onChange: (val: T) => void;
  options: SegmentOption<T>[] | string[];
  size?: 'sm' | 'md';
}

export function SegmentedControl<T extends string = string>({
  value,
  onChange,
  options,
  size = 'md',
}: SegmentedControlProps<T>) {
  const isSm = size === 'sm';
  const height = isSm ? 'var(--control-height-sm)' : 'var(--control-height)';
  const itemHeight = isSm ? '24px' : '30px';
  const fontSize = isSm ? 'var(--text-caption)' : 'var(--text-label)';

  const normalizedOptions: SegmentOption<T>[] = options.map((opt) =>
    typeof opt === 'string' ? { value: opt as T, label: opt } : opt
  );

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        backgroundColor: 'var(--bg-raised)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-control)',
        padding: 2,
        gap: 2,
        height,
      }}
    >
      {normalizedOptions.map((opt) => {
        const isActive = opt.value === value;

        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              height: itemHeight,
              padding: '0 12px',
              borderRadius: 'calc(var(--radius-control) - 2px)',
              border: 'none',
              backgroundColor: isActive ? 'var(--bg-surface)' : 'transparent',
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize,
              fontWeight: isActive ? 600 : 500,
              cursor: 'pointer',
              outline: 'none',
              whiteSpace: 'nowrap',
              boxShadow: isActive ? '0 1px 3px rgba(15, 23, 42, 0.10)' : 'none',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
