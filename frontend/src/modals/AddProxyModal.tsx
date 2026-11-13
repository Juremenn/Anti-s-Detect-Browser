import { useEffect, useState } from 'react';
import { Modal } from '../components/Modal';

interface AddProxyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string, url: string) => Promise<void>;
}

export function AddProxyModal({ isOpen, onClose, onSubmit }: AddProxyModalProps) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setUrl('');
      setError('');
      setLoading(false);
    }
  }, [isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) {
      setError('Alamat proxy wajib diisi.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onSubmit(title.trim(), url.trim());
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
      title="Add New Proxy"
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
            {loading ? 'Adding...' : 'Add Proxy'}
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
            Proxy Label / Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. SG Datacenter 1"
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
            Proxy URL (SOCKS5 / HTTP)
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="socks5://user:pass@1.2.3.4:1080"
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
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            Format: socks5://host:port atau http://user:pass@host:port
          </span>
        </div>
      </form>
    </Modal>
  );
}
