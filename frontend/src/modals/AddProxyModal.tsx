import { useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { t } from '../i18n';

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
      setError(t.modal.proxyUrlRequired);
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
      title={t.modal.addProxyTitle}
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
            {loading ? t.modal.addingProxy : t.modal.addProxyBtn}
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
            {t.modal.proxyTitle}
          </label>
          <input
            type="text"
            className="input-field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t.modal.proxyTitlePlaceholder}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>
            {t.modal.proxyUrl}
          </label>
          <input
            type="text"
            className="input-field"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t.modal.proxyUrlPlaceholder}
          />
        </div>
      </form>
    </Modal>
  );
}
