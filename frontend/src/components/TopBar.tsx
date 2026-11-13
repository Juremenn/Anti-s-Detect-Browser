interface TopBarProps {
  onNewProfile: () => void;
  onQuickProfile: () => void;
  onTestFingerprint: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
}

export function TopBar({
  onNewProfile,
  onQuickProfile,
  onTestFingerprint,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}: TopBarProps) {
  return (
    <header
      style={{
        height: 60,
        backgroundColor: 'var(--bg-base)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="btn btn-primary" onClick={onNewProfile}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          New Profile
        </button>
        <button className="btn btn-secondary" onClick={onQuickProfile}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 2v11h3v9l7-12h-4l4-8z" />
          </svg>
          Quick Profile
        </button>
        <button className="btn btn-secondary" onClick={onTestFingerprint}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
          </svg>
          Test Fingerprint
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Search Box */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="currentColor"
            style={{
              position: 'absolute',
              left: 10,
              color: 'var(--text-dim)',
              pointerEvents: 'none',
            }}
          >
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search profiles..."
            style={{
              backgroundColor: '#121624',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '6px 12px 6px 30px',
              fontSize: 12.5,
              color: 'var(--text-main)',
              width: 220,
              outline: 'none',
              transition: 'border-color 0.15s ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          style={{
            backgroundColor: '#121624',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '6px 12px',
            fontSize: 12.5,
            color: 'var(--text-main)',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="all">Status: Semua</option>
          <option value="active">Aktif</option>
          <option value="ready">Siap</option>
        </select>
      </div>
    </header>
  );
}
