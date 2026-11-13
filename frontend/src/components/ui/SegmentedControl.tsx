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
  const itemHeight = isSm ? '22px' : '26px';
  const fontSize = isSm ? 'var(--text-caption)' : 'var(--text-label)';

  const normalizedOptions: SegmentOption<T>[] = options.map((opt) =>
    typeof opt === 'string' ? { value: opt as T, label: opt } : opt
  );

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        backgroundColor: 'var(--bg-surface)',
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
              padding: '0 10px',
              borderRadius: 'calc(var(--radius-control) - 2px)',
              border: 'none',
              backgroundColor: isActive ? 'var(--bg-raised)' : 'transparent',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize,
              fontWeight: isActive ? 600 : 500,
              cursor: 'pointer',
              outline: 'none',
              whiteSpace: 'nowrap',
              boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.backgroundColor = 'var(--bg-row-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.backgroundColor = 'transparent';
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
