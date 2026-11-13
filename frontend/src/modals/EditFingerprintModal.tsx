import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Modal } from '../components/Modal';
import { t } from '../i18n';
import { api } from '../api';
import { CustomFingerprint, Profile } from '../types';

interface EditFingerprintModalProps {
  isOpen: boolean;
  profile: Profile | null;
  onClose: () => void;
  onSaved: (name: string) => void;
}

export function EditFingerprintModal({
  isOpen,
  profile,
  onClose,
  onSaved,
}: EditFingerprintModalProps) {
  const [platform, setPlatform] = useState('Win32');
  const [cores, setCores] = useState('8');
  const [memory, setMemory] = useState('8');
  const [colorDepth, setColorDepth] = useState('24');
  const [width, setWidth] = useState('1920');
  const [height, setHeight] = useState('1080');
  const [vendor, setVendor] = useState('');
  const [renderer, setRenderer] = useState('');
  const [userAgent, setUserAgent] = useState('');
  const [languages, setLanguages] = useState('');
  const [loading, setLoading] = useState(false);
  const [rerolling, setRerolling] = useState(false);
  const [error, setError] = useState('');
  const [initializedFor, setInitializedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !profile || initializedFor === profile.name) return;
    setInitializedFor(profile.name);
    setPlatform(profile.platform === 'MacIntel' ? 'MacIntel' : 'Win32');
    setCores(String(profile.hardware_concurrency ?? 8));
    setMemory(String(profile.device_memory ?? 8));
    setColorDepth(String(profile.color_depth ?? 24));
    setWidth(String(profile.screen_width ?? 1920));
    setHeight(String(profile.screen_height ?? 1080));
    setVendor(profile.webgl_vendor || '');
    setRenderer(profile.webgl_renderer || '');
    setUserAgent(profile.user_agent || '');
    setLanguages((profile.languages || []).join(', '));
    setError('');
  }, [isOpen, profile, initializedFor]);

  if (!isOpen || !profile) return null;
  const isRunning = Boolean(profile.is_active);
  const canvasSeed = profile.canvas_seed ?? '-';
  const audioSeed = profile.audio_seed ?? '-';
  const fontSeed = profile.font_seed ?? '-';

  function collectFields(): CustomFingerprint {
    const fields: CustomFingerprint = {
      platform,
      hardware_concurrency: cores,
      device_memory: memory,
      screen_width: width,
      screen_height: height,
      languages,
      color_depth: colorDepth,
    };
    // Backend rejects empty strings for these; omit them to keep current values.
    if (vendor.trim()) fields.webgl_vendor = vendor.trim();
    if (renderer.trim()) fields.webgl_renderer = renderer.trim();
    if (userAgent.trim()) fields.user_agent = userAgent.trim();
    return fields;
  }

  async function handleSave() {
    if (!profile) return;
    setLoading(true);
    setError('');
    try {
      await api.setFingerprint(profile.name, collectFields());
      onSaved(profile.name);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleReroll() {
    if (!profile) return;
    if (!window.confirm(t.modal.rerollConfirm)) return;
    setRerolling(true);
    setError('');
    try {
      const res = await api.refreshFingerprint(profile.name);
      const fp = res.profile || {};
      setPlatform(fp.platform === 'MacIntel' ? 'MacIntel' : 'Win32');
      setCores(String(fp.hardware_concurrency ?? 8));
      setMemory(String(fp.device_memory ?? 8));
      setColorDepth(String(fp.color_depth ?? 24));
      setWidth(String(fp.screen_width ?? 1920));
      setHeight(String(fp.screen_height ?? 1080));
      setVendor(fp.webgl_vendor || '');
      setRenderer(fp.webgl_renderer || '');
      setUserAgent(fp.user_agent || '');
      setLanguages((fp.languages || []).join(', '));
      onSaved(profile.name);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRerolling(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      title={t.modal.editFingerprintTitle(profile.name)}
      onClose={onClose}
      maxWidth={560}
      footer={
        <>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleReroll}
            disabled={isRunning || rerolling || loading}
          >
            <RefreshCw size={14} className={rerolling ? 'spin' : undefined} />
            {rerolling ? '...' : t.modal.reroll}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={loading}
          >
            {t.modal.cancel}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={isRunning || loading || rerolling}
          >
            {loading ? '...' : t.modal.save}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {isRunning && (
          <div
            style={{
              padding: '6px 10px',
              backgroundColor: 'rgba(245, 183, 64, 0.12)',
              border: '1px solid var(--status-warning)',
              borderRadius: 'var(--radius-control)',
              fontSize: 12,
              color: 'var(--status-warning)',
            }}
          >
            {t.modal.runningWarning}
          </div>
        )}
        {error && (
          <div
            style={{
              padding: '6px 10px',
              backgroundColor: 'rgba(242, 85, 90, 0.1)',
              border: '1px solid var(--status-danger)',
              borderRadius: 'var(--radius-control)',
              fontSize: 12,
              color: 'var(--status-danger)',
            }}
          >
            {error}
          </div>
        )}

        <div className="fp-grid">
          <div>
            <label className="field-label">{t.modal.platform}</label>
            <select
              className="input-field"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              disabled={isRunning}
            >
              <option value="Win32">Windows (Win32)</option>
              <option value="MacIntel">macOS (MacIntel)</option>
            </select>
          </div>
          <div>
            <label className="field-label">{t.modal.ram}</label>
            <select
              className="input-field"
              value={memory}
              onChange={(e) => setMemory(e.target.value)}
              disabled={isRunning}
            >
              {['0.5', '1', '2', '4', '8'].map((m) => (
                <option key={m} value={m}>
                  {m} GB
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">{t.modal.cores}</label>
            <input
              type="number"
              className="input-field"
              min={1}
              max={128}
              value={cores}
              onChange={(e) => setCores(e.target.value)}
              disabled={isRunning}
            />
          </div>
          <div>
            <label className="field-label">{t.modal.colorDepth}</label>
            <select
              className="input-field"
              value={colorDepth}
              onChange={(e) => setColorDepth(e.target.value)}
              disabled={isRunning}
            >
              <option value="24">24-bit</option>
              <option value="30">30-bit</option>
            </select>
          </div>
          <div>
            <label className="field-label">{t.modal.resWidth}</label>
            <input
              type="number"
              className="input-field"
              min={400}
              max={7680}
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              disabled={isRunning}
            />
          </div>
          <div>
            <label className="field-label">{t.modal.resHeight}</label>
            <input
              type="number"
              className="input-field"
              min={400}
              max={7680}
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              disabled={isRunning}
            />
          </div>
          <div className="fp-full">
            <label className="field-label">{t.modal.webglVendor}</label>
            <input
              type="text"
              className="input-field"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              disabled={isRunning}
            />
          </div>
          <div className="fp-full">
            <label className="field-label">{t.modal.webglRenderer}</label>
            <input
              type="text"
              className="input-field"
              value={renderer}
              onChange={(e) => setRenderer(e.target.value)}
              disabled={isRunning}
            />
          </div>
          <div className="fp-full">
            <label className="field-label">{t.modal.userAgent}</label>
            <input
              type="text"
              className="input-field"
              value={userAgent}
              onChange={(e) => setUserAgent(e.target.value)}
              disabled={isRunning}
            />
          </div>
          <div className="fp-full">
            <label className="field-label">{t.modal.languages}</label>
            <input
              type="text"
              className="input-field"
              value={languages}
              onChange={(e) => setLanguages(e.target.value)}
              disabled={isRunning}
            />
          </div>
        </div>

        <div className="field-hint">{t.modal.storedSeeds(canvasSeed, audioSeed, fontSeed)}</div>
      </div>
    </Modal>
  );
}
