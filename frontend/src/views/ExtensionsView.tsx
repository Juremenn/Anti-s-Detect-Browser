import { useState, useEffect, useRef } from 'react';
import {
  Package,
  FolderOpen,
  RefreshCw,
  Trash2,
  UploadCloud,
  ExternalLink,
  Sliders,
  RotateCw,
  Eye,
  EyeOff,
} from 'lucide-react';
import { api } from '../api';
import { Extension } from '../types';
import { Modal } from '../components/Modal';
import { Drawer } from '../components/ui/Drawer';
import { Button } from '../components/ui/Button';
import { Switch } from '../components/ui/Switch';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { DevicePicker } from '../components/ui/DevicePicker';
import { t } from '../i18n';

interface ExtensionsViewProps {
  onToast?: (message: string, type?: 'info' | 'success' | 'error') => void;
  onCountChange?: (count: number) => void;
}

export function ExtensionsView({ onToast, onCountChange }: ExtensionsViewProps) {
  const { confirm } = useConfirm();
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);

  // Unpacked Modal (Fallback if native dialog not available)
  const [unpackedModalOpen, setUnpackedModalOpen] = useState(false);
  const [unpackedPath, setUnpackedPath] = useState('');
  const [submittingUnpacked, setSubmittingUnpacked] = useState(false);

  // Configure Drawer State
  const [configDrawerOpen, setConfigDrawerOpen] = useState(false);
  const [selectedExt, setSelectedExt] = useState<Extension | null>(null);
  const [extConfig, setExtConfig] = useState<Record<string, any>>({});
  const [extPresets, setExtPresets] = useState<any[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [showProxyPassword, setShowProxyPassword] = useState(false);

  // Hidden File Input for .crx
  const crxInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadExtensions();
  }, []);

  useEffect(() => {
    if (!loading) {
      onCountChange?.(extensions.length);
    }
  }, [extensions.length, loading, onCountChange]);

  async function loadExtensions() {
    try {
      setLoading(true);
      const res = await api.getExtensions();
      if (res && res.extensions) {
        setExtensions(res.extensions);
      }
    } catch (err) {
      console.error('Failed to load extensions:', err);
      onToast?.(err instanceof Error ? err.message : 'Failed to load extensions', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(id: string, currentState: boolean) {
    const nextState = !currentState;
    try {
      await api.toggleExtension(id, nextState);
      setExtensions((prev) =>
        prev.map((ext) => (ext.id === id ? { ...ext, enabled: nextState } : ext))
      );
      onToast?.(nextState ? 'Extension enabled' : 'Extension disabled', 'info');
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'Failed to toggle extension', 'error');
    }
  }

  async function handleReload(id: string) {
    try {
      const res = await api.reloadExtension(id);
      if (res && res.extension) {
        setExtensions((prev) =>
          prev.map((ext) => (ext.id === id ? res.extension : ext))
        );
        onToast?.('Extension reloaded', 'success');
      }
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'Failed to reload extension', 'error');
    }
  }

  async function handleOpenFolder(id: string) {
    try {
      await api.openExtensionFolder(id);
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'Failed to open directory', 'error');
    }
  }

  async function handleRemoveExtension(ext: Extension) {
    const ok = await confirm({
      title: t.extensionsTab.confirmRemoveTitle,
      description: t.extensionsTab.confirmRemoveDesc(ext.name),
      confirmLabel: t.extensionsTab.remove,
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.removeExtension(ext.id);
      setExtensions((prev) => prev.filter((e) => e.id !== ext.id));
      onToast?.('Extension removed', 'info');
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'Failed to remove extension', 'error');
    }
  }

  // Open Configure Drawer
  async function handleOpenConfigure(ext: Extension) {
    setSelectedExt(ext);
    setConfigDrawerOpen(true);
    setLoadingConfig(true);
    try {
      const res = await api.getExtensionConfig(ext.id);
      if (res && res.config) {
        setExtConfig(res.config);
        setExtPresets(res.presets || []);
      }
    } catch (err) {
      console.error('Failed to load extension configuration:', err);
      onToast?.(err instanceof Error ? err.message : 'Failed to load configuration', 'error');
    } finally {
      setLoadingConfig(false);
    }
  }

  // Save Configure Drawer Changes
  async function handleSaveConfigure() {
    if (!selectedExt) return;
    setSavingConfig(true);
    try {
      const res = await api.saveExtensionConfig(selectedExt.id, extConfig);
      if (res && res.status === 'ok') {
        onToast?.('Configuration saved successfully', 'success');
        setConfigDrawerOpen(false);
      }
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'Failed to save configuration', 'error');
    } finally {
      setSavingConfig(false);
    }
  }

  // Native File/Folder Dialogs with Graceful Fallback
  async function handleLoadUnpackedClick() {
    const pywebview = (window as any).pywebview;
    if (pywebview?.api?.pick_folder) {
      try {
        const selected = await pywebview.api.pick_folder();
        if (selected) {
          const folderPath = Array.isArray(selected) ? selected[0] : selected;
          if (folderPath) {
            const res = await api.loadUnpacked(folderPath);
            if (res && res.extension) {
              setExtensions((prev) => {
                const idx = prev.findIndex((e) => e.id === res.extension.id);
                if (idx !== -1) {
                  const next = [...prev];
                  next[idx] = res.extension;
                  return next;
                }
                return [...prev, res.extension];
              });
              onToast?.(`Loaded unpacked ${res.extension.name}`, 'success');
            }
          }
        }
        return;
      } catch (err) {
        console.warn('Native folder picker failed, using fallback:', err);
      }
    }
    setUnpackedModalOpen(true);
  }

  async function handleInstallCrxClick() {
    const pywebview = (window as any).pywebview;
    if (pywebview?.api?.pick_crx_file) {
      try {
        const resObj = await pywebview.api.pick_crx_file();
        if (resObj && resObj.file_name && resObj.file_data) {
          const res = await api.installCrx(resObj.file_name, resObj.file_data);
          if (res && res.extension) {
            setExtensions((prev) => {
              const idx = prev.findIndex((e) => e.id === res.extension.id);
              if (idx !== -1) {
                const next = [...prev];
                next[idx] = res.extension;
                return next;
              }
              return [...prev, res.extension];
            });
            onToast?.(`Installed ${res.extension.name}`, 'success');
          }
          return;
        }
      } catch (err) {
        console.warn('Native CRX picker failed, using fallback:', err);
      }
    }
    crxInputRef.current?.click();
  }

  // Handle .crx file selection from HTML input
  async function handleCrxFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await processCrxFile(file);
    if (crxInputRef.current) crxInputRef.current.value = '';
  }

  async function processCrxFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.crx')) {
      onToast?.('Selected file is not a .crx extension archive', 'error');
      return;
    }

    try {
      onToast?.(`Installing ${file.name}...`, 'info');
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const result = reader.result as string;
          const res = await api.installCrx(file.name, result);
          if (res && res.extension) {
            setExtensions((prev) => {
              const existingIdx = prev.findIndex((e) => e.id === res.extension.id);
              if (existingIdx !== -1) {
                const next = [...prev];
                next[existingIdx] = res.extension;
                return next;
              }
              return [...prev, res.extension];
            });
            onToast?.(`Installed ${res.extension.name}`, 'success');
          }
        } catch (innerErr) {
          onToast?.(innerErr instanceof Error ? innerErr.message : 'Failed to install .crx', 'error');
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'Failed to read file', 'error');
    }
  }

  // Load Unpacked Folder Submission via Modal
  async function handleLoadUnpackedSubmit() {
    const path = unpackedPath.trim();
    if (!path) return;

    try {
      setSubmittingUnpacked(true);
      const res = await api.loadUnpacked(path);
      if (res && res.extension) {
        setExtensions((prev) => {
          const existingIdx = prev.findIndex((e) => e.id === res.extension.id);
          if (existingIdx !== -1) {
            const next = [...prev];
            next[existingIdx] = res.extension;
            return next;
          }
          return [...prev, res.extension];
        });
        onToast?.(`Loaded unpacked ${res.extension.name}`, 'success');
        setUnpackedModalOpen(false);
        setUnpackedPath('');
      }
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'Failed to load unpacked extension', 'error');
    } finally {
      setSubmittingUnpacked(false);
    }
  }

  // Drag and drop handlers
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.toLowerCase().endsWith('.crx')) {
        await processCrxFile(file);
      } else {
        onToast?.('Drop a valid .crx file', 'error');
      }
    }
  }

  const activePresetId = extConfig.selected_preset_id || '';
  const currentPreset = extPresets.find((p) => p.id === activePresetId) || extPresets[0];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-canvas, #F8FAFC)',
        overflowY: 'auto',
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden File Input for CRX */}
      <input
        type="file"
        ref={crxInputRef}
        accept=".crx"
        style={{ display: 'none' }}
        onChange={handleCrxFileSelected}
      />

      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid var(--border, #E5E7EB)',
          backgroundColor: '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--text-primary, #0F172A)',
              letterSpacing: '-0.2px',
              margin: 0,
            }}
          >
            {t.extensionsTab.title}
          </h1>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 20,
              minWidth: 20,
              padding: '0 6px',
              borderRadius: 10,
              fontSize: 11,
              fontFamily: 'var(--font-sans)',
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 500,
              backgroundColor: 'var(--bg-raised, #F1F5F9)',
              color: 'var(--text-secondary, #64748B)',
              border: '1px solid var(--border, #E5E7EB)',
            }}
          >
            {t.extensionsTab.count(extensions.length)}
          </span>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleLoadUnpackedClick}
            style={{
              borderColor: 'var(--border, #E5E7EB)',
              fontSize: 12,
              fontWeight: 500,
              height: 30,
            }}
          >
            <FolderOpen size={13} strokeWidth={1.75} style={{ marginRight: 6 }} />
            {t.extensionsTab.loadUnpacked}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleInstallCrxClick}
            style={{
              borderColor: 'var(--border, #E5E7EB)',
              fontSize: 12,
              fontWeight: 500,
              height: 30,
            }}
          >
            <UploadCloud size={13} strokeWidth={1.75} style={{ marginRight: 6 }} />
            {t.extensionsTab.installCrx}
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ padding: '24px', maxWidth: 1000, width: '100%', margin: '0 auto' }}>
        {/* Drag Overlay Hint */}
        {dragOver && (
          <div
            style={{
              padding: '24px',
              marginBottom: 16,
              borderRadius: 8,
              border: '2px dashed var(--accent, #4F46E5)',
              backgroundColor: '#EEF2FF',
              textAlign: 'center',
              color: 'var(--accent, #4F46E5)',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {t.extensionsTab.dropToInstall}
          </div>
        )}

        {/* Empty State */}
        {!loading && extensions.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '64px 24px',
              borderRadius: 8,
              border: '1.5px dashed var(--border, #E5E7EB)',
              backgroundColor: '#FFFFFF',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 8,
                backgroundColor: 'var(--bg-raised, #F8FAFC)',
                border: '1px solid var(--border, #E5E7EB)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted, #94A3B8)',
                marginBottom: 16,
              }}
            >
              <Package size={22} strokeWidth={1.75} />
            </div>

            <h3
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text-primary, #0F172A)',
                margin: '0 0 6px 0',
              }}
            >
              {t.extensionsTab.noExtensionsTitle}
            </h3>

            <p
              style={{
                fontSize: 12,
                color: 'var(--text-secondary, #64748B)',
                maxWidth: 420,
                margin: '0 0 20px 0',
                lineHeight: 1.5,
              }}
            >
              {t.extensionsTab.noExtensionsDesc}
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleLoadUnpackedClick}
              >
                <FolderOpen size={13} strokeWidth={1.75} style={{ marginRight: 6 }} />
                {t.extensionsTab.loadUnpacked}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleInstallCrxClick}
              >
                <UploadCloud size={13} strokeWidth={1.75} style={{ marginRight: 6 }} />
                {t.extensionsTab.installCrx}
              </Button>
            </div>
          </div>
        )}

        {/* Extensions List */}
        {extensions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {extensions.map((ext) => {
              const isReady = ext.status !== 'missing';
              const permissionsStr = (ext.permissions || []).join(', ') || 'None';

              return (
                <div
                  key={ext.id}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--border, #E5E7EB)',
                    borderRadius: 6,
                    overflow: 'hidden',
                    transition: 'border-color 150ms ease, box-shadow 150ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-hover, #D1D5DB)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border, #E5E7EB)';
                  }}
                >
                  {/* Top Row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                    }}
                  >
                    {/* Left: Icon + Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      {/* Icon */}
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 6,
                          border: '1px solid var(--border, #E5E7EB)',
                          backgroundColor: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          flexShrink: 0,
                        }}
                      >
                        {ext.icon_url ? (
                          <img
                            src={ext.icon_url}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                        ) : (
                          <Package size={18} strokeWidth={1.75} color="#64748B" />
                        )}
                      </div>

                      {/* Name & Version */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: 'var(--text-primary, #0F172A)',
                            }}
                          >
                            {ext.name}
                          </span>

                          <span
                            style={{
                              fontFamily: 'var(--font-mono, monospace)',
                              fontSize: 11,
                              color: 'var(--text-secondary, #64748B)',
                            }}
                          >
                            v{ext.version}
                          </span>

                          <span
                            style={{
                              fontSize: 11,
                              color: 'var(--text-muted, #94A3B8)',
                            }}
                          >
                            · {ext.source_type === 'crx' ? 'CRX' : 'Unpacked'}
                          </span>

                          {/* Status Dot */}
                          <span
                            title={isReady ? 'Ready' : 'Path missing on disk'}
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              backgroundColor: isReady ? '#10B981' : '#F59E0B',
                              display: 'inline-block',
                              marginLeft: 2,
                            }}
                          />
                        </div>

                        {ext.description && (
                          <span
                            style={{
                              fontSize: 12,
                              color: 'var(--text-secondary, #64748B)',
                              maxWidth: 540,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {ext.description}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions Cluster + Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* Dynamic Configure Button if Extension is Configurable */}
                      {ext.configurable && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenConfigure(ext)}
                          style={{
                            height: 28,
                            padding: '0 9px',
                            fontSize: 11,
                            fontWeight: 500,
                            borderColor: 'var(--border, #E5E7EB)',
                            color: 'var(--text-primary, #0F172A)',
                          }}
                        >
                          <Sliders size={12} strokeWidth={1.75} style={{ marginRight: 5 }} />
                          {t.extensionsTab.configure}
                        </Button>
                      )}

                      {/* Action Icon Buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          type="button"
                          title={t.extensionsTab.reload}
                          onClick={() => handleReload(ext.id)}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 4,
                            border: '1px solid transparent',
                            background: 'transparent',
                            color: 'var(--text-secondary, #64748B)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 120ms ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--bg-raised, #F1F5F9)';
                            e.currentTarget.style.borderColor = 'var(--border, #E5E7EB)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.borderColor = 'transparent';
                          }}
                        >
                          <RefreshCw size={13} strokeWidth={1.75} />
                        </button>

                        <button
                          type="button"
                          title={t.extensionsTab.openFolder}
                          onClick={() => handleOpenFolder(ext.id)}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 4,
                            border: '1px solid transparent',
                            background: 'transparent',
                            color: 'var(--text-secondary, #64748B)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 120ms ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--bg-raised, #F1F5F9)';
                            e.currentTarget.style.borderColor = 'var(--border, #E5E7EB)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.borderColor = 'transparent';
                          }}
                        >
                          <ExternalLink size={13} strokeWidth={1.75} />
                        </button>

                        <button
                          type="button"
                          title={t.extensionsTab.remove}
                          onClick={() => handleRemoveExtension(ext)}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 4,
                            border: '1px solid transparent',
                            background: 'transparent',
                            color: 'var(--text-secondary, #64748B)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 120ms ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#FEF2F2';
                            e.currentTarget.style.borderColor = '#FECACA';
                            e.currentTarget.style.color = '#DC2626';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.borderColor = 'transparent';
                            e.currentTarget.style.color = 'var(--text-secondary, #64748B)';
                          }}
                        >
                          <Trash2 size={13} strokeWidth={1.75} />
                        </button>
                      </div>

                      {/* Hairline Divider */}
                      <div
                        style={{
                          width: 1,
                          height: 18,
                          backgroundColor: 'var(--border, #E5E7EB)',
                        }}
                      />

                      {/* Enable / Disable Switch */}
                      <Switch
                        checked={ext.enabled}
                        onChange={() => handleToggle(ext.id, ext.enabled)}
                      />
                    </div>
                  </div>

                  {/* Bottom Inset Bar: 4-Column Tabular Metadata Strip */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '80px 1.4fr 2fr 100px',
                      gap: 12,
                      padding: '8px 16px',
                      backgroundColor: 'var(--bg-inset, #F8FAFC)',
                      borderTop: '1px solid var(--border, #E5E7EB)',
                      fontSize: 11,
                      alignItems: 'center',
                    }}
                  >
                    {/* Col 1: Manifest */}
                    <div>
                      <span
                        style={{
                          color: 'var(--text-muted, #94A3B8)',
                          fontSize: 9,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          display: 'block',
                          marginBottom: 1,
                        }}
                      >
                        {t.extensionsTab.manifestLabel}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono, monospace)',
                          color: 'var(--text-primary, #0F172A)',
                          fontWeight: 500,
                        }}
                      >
                        MV{ext.manifest_version || 3}
                      </span>
                    </div>

                    {/* Col 2: Permissions */}
                    <div style={{ overflow: 'hidden' }}>
                      <span
                        style={{
                          color: 'var(--text-muted, #94A3B8)',
                          fontSize: 9,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          display: 'block',
                          marginBottom: 1,
                        }}
                      >
                        {t.extensionsTab.permissionsLabel}
                      </span>
                      <span
                        title={permissionsStr}
                        style={{
                          fontFamily: 'var(--font-mono, monospace)',
                          color: 'var(--text-secondary, #64748B)',
                          fontSize: 10,
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {permissionsStr}
                      </span>
                    </div>

                    {/* Col 3: Source Path */}
                    <div style={{ overflow: 'hidden' }}>
                      <span
                        style={{
                          color: 'var(--text-muted, #94A3B8)',
                          fontSize: 9,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          display: 'block',
                          marginBottom: 1,
                        }}
                      >
                        {t.extensionsTab.pathLabel}
                      </span>
                      <span
                        title={ext.path}
                        style={{
                          fontFamily: 'var(--font-mono, monospace)',
                          color: 'var(--text-secondary, #64748B)',
                          fontSize: 10,
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {ext.path}
                      </span>
                    </div>

                    {/* Col 4: Status */}
                    <div>
                      <span
                        style={{
                          color: 'var(--text-muted, #94A3B8)',
                          fontSize: 9,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          display: 'block',
                          marginBottom: 1,
                        }}
                      >
                        {t.extensionsTab.statusLabel}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            backgroundColor: isReady ? '#10B981' : '#F59E0B',
                            display: 'inline-block',
                          }}
                        />
                        <span
                          style={{
                            color: isReady ? 'var(--text-primary, #0F172A)' : '#D97706',
                            fontWeight: 500,
                            fontSize: 10,
                          }}
                        >
                          {isReady ? t.extensionsTab.readyStatus : t.extensionsTab.missingStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Slide-Over Configure Drawer */}
      <Drawer
        isOpen={configDrawerOpen}
        onClose={() => setConfigDrawerOpen(false)}
        title="Configure Extension"
        subtitle={selectedExt ? `${selectedExt.name} · v${selectedExt.version}` : undefined}
        width={480}
        footer={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                if (!selectedExt) return;
                const ok = await confirm({
                  title: 'Reset Configuration Defaults',
                  description: `Reset settings for "${selectedExt.name}" to initial defaults? Any unsaved changes will be discarded.`,
                  confirmLabel: 'Reset Defaults',
                  cancelLabel: 'Cancel',
                  variant: 'danger',
                });
                if (ok) {
                  handleOpenConfigure(selectedExt);
                }
              }}
              disabled={loadingConfig || savingConfig}
              style={{ height: 32, fontSize: 12, color: '#64748B' }}
            >
              {t.extensionsTab.resetDefaults}
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveConfigure}
              disabled={loadingConfig || savingConfig}
              style={{ height: 32, fontSize: 12, backgroundColor: '#4F46E5', borderColor: '#4F46E5' }}
            >
              {savingConfig ? 'Saving...' : t.extensionsTab.saveChanges}
            </Button>
          </div>
        }
      >
        {loadingConfig ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#64748B', fontSize: 13 }}>
            Loading configuration...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Section 1: Device Preset */}
            {extPresets.length > 0 && (
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#64748B',
                    display: 'block',
                    marginBottom: 8,
                  }}
                >
                  Device Identity Preset
                </label>

                <DevicePicker
                  presets={extPresets}
                  selectedId={activePresetId}
                  onChange={(presetId) =>
                    setExtConfig((prev) => ({ ...prev, selected_preset_id: presetId }))
                  }
                />

                {currentPreset && (
                  <div
                    style={{
                      marginTop: 10,
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E5E7EB',
                      borderRadius: 8,
                      padding: '10px 12px',
                      fontSize: 12,
                      fontFamily: 'var(--font-mono, monospace)',
                      color: '#334155',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 5,
                      boxSizing: 'border-box',
                      width: '100%',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ color: '#64748B', flexShrink: 0 }}>GPU</span>
                      <span
                        style={{
                          fontWeight: 500,
                          color: '#0F172A',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          textAlign: 'right',
                        }}
                        title={currentPreset.webgl_renderer || 'Default WebGL'}
                      >
                        {currentPreset.webgl_renderer || 'Default WebGL'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ color: '#64748B', flexShrink: 0 }}>Hardware</span>
                      <span style={{ fontWeight: 500, color: '#0F172A' }}>
                        {currentPreset.hardware_concurrency || 8} Cores · {currentPreset.device_memory || 8} GB RAM
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ color: '#64748B', flexShrink: 0 }}>Screen</span>
                      <span style={{ fontWeight: 500, color: '#0F172A' }}>
                        {currentPreset.screen_width || 1920}x{currentPreset.screen_height || 1080} @{currentPreset.device_pixel_ratio || 1}x
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ height: 1, backgroundColor: '#F1F5F9', width: '100%' }} />

            {/* Section 2: Deterministic Noise Seed */}
            <div>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#64748B',
                  display: 'block',
                  marginBottom: 8,
                }}
              >
                Identity Seed
              </label>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
                <input
                  type="number"
                  value={extConfig.profile_seed || 8392819}
                  onChange={(e) =>
                    setExtConfig((prev) => ({ ...prev, profile_seed: parseInt(e.target.value, 10) || 0 }))
                  }
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: 36,
                    padding: '0 12px',
                    borderRadius: 8,
                    border: '1px solid #E2E8F0',
                    fontSize: 13,
                    fontFamily: 'var(--font-mono, monospace)',
                    color: '#0F172A',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 120ms ease, box-shadow 120ms ease',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#4F46E5';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79, 70, 229, 0.12)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#E2E8F0';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setExtConfig((prev) => ({
                      ...prev,
                      profile_seed: Math.floor(Math.random() * 9000000) + 1000000,
                    }))
                  }
                  style={{
                    height: 36,
                    padding: '0 12px',
                    fontSize: 12,
                    fontWeight: 500,
                    flexShrink: 0,
                    borderRadius: 8,
                    borderColor: '#E2E8F0',
                  }}
                >
                  <RotateCw size={12} strokeWidth={1.75} style={{ marginRight: 6 }} />
                  Randomize
                </Button>
              </div>
            </div>

            <div style={{ height: 1, backgroundColor: '#F1F5F9', width: '100%' }} />

            {/* Section 3: Fresh IP & Proxy Routing */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#64748B',
                  }}
                >
                  Fresh IP & Proxy Routing
                </span>
                <Switch
                  checked={Boolean((extConfig.proxy || {}).enabled)}
                  onChange={(checked) =>
                    setExtConfig((prev) => ({
                      ...prev,
                      proxy: { ...(prev.proxy || {}), enabled: checked },
                    }))
                  }
                />
              </div>

              {/* Row 1: Protocol (110px) + Host (1fr) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '110px minmax(0, 1fr)',
                  gap: 10,
                  marginBottom: 10,
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <select
                  value={(extConfig.proxy || {}).scheme || 'http'}
                  onChange={(e) =>
                    setExtConfig((prev) => ({
                      ...prev,
                      proxy: { ...(prev.proxy || {}), scheme: e.target.value },
                    }))
                  }
                  style={{
                    width: '100%',
                    minWidth: 0,
                    boxSizing: 'border-box',
                    height: 36,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: '1px solid #E2E8F0',
                    fontSize: 13,
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
                    color: '#0F172A',
                    transition: 'border-color 120ms ease, box-shadow 120ms ease',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#4F46E5';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79, 70, 229, 0.12)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#E2E8F0';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <option value="http">HTTP</option>
                  <option value="https">HTTPS</option>
                  <option value="socks5">SOCKS5</option>
                </select>

                <input
                  type="text"
                  placeholder="proxy.host.com"
                  value={(extConfig.proxy || {}).host || ''}
                  onChange={(e) =>
                    setExtConfig((prev) => ({
                      ...prev,
                      proxy: { ...(prev.proxy || {}), host: e.target.value.trim() },
                    }))
                  }
                  style={{
                    width: '100%',
                    minWidth: 0,
                    boxSizing: 'border-box',
                    height: 36,
                    padding: '0 12px',
                    borderRadius: 8,
                    border: '1px solid #E2E8F0',
                    fontSize: 13,
                    fontFamily: 'var(--font-mono, monospace)',
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
                    color: '#0F172A',
                    transition: 'border-color 120ms ease, box-shadow 120ms ease',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#4F46E5';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79, 70, 229, 0.12)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#E2E8F0';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* Row 2: Port (100px) + Username (1fr) + Password (1fr with eye toggle) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '100px minmax(0, 1fr) minmax(0, 1fr)',
                  gap: 10,
                  marginBottom: 10,
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <input
                  type="number"
                  placeholder="Port"
                  value={(extConfig.proxy || {}).port || ''}
                  onChange={(e) =>
                    setExtConfig((prev) => ({
                      ...prev,
                      proxy: { ...(prev.proxy || {}), port: parseInt(e.target.value, 10) || 0 },
                    }))
                  }
                  style={{
                    width: '100%',
                    minWidth: 0,
                    boxSizing: 'border-box',
                    height: 36,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: '1px solid #E2E8F0',
                    fontSize: 13,
                    fontFamily: 'var(--font-mono, monospace)',
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
                    color: '#0F172A',
                    transition: 'border-color 120ms ease, box-shadow 120ms ease',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#4F46E5';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79, 70, 229, 0.12)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#E2E8F0';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />

                <input
                  type="text"
                  placeholder="Username"
                  value={(extConfig.proxy || {}).username || ''}
                  onChange={(e) =>
                    setExtConfig((prev) => ({
                      ...prev,
                      proxy: { ...(prev.proxy || {}), username: e.target.value.trim() },
                    }))
                  }
                  style={{
                    width: '100%',
                    minWidth: 0,
                    boxSizing: 'border-box',
                    height: 36,
                    padding: '0 12px',
                    borderRadius: 8,
                    border: '1px solid #E2E8F0',
                    fontSize: 13,
                    fontFamily: 'var(--font-mono, monospace)',
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
                    color: '#0F172A',
                    transition: 'border-color 120ms ease, box-shadow 120ms ease',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#4F46E5';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79, 70, 229, 0.12)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#E2E8F0';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />

                {/* Password with show/hide toggle */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', minWidth: 0 }}>
                  <input
                    type={showProxyPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={(extConfig.proxy || {}).password || ''}
                    onChange={(e) =>
                      setExtConfig((prev) => ({
                        ...prev,
                        proxy: { ...(prev.proxy || {}), password: e.target.value.trim() },
                      }))
                    }
                    style={{
                      width: '100%',
                      minWidth: 0,
                      boxSizing: 'border-box',
                      height: 36,
                      padding: '0 32px 0 12px',
                      borderRadius: 8,
                      border: '1px solid #E2E8F0',
                      fontSize: 13,
                      fontFamily: 'var(--font-mono, monospace)',
                      outline: 'none',
                      backgroundColor: '#FFFFFF',
                      color: '#0F172A',
                      transition: 'border-color 120ms ease, box-shadow 120ms ease',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#4F46E5';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79, 70, 229, 0.12)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#E2E8F0';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowProxyPassword(!showProxyPassword)}
                    title={showProxyPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute',
                      right: 6,
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      border: 'none',
                      background: 'transparent',
                      color: '#94A3B8',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color 120ms ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#475569')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#94A3B8')}
                  >
                    {showProxyPassword ? <EyeOff size={14} strokeWidth={1.75} /> : <Eye size={14} strokeWidth={1.75} />}
                  </button>
                </div>
              </div>

              {/* Row 3: Full-width Rotation Webhook URL */}
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: '#64748B',
                    display: 'block',
                    marginBottom: 5,
                  }}
                >
                  Rotation Webhook URL
                </label>
                <input
                  type="text"
                  placeholder="https://proxy-provider.com/api/change-ip?key=..."
                  value={(extConfig.proxy || {}).rotation_url || ''}
                  onChange={(e) =>
                    setExtConfig((prev) => ({
                      ...prev,
                      proxy: { ...(prev.proxy || {}), rotation_url: e.target.value.trim() },
                    }))
                  }
                  style={{
                    width: '100%',
                    minWidth: 0,
                    boxSizing: 'border-box',
                    height: 36,
                    padding: '0 12px',
                    borderRadius: 8,
                    border: '1px solid #E2E8F0',
                    fontSize: 13,
                    fontFamily: 'var(--font-mono, monospace)',
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
                    color: '#0F172A',
                    transition: 'border-color 120ms ease, box-shadow 120ms ease',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#4F46E5';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79, 70, 229, 0.12)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#E2E8F0';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            <div style={{ height: 1, backgroundColor: '#F1F5F9', width: '100%' }} />

            {/* Section 4: Stealth Protection Modules */}
            <div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#64748B',
                  display: 'block',
                  marginBottom: 10,
                }}
              >
                Stealth Protection Modules
              </span>

              {[
                { key: 'navigator', label: 'Navigator & Client Hints', sub: 'Synchronously replaces userAgent and userAgentData' },
                { key: 'webgl', label: 'WebGL & GPU Hardware', sub: 'Replaces UNMASKED_VENDOR and injects readPixels noise' },
                { key: 'canvas', label: 'Canvas 2D & OffscreenCanvas', sub: 'Deterministic micro-perturbation on image data' },
                { key: 'audio', label: 'AudioContext Micro-Jitter', sub: 'Subtle noise on AudioBuffer and frequency arrays' },
                { key: 'screen', label: 'Screen & Viewport Geometry', sub: 'Synchronizes screen dimensions and devicePixelRatio' },
                { key: 'webrtc', label: 'WebRTC Leak Shield', sub: 'Enforces disable_non_proxied_udp policy' },
                { key: 'timezone_sync', label: 'Timezone & Geolocation IP Sync', sub: 'Matches Intl and coords with active IP' },
                { key: 'client_rects', label: 'ClientRects Micro-Offset', sub: 'Normalizes getBoundingClientRect offsets' },
                { key: 'iframe_stealth', label: 'Dynamic Iframe Stealth', sub: 'Propagates hooks to newly created iframes' },
              ].map((m, idx, arr) => {
                const isChecked = (extConfig.modules || {})[m.key] !== false;
                return (
                  <div
                    key={m.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 0',
                      borderBottom: idx < arr.length - 1 ? '1px solid #F1F5F9' : 'none',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#0F172A' }}>
                        {m.label}
                      </span>
                      <span style={{ fontSize: 12, color: '#64748B', lineHeight: 1.3 }}>
                        {m.sub}
                      </span>
                    </div>

                    <Switch
                      checked={isChecked}
                      onChange={(checked) =>
                        setExtConfig((prev) => ({
                          ...prev,
                          modules: { ...(prev.modules || {}), [m.key]: checked },
                        }))
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Drawer>

      {/* Modal: Load Unpacked (Fallback) */}
      {unpackedModalOpen && (
        <Modal
          isOpen={unpackedModalOpen}
          title={t.extensionsTab.loadUnpackedModalTitle}
          onClose={() => setUnpackedModalOpen(false)}
          maxWidth={520}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="secondary" size="sm" onClick={() => setUnpackedModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleLoadUnpackedSubmit}
                disabled={submittingUnpacked || !unpackedPath.trim()}
              >
                {submittingUnpacked ? 'Loading...' : t.extensionsTab.loadUnpacked}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  color: 'var(--text-muted, #94A3B8)',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                {t.extensionsTab.folderPathLabel}
              </label>
              <input
                type="text"
                value={unpackedPath}
                onChange={(e) => setUnpackedPath(e.target.value)}
                placeholder={t.extensionsTab.folderPathPlaceholder}
                autoFocus
                style={{
                  width: '100%',
                  height: 34,
                  padding: '0 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border, #E5E7EB)',
                  fontSize: 12,
                  fontFamily: 'var(--font-mono, monospace)',
                  backgroundColor: '#FFFFFF',
                  color: 'var(--text-primary, #0F172A)',
                  outline: 'none',
                }}
              />
            </div>

            <p style={{ fontSize: 11, color: 'var(--text-secondary, #64748B)', margin: 0 }}>
              The selected directory must contain a valid <code>manifest.json</code> file at its root.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
