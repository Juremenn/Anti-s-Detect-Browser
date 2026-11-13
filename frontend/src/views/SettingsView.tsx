import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Checkbox } from '../components/Checkbox';
import { t } from '../i18n';
import { AppSettings } from '../types';

interface SettingsViewProps {
  settings: AppSettings;
  onSave: (settings: Partial<AppSettings>) => Promise<void>;
}

export function SettingsView({ settings, onSave }: SettingsViewProps) {
  const [browserPath, setBrowserPath] = useState(settings?.browser_path || '');
  const [startUrl, setStartUrl] = useState(settings?.start_url || 'https://browserleaks.com/canvas');
  const [maskWebRTC, setMaskWebRTC] = useState(settings?.mask_webrtc ?? true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setBrowserPath(settings.browser_path || '');
      setStartUrl(settings.start_url || 'https://browserleaks.com/canvas');
      setMaskWebRTC(settings.mask_webrtc ?? true);
    }
  }, [settings]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        browser_path: browserPath.trim(),
        start_url: startUrl.trim() || 'https://browserleaks.com/canvas',
        mask_webrtc: maskWebRTC,
      });
    } finally {
      setSaving(false);
    }
  }

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
        <h2 style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: -0.2 }}>
          {t.settings.title}
        </h2>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          <Save size={13} strokeWidth={2} />
          <span>{saving ? t.settings.saving : t.settings.saveChanges}</span>
        </button>
      </header>

      {/* Settings Form */}
      <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
        <form
          onSubmit={handleSave}
          style={{
            maxWidth: 600,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {/* Chromium Executable */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-panel)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                {t.settings.browserPath}
              </label>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                {t.settings.browserPathHelp}
              </div>
            </div>

            {settings.browsers && settings.browsers.length > 0 && (
              <select
                className="input-field"
                value={browserPath}
                onChange={(e) => setBrowserPath(e.target.value)}
                style={{ cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11.5 }}
              >
                <option value="">(Auto-Detect: {settings.active_browser_path || 'None'})</option>
                {settings.browsers.map((b, i) => {
                  const bPath = typeof b === 'string' ? b : b.path;
                  const bName = typeof b === 'string' ? b : `${b.name} (${b.path})`;
                  return (
                    <option key={i} value={bPath} style={{ backgroundColor: 'var(--bg-surface)' }}>
                      {bName}
                    </option>
                  );
                })}
              </select>
            )}

            <input
              type="text"
              className="input-field"
              value={browserPath}
              onChange={(e) => setBrowserPath(e.target.value)}
              placeholder="C:\Program Files\Google\Chrome\Application\chrome.exe"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}
            />
          </div>

          {/* Launch URL */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-panel)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                {t.settings.startUrl}
              </label>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                {t.settings.startUrlHelp}
              </div>
            </div>

            <input
              type="text"
              className="input-field"
              value={startUrl}
              onChange={(e) => setStartUrl(e.target.value)}
              placeholder="https://browserleaks.com/canvas"
            />
          </div>

          {/* WebRTC Masking */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-panel)',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                {t.settings.maskWebRTC}
              </label>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                {t.settings.maskWebRTCHelp}
              </div>
            </div>

            <Checkbox
              checked={maskWebRTC}
              onChange={setMaskWebRTC}
              ariaLabel={t.settings.maskWebRTC}
            />
          </div>
        </form>
      </div>
    </div>
  );
}
