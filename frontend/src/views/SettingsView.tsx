import { useEffect, useState } from 'react';
import { Checkbox } from '../components/Checkbox';
import { AppSettings } from '../types';

interface SettingsViewProps {
  settings: AppSettings;
  onSave: (settings: Partial<AppSettings>) => Promise<void>;
}

export function SettingsView({ settings, onSave }: SettingsViewProps) {
  const [browserPath, setBrowserPath] = useState('');
  const [startUrl, setStartUrl] = useState('');
  const [maskWebRTC, setMaskWebRTC] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBrowserPath(settings.browser_path || '');
    setStartUrl(settings.start_url || 'https://browserleaks.com/canvas');
    setMaskWebRTC(settings.mask_webrtc ?? true);
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
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#ffffff' }}>Settings</h2>
      </header>

      <section style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
        <form
          onSubmit={handleSave}
          style={{
            maxWidth: 640,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {/* Card 1: Browser Engine */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#ffffff', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
              Browser Engine Configuration
            </div>

            {settings.browsers && settings.browsers.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)' }}>
                  Detected Chromium Engines on this PC:
                </label>
                <select
                  value={browserPath}
                  onChange={(e) => setBrowserPath(e.target.value)}
                  style={{
                    backgroundColor: '#0e111b',
                    border: '1px solid var(--border)',
                    borderRadius: 5,
                    padding: '8px 12px',
                    fontSize: 12.5,
                    color: 'var(--text-main)',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">(Default Auto-Detected: {settings.active_browser_path})</option>
                  {settings.browsers.map((b, i) => (
                    <option key={i} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)' }}>
                Custom Browser Executable Path:
              </label>
              <input
                type="text"
                value={browserPath}
                onChange={(e) => setBrowserPath(e.target.value)}
                placeholder="C:\Path\To\chrome.exe"
                style={{
                  backgroundColor: '#0e111b',
                  border: '1px solid var(--border)',
                  borderRadius: 5,
                  padding: '8px 12px',
                  fontSize: 13,
                  color: 'var(--text-main)',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Card 2: Anti-Detect Shield */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#ffffff', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
              Default Navigation & Anti-Detect Shield
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)' }}>
                Default Launch URL:
              </label>
              <input
                type="text"
                value={startUrl}
                onChange={(e) => setStartUrl(e.target.value)}
                placeholder="https://browserleaks.com/canvas"
                style={{
                  backgroundColor: '#0e111b',
                  border: '1px solid var(--border)',
                  borderRadius: 5,
                  padding: '8px 12px',
                  fontSize: 13,
                  color: 'var(--text-main)',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <Checkbox
                checked={maskWebRTC}
                ariaLabel="Aktifkan Proteksi WebRTC"
                onChange={setMaskWebRTC}
              />
              <label
                onClick={() => setMaskWebRTC(!maskWebRTC)}
                style={{ fontSize: 12.5, color: 'var(--text-main)', cursor: 'pointer' }}
              >
                Enable WebRTC IP Leak Prevention (Masks local LAN IP candidates)
              </label>
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{ padding: '8px 20px', fontSize: 13 }}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
