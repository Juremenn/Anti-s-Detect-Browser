import { useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
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
  const [tags, setTags] = useState('Utama, Kerja');
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
      setError('Nama profil wajib diisi.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const parsedTags = tags
        .split(',')
        .map((t) => t.trim())
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
      title="Create New Profile"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Profile'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && (
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 5,
              fontSize: 12,
              color: '#f87171',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)' }}>
            Profile Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Work_Identity_1"
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)' }}>
            Hardware & OS Preset
          </label>
          <select
            value={preset}
            onChange={(e) => setPreset(parseInt(e.target.value, 10))}
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
            {presets.map((p, idx) => (
              <option key={idx} value={idx}>
                {p.platform} | {p.gpu_renderer} ({p.cores}-Core, {p.memory_gb}GB)
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)' }}>
            Tags (comma-separated)
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g. Toko, Ads, Social"
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)' }}>
            Proxy URL (Optional)
          </label>
          <input
            type="text"
            value={proxy}
            onChange={(e) => setProxy(e.target.value)}
            placeholder="socks5://user:pass@host:port"
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
      </form>
    </Modal>
  );
}
