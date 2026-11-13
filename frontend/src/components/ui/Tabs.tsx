export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  hasError?: boolean;
}

export interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
}

export function Tabs<T extends string = string>({ tabs, activeTab, onChange }: TabsProps<T>) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        borderBottom: '1px solid var(--border)',
        padding: '0 8px',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 36,
              padding: '0 12px',
              fontSize: 'var(--text-body)',
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              outline: 'none',
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <span>{tab.label}</span>
            {tab.hasError && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: 'var(--status-danger)',
                }}
              />
            )}
            {isActive && (
              <div
                style={{
                  position: 'absolute',
                  bottom: -1,
                  left: 8,
                  right: 8,
                  height: 2,
                  backgroundColor: 'var(--accent)',
                  borderRadius: '1px 1px 0 0',
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
