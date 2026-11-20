import { useEffect, useState } from 'react';
import { ChevronRight, Monitor, Moon, Save, Sun } from 'lucide-react';
import { api } from '../api';
import { Checkbox } from '../components/Checkbox';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Select } from '../components/ui/Select';
import { t } from '../i18n';
import { AppSettings, ThemeMode } from '../types';

interface SettingsViewProps {
  settings: AppSettings;
  onSave: (settings: Partial<AppSettings>) => Promise<void>;
  themeMode?: ThemeMode;
  onChangeThemeMode?: (mode: ThemeMode) => void;
}

export function SettingsView({
  settings,
  onSave,
  themeMode = 'light',
  onChangeThemeMode,
}: SettingsViewProps) {
  const [browserPath, setBrowserPath] = useState(settings?.browser_path || '');
  const [startUrl, setStartUrl] = useState(settings?.start_url || 'https://browserleaks.com/canvas');
  const [maskWebRTC, setMaskWebRTC] = useState(settings?.mask_webrtc ?? true);
  const [googleClientId, setGoogleClientId] = useState(settings?.google_client_id || '');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [showAdvancedOAuth, setShowAdvancedOAuth] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setBrowserPath(settings.browser_path || '');
      setStartUrl(settings.start_url || 'https://browserleaks.com/canvas');
      setMaskWebRTC(settings.mask_webrtc ?? true);
      setGoogleClientId(settings.google_client_id || '');
    }
  }, [settings]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setOauthError(null);
    setSaving(true);
    try {
      const trimmedClientId = googleClientId.trim();
      const origClientId = (settings?.google_client_id || '').trim();
      if (trimmedClientId && (trimmedClientId !== origClientId || googleClientSecret.trim() !== '')) {
        await api.saveAuthConfig(
          trimmedClientId,
          googleClientSecret.trim() || undefined,
        );
        setGoogleClientSecret('');
      }
      await onSave({
        browser_path: browserPath.trim(),
        start_url: startUrl.trim() || 'https://browserleaks.com/canvas',
        mask_webrtc: maskWebRTC,
      });
    } catch (err: unknown) {
      setOauthError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
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

      <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
        <form
          onSubmit={handleSave}
          style={{
            maxWidth: 620,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {/* Appearance / Theme */}
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {t.settings.appearanceTitle}
                </label>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {t.settings.appearanceHelp}
                </div>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--accent)' }}>
                {themeMode === 'light' ? (
                  <Sun size={16} strokeWidth={1.75} />
                ) : themeMode === 'dark' ? (
                  <Moon size={16} strokeWidth={1.75} />
                ) : (
                  <Monitor size={16} strokeWidth={1.75} />
                )}
              </div>
            </div>

            {onChangeThemeMode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ width: 220 }}>
                  <Select
                    value={themeMode}
                    onValueChange={(val) => onChangeThemeMode(val as ThemeMode)}
                    options={[
                      { value: 'light', label: `${t.settings.themeLight} (Default)` },
                      { value: 'dark', label: t.settings.themeDark },
                      { value: 'system', label: t.settings.themeSystem },
                    ]}
                  />
                </div>
                <SegmentedControl
                  value={themeMode}
                  onChange={(val) => onChangeThemeMode(val as ThemeMode)}
                  options={[
                    { value: 'light', label: t.settings.themeLight },
                    { value: 'dark', label: t.settings.themeDark },
                    { value: 'system', label: t.settings.themeSystem },
                  ]}
                />
              </div>
            )}
          </div>

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
              <Select
                value={browserPath}
                onChange={(e) => setBrowserPath(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}
              >
                <option value="">
                  {`Auto-Detect · ${settings.active_browser_path || 'Default'}`}
                </option>
                {settings.browsers.map((b, i) => {
                  const bPath = typeof b === 'string' ? b : b.path;
                  const bName = typeof b === 'string' ? b : `${b.name} · ${b.path}`;
                  return (
                    <option key={i} value={bPath}>
                      {bName}
                    </option>
                  );
                })}
              </Select>
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

          {/* Collapsed Advanced Disclosure: Custom OAuth Credentials (Optional) */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-panel)',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => setShowAdvancedOAuth((prev) => !prev)}
              aria-expanded={showAdvancedOAuth}
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: 'transparent',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
                Advanced: Custom OAuth Credentials (Optional)
              </span>
              <ChevronRight
                size={14}
                strokeWidth={1.75}
                color="var(--text-tertiary)"
                aria-hidden="true"
                style={{
                  transform: showAdvancedOAuth ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 140ms ease-out',
                  flexShrink: 0,
                }}
              />
            </button>

            {showAdvancedOAuth && (
              <div
                style={{
                  padding: '0 16px 16px 16px',
                  borderTop: '1px solid var(--border)',
                  paddingTop: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.45 }}>
                  Leave blank to use the built-in application credentials. Only fill this in to override with your own Google Desktop OAuth Client.
                </div>

                {oauthError && (
                  <div
                    role="alert"
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      backgroundColor: '#FEF2F2',
                      border: '1px solid #FECACA',
                      color: '#B91C1C',
                      fontSize: 11.5,
                    }}
                  >
                    {oauthError}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label
                    htmlFor="settings-google-client-id"
                    style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-secondary)' }}
                  >
                    Custom OAuth Client ID
                  </label>
                  <input
                    id="settings-google-client-id"
                    type="text"
                    className="input-field"
                    value={googleClientId}
                    onChange={(e) => setGoogleClientId(e.target.value)}
                    placeholder="xxxxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label
                    htmlFor="settings-google-client-secret"
                    style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-secondary)' }}
                  >
                    {settings?.has_client_secret
                      ? 'Custom Client Secret (saved, leave blank to keep existing)'
                      : 'Custom Client Secret (optional)'}
                  </label>
                  <input
                    id="settings-google-client-secret"
                    type="password"
                    className="input-field"
                    value={googleClientSecret}
                    onChange={(e) => setGoogleClientSecret(e.target.value)}
                    placeholder="GOCSPX-..."
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}
                  />
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
