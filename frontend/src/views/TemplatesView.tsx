import { useMemo, useState } from 'react';
import { Laptop, Monitor, Search, Smartphone, Tablet, X } from 'lucide-react';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { t } from '../i18n';
import { Preset } from '../types';
import { parseGpuName } from '../utils/formatters';

interface TemplatesViewProps {
  presets: Preset[];
  onApplyPreset: (presetIndex: number, preset: Preset) => void;
}

export function TemplatesView({ presets, onApplyPreset }: TemplatesViewProps) {
  const [osFilter, setOsFilter] = useState<'all' | 'win' | 'mac' | 'ios' | 'android'>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return presets
      .map((preset, idx) => ({ preset, idx }))
      .filter(({ preset }) => {
        if (osFilter !== 'all' && preset.os && preset.os !== osFilter) {
          return false;
        }
        if (!q) return true;
        return (
          (preset.label || '').toLowerCase().includes(q) ||
          (preset.name || '').toLowerCase().includes(q) ||
          (preset.gpu_renderer || '').toLowerCase().includes(q) ||
          (preset.platform || '').toLowerCase().includes(q)
        );
      });
  }, [presets, osFilter, query]);

  function getCategoryIcon(cat?: string) {
    switch (cat) {
      case 'mobile':
        return <Smartphone size={15} strokeWidth={1.5} color="var(--accent)" style={{ flexShrink: 0 }} />;
      case 'tablet':
        return <Tablet size={15} strokeWidth={1.5} color="var(--accent)" style={{ flexShrink: 0 }} />;
      case 'desktop':
        return <Monitor size={15} strokeWidth={1.5} color="var(--accent)" style={{ flexShrink: 0 }} />;
      default:
        return <Laptop size={15} strokeWidth={1.5} color="var(--accent)" style={{ flexShrink: 0 }} />;
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
          gap: 12,
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
              backgroundColor: 'var(--bg-raised)',
              padding: '1px 6px',
              borderRadius: 4,
              fontFamily: 'var(--font-sans)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {filtered.length} / {presets.length}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: 220 }}>
            <Search
              size={13}
              strokeWidth={1.5}
              color="var(--text-tertiary)"
              style={{ position: 'absolute', left: 8, pointerEvents: 'none' }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari GPU, OS, resolusi..."
              style={{
                width: '100%',
                height: 'var(--control-height-sm)',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-control)',
                paddingLeft: 26,
                paddingRight: query ? 24 : 8,
                fontSize: 'var(--text-label)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                style={{
                  position: 'absolute',
                  right: 6,
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 2,
                }}
              >
                <X size={12} strokeWidth={1.5} />
              </button>
            )}
          </div>

          <SegmentedControl
            size="sm"
            value={osFilter}
            onChange={(v) => setOsFilter(v as typeof osFilter)}
            options={[
              { value: 'all', label: 'All' },
              { value: 'win', label: 'Windows' },
              { value: 'mac', label: 'macOS' },
              { value: 'ios', label: 'iOS' },
              { value: 'android', label: 'Android' },
            ]}
          />
        </div>
      </header>

      <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
            gap: 12,
          }}
        >
          {filtered.map(({ preset, idx }) => {
            const gpuClean = parseGpuName(preset.gpu_renderer || preset.webgl_renderer);

            return (
              <div
                key={preset.id || idx}
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
                  e.currentTarget.style.borderColor = 'var(--border-strong)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    {getCategoryIcon(preset.category)}
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={preset.label}
                    >
                      {preset.label}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      color: 'var(--text-tertiary)',
                      fontFamily: 'var(--font-mono)',
                      flexShrink: 0,
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>GPU:</span>
                    <span
                      style={{
                        color: 'var(--text-primary)',
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={preset.gpu_renderer || preset.webgl_renderer}
                    >
                      {gpuClean}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>CPU / RAM:</span>
                    <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {preset.cores || preset.hardware_concurrency || 8} Cores · {preset.memory_gb || preset.device_memory || 8} GB
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>Screen:</span>
                    <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {preset.screen ? `${preset.screen[0]} × ${preset.screen[1]}` : '1920 × 1080'}
                      {preset.device_pixel_ratio ? ` @${preset.device_pixel_ratio}x` : ''}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ width: '100%', height: 28, fontSize: 12, border: '1px solid var(--border)' }}
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
