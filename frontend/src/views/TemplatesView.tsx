import { Preset } from '../types';

interface TemplatesViewProps {
  presets: Preset[];
  onApplyPreset: (presetIndex: number, preset: Preset) => void;
}

export function TemplatesView({ presets, onApplyPreset }: TemplatesViewProps) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <header
        style={{
          height: 60,
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          flexShrink: 0,
        }}
      >
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#ffffff' }}>Hardware & Fingerprint Templates</h2>
      </header>

      <section style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: 16,
          }}
        >
          {presets.map((preset, idx) => {
            const isMac = preset.platform.toLowerCase().includes('mac');

            return (
              <div
                key={idx}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  transition: 'border-color 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {isMac ? (
                      <svg viewBox="0 0 170 170" width="22" height="22" fill="#94a3b8">
                        <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.08-7.77-7.92-12.23-14.51-6.19-9.17-11.05-19.65-14.59-31.44-3.53-11.8-5.3-23.01-5.3-33.64 0-14.04 3.65-25.75 10.95-35.15 7.3-9.4 16.51-14.18 27.63-14.35 5.18 0 10.77 1.43 16.76 4.31 5.99 2.87 9.87 4.38 11.64 4.54 1.54 0 5.49-1.57 11.86-4.71 6.37-3.14 11.97-4.47 16.8-4.01 12.82.78 22.95 5.75 30.38 14.93-11.19 6.78-16.65 16.14-16.37 28.09.28 9.58 3.99 17.58 11.13 24 7.14 6.42 15.69 10.05 25.64 10.88-2.13 6.64-4.87 13.52-8.21 20.65zM119.22 31.81c0-7.35 2.65-14.4 7.95-21.14 5.3-6.75 11.97-10.67 20.02-11.77.14 1.13.21 2.14.21 3.03 0 7.34-2.78 14.36-8.34 21.05-5.56 6.7-12.27 10.46-20.13 11.27-.22-.81-.33-1.63-.33-2.44z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 88 88" width="20" height="20" fill="#38bdf8">
                        <path d="M0 12.4L35.7 7.5V42H0V12.4zM0 45.6H35.7V80.1L0 75.3V45.6zM39.4 7V42H87.3V0L39.4 7zM39.4 45.6H87.3V87.6L39.4 80.6V45.6z" />
                      </svg>
                    )}
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: '#ffffff' }}>
                      {preset.label}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      backgroundColor: 'rgba(56, 189, 248, 0.1)',
                      color: '#38bdf8',
                      border: '1px solid rgba(56, 189, 248, 0.2)',
                      padding: '2px 8px',
                      borderRadius: 4,
                    }}
                  >
                    Preset #{idx + 1}
                  </span>
                </div>

                <div
                  style={{
                    backgroundColor: '#0d101b',
                    borderRadius: 6,
                    padding: '10px 12px',
                    fontSize: 11.5,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-dim)' }}>WebGL Renderer:</span>
                    <span style={{ color: '#e2e8f0', fontWeight: 500, maxWidth: 220, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {preset.gpu_renderer}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-dim)' }}>CPU Cores & RAM:</span>
                    <span style={{ color: '#e2e8f0', fontWeight: 500 }}>
                      {preset.cores} Cores / {preset.memory_gb} GB RAM
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-dim)' }}>Resolution:</span>
                    <span style={{ color: '#e2e8f0', fontWeight: 500 }}>
                      {preset.screen[0]} x {preset.screen[1]}
                    </span>
                  </div>
                </div>

                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', marginTop: 'auto' }}
                  onClick={() => onApplyPreset(idx, preset)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                  </svg>
                  Create Profile from Template
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
