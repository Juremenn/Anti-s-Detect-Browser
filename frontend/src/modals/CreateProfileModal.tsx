import { useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { t } from '../i18n';
import { CreateProfilePayload, CustomFingerprint, Preset } from '../types';

interface CreateProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateProfilePayload) => Promise<void>;
  presets: Preset[];
  defaultPresetIdx?: number;
  initialName?: string;
}

function presetNum(p: Preset): number {
  return p.hardware_concurrency || p.cores || 8;
}

function presetMem(p: Preset): number {
  const mem = p.device_memory || p.memory_gb || 8;
  return Math.min(8, mem);
}

function presetScreen(p: Preset): [number, number] {
  if (p.screen) return p.screen;
  return [p.screen_width || 1920, p.screen_height || 1080];
}

export function CreateProfileModal({
  isOpen,
  onClose,
  onSubmit,
  presets,
  defaultPresetIdx = 0,
  initialName = '',
}: CreateProfileModalProps) {
  const [name, setName] = useState(initialName);
  const [presetVal, setPresetVal] = useState(String(defaultPresetIdx));
  const [lastPresetIdx, setLastPresetIdx] = useState(defaultPresetIdx);
  const [diversify, setDiversify] = useState(true);
  const [tags, setTags] = useState('');
  const [proxy, setProxy] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Custom fingerprint fields
  const [platform, setPlatform] = useState('Win32');
  const [cores, setCores] = useState('8');
  const [memory, setMemory] = useState('8');
  const [colorDepth, setColorDepth] = useState('24');
  const [width, setWidth] = useState('1920');
  const [height, setHeight] = useState('1080');
  const [vendor, setVendor] = useState('');
  const [renderer, setRenderer] = useState('');
  const [userAgent, setUserAgent] = useState('');
  const [languages, setLanguages] = useState('id-ID, id, en-US, en');

  const isCustom = presetVal === 'custom';

  function fillCustomFromPreset(idx: number) {
    const p = presets[idx];
    if (!p) return;
    setPlatform(p.platform === 'MacIntel' ? 'MacIntel' : 'Win32');
    setCores(String(presetNum(p)));
    setMemory(String(presetMem(p)));
    setColorDepth(String(p.color_depth || 24));
    const [w, h] = presetScreen(p);
    setWidth(String(w));
    setHeight(String(h));
    setVendor(p.webgl_vendor || '');
    setRenderer(p.webgl_renderer || '');
    setUserAgent(p.user_agent || '');
    setLanguages((p.languages || ['id-ID', 'id', 'en-US', 'en']).join(', '));
  }

  useEffect(() => {
    if (isOpen) {
      setName(initialName || `Profile_${Math.floor(100 + Math.random() * 900)}`);
      setPresetVal(String(defaultPresetIdx));
      setLastPresetIdx(defaultPresetIdx);
      setDiversify(true);
      setError('');
      setLoading(false);
    }
  }, [isOpen, initialName, defaultPresetIdx]);

  function handlePresetChange(value: string) {
    setPresetVal(value);
    if (value === 'custom') {
      fillCustomFromPreset(lastPresetIdx);
    } else {
      const idx = parseInt(value, 10) || 0;
      setLastPresetIdx(idx);
    }
  }

  function collectCustomFields(): CustomFingerprint {
    const fields: CustomFingerprint = {
      platform,
      hardware_concurrency: cores,
      device_memory: memory,
      screen_width: width,
      screen_height: height,
      languages,
      color_depth: colorDepth,
    };
    // Backend rejects empty strings for these; omit them to reuse preset values.
    if (vendor.trim()) fields.webgl_vendor = vendor.trim();
    if (renderer.trim()) fields.webgl_renderer = renderer.trim();
    if (userAgent.trim()) fields.user_agent = userAgent.trim();
    return fields;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError(t.modal.nameRequired);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const parsedTags = tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

      const payload: CreateProfilePayload = {
        name: cleanName,
        tags: parsedTags,
        proxy: proxy.trim() || null,
      };

      if (isCustom) {
        payload.preset = lastPresetIdx;
        payload.custom = collectCustomFields();
      } else {
        payload.preset = parseInt(presetVal, 10) || 0;
        payload.diversify = diversify;
      }

      await onSubmit(payload);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      title={t.modal.createProfileTitle}
      onClose={onClose}
      maxWidth={560}
      footer={
        <>
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
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? t.modal.creating : t.modal.create}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>
            {t.modal.profileName}
          </label>
          <input
            type="text"
            className="input-field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.modal.profileNamePlaceholder}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>
            {t.modal.preset}
          </label>
          <select
            className="input-field"
            value={presetVal}
            onChange={(e) => handlePresetChange(e.target.value)}
          >
            {presets.map((p, idx) => {
              const label =
                p.label ||
                `${p.os === 'mac' ? 'macOS' : p.os === 'linux' ? 'Linux' : 'Windows'} · ${
                  p.name || p.webgl_renderer || 'Standard'
                } · ${presetNum(p)}C/${presetMem(p)}GB · ${presetScreen(p)[0]}×${presetScreen(p)[1]}`;
              return (
                <option key={idx} value={idx}>
                  {label}
                </option>
              );
            })}
            <option value="custom">{t.modal.customOption}</option>
          </select>
        </div>

        {isCustom ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>
              {t.modal.customFingerprint}
            </span>
            <div className="fp-grid">
              <div>
                <label className="field-label">{t.modal.platform}</label>
                <select
                  className="input-field"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
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
                />
              </div>
              <div>
                <label className="field-label">{t.modal.colorDepth}</label>
                <select
                  className="input-field"
                  value={colorDepth}
                  onChange={(e) => setColorDepth(e.target.value)}
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
                />
              </div>
              <div className="fp-full">
                <label className="field-label">{t.modal.webglVendor}</label>
                <input
                  type="text"
                  className="input-field"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  placeholder="Google Inc. (NVIDIA)"
                />
              </div>
              <div className="fp-full">
                <label className="field-label">{t.modal.webglRenderer}</label>
                <input
                  type="text"
                  className="input-field"
                  value={renderer}
                  onChange={(e) => setRenderer(e.target.value)}
                  placeholder="ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)"
                />
              </div>
              <div className="fp-full">
                <label className="field-label">{t.modal.userAgent}</label>
                <input
                  type="text"
                  className="input-field"
                  value={userAgent}
                  onChange={(e) => setUserAgent(e.target.value)}
                />
              </div>
              <div className="fp-full">
                <label className="field-label">{t.modal.languages}</label>
                <input
                  type="text"
                  className="input-field"
                  value={languages}
                  onChange={(e) => setLanguages(e.target.value)}
                />
              </div>
            </div>
            <div className="field-hint">{t.modal.customHint}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={diversify}
                onChange={(e) => setDiversify(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span>{t.modal.diversify}</span>
            </label>
            <div className="field-hint">{t.modal.diversifyHint}</div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>
            {t.modal.tags}
          </label>
          <input
            type="text"
            className="input-field"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder={t.modal.tagsPlaceholder}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>
            {t.modal.proxy}
          </label>
          <input
            type="text"
            className="input-field"
            value={proxy}
            onChange={(e) => setProxy(e.target.value)}
            placeholder="e.g. http://127.0.0.1:8080 or socks5://host:port"
          />
        </div>
      </form>
    </Modal>
  );
}
