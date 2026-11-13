import { useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { t } from '../i18n';
import { CreateProfilePayload, Preset } from '../types';

interface CreateProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateProfilePayload) => Promise<void>;
  presets: Preset[];
  defaultPresetIdx?: number;
  initialName?: string;
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
  const [preset, setPreset] = useState(defaultPresetIdx);
  const [tags, setTags] = useState('Primary, Work');
  const [proxy, setProxy] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(initialName || `Profile_${Math.floor(100 + Math.random() * 900)}`);
      setPreset(defaultPresetIdx);
      setError('');
      setLoading(false);
    }
  }, [isOpen, initialName, defaultPresetIdx]);

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

      await onSubmit({
        name: cleanName,
        preset,
        tags: parsedTags,
        proxy: proxy.trim() || null,
      });
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
              border: '1px solid var(--status-error)',
              borderRadius: 'var(--radius-control)',
              fontSize: 12,
              color: 'var(--status-error)',
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
            value={preset}
            onChange={(e) => setPreset(parseInt(e.target.value, 10))}
            style={{ cursor: 'pointer' }}
          >
            {presets.map((p, idx) => {
              const label =
                p.label ||
                `${p.os === 'mac' ? 'macOS' : p.os === 'linux' ? 'Linux' : 'Windows'} · ${
                  p.name || 'Standard'
                } · ${p.cores || p.hardware_concurrency || 8}C/${
                  p.memory_gb || p.device_memory || 8
                }GB · ${
                  p.screen
                    ? `${p.screen[0]}×${p.screen[1]}`
                    : `${p.screen_width || 1920}×${p.screen_height || 1080}`
                }`;
              return (
                <option key={idx} value={idx} style={{ backgroundColor: 'var(--bg-surface)' }}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>

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
            placeholder={t.modal.proxyPlaceholder}
          />
        </div>
      </form>
    </Modal>
  );
}
