import { Monitor } from 'lucide-react';
import { t } from '../i18n';
import { Preset } from '../types';
import { parseGpuName } from '../utils/formatters';

interface TemplatesViewProps {
  presets: Preset[];
  onApplyPreset: (presetIndex: number, preset: Preset) => void;
}

export function TemplatesView({ presets, onApplyPreset }: TemplatesViewProps) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <header
        style={{
          height: 48,
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: -0.2 }}>
            {t.templates.title}
          </h2>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--text-tertiary)',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              padding: '1px 6px',
              borderRadius: 4,
              fontFamily: 'var(--font-mono)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {presets.length}
          </span>
        </div>
      </header>

      {/* Grid List */}
      <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 12,
          }}
        >
          {presets.map((preset, idx) => {
            const gpuClean = parseGpuName(preset.gpu_renderer);

            return (
              <div
                key={idx}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-panel)',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  transition: 'border-color 140ms ease-out',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--text-tertiary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Monitor size={15} strokeWidth={1.5} color="var(--text-secondary)" />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {preset.label}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      color: 'var(--text-tertiary)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    #{idx + 1}
                  </span>
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--bg-raised)',
                    borderRadius: 'var(--radius-control)',
                    padding: '8px 10px',
                    fontSize: 11.5,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>GPU:</span>
                    <span
                      style={{ color: 'var(--text-primary)', fontWeight: 500 }}
                      title={preset.gpu_renderer}
                    >
                      {gpuClean}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>CPU / RAM:</span>
                    <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {preset.cores} Cores · {preset.memory_gb} GB
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>Screen:</span>
                    <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {preset.screen ? `${preset.screen[0]} × ${preset.screen[1]}` : '1920 × 1080'}
                    </span>
                  </div>
                </div>

                <button
                  className="btn btn-ghost"
                  style={{ width: '100%', height: 28, fontSize: 12 }}
                  onClick={() => onApplyPreset(idx, preset)}
                >
                  {t.templates.useTemplate}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
