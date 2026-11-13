import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { Sidebar } from './components/Sidebar';
import { ToastContainer } from './components/Toast';
import { TopBar } from './components/TopBar';
import { t } from './i18n';
import { CreateProfileModal } from './modals/CreateProfileModal';
import { EditFingerprintModal } from './modals/EditFingerprintModal';
import {
  AppSettings,
  CreateProfilePayload,
  Preset,
  Profile,
  ProxyItem,
  TabId,
  ToastMessage,
  TrashItem,
} from './types';
import { ExtensionsView } from './views/ExtensionsView';
import { ProfilesView } from './views/ProfilesView';
import { ProxiesView } from './views/ProxiesView';
import { SettingsView } from './views/SettingsView';
import { TemplatesView } from './views/TemplatesView';
import { TrashView } from './views/TrashView';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('profiles');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [proxies, setProxies] = useState<ProxyItem[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    browser_path: '',
    start_url: 'https://browserleaks.com/canvas',
    mask_webrtc: true,
  });
  const [activeEngine, setActiveEngine] = useState('');
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalPresetIdx, setCreateModalPresetIdx] = useState(0);
  const [editFpName, setEditFpName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');

  // Theme support (dark default)
  useEffect(() => {
    const savedTheme = localStorage.getItem('octo_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const addToast = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = `t_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Fetch data
  const loadProfiles = useCallback(async () => {
    try {
      const data = await api.getProfiles();
      setProfiles(data.profiles || []);
      if (data.active_engine) setActiveEngine(data.active_engine);

      const existing = new Set(data.profiles.map((p) => p.name));
      setSelectedProfiles((prev) => {
        const next = new Set<string>();
        for (const name of prev) {
          if (existing.has(name)) next.add(name);
        }
        return next;
      });
    } catch (e) {
      console.error('Failed to load profiles:', e);
    }
  }, []);

  const loadTrash = useCallback(async () => {
    try {
      const data = await api.getTrash();
      setTrashItems(data.items || []);
    } catch (e) {
      console.error('Failed to load trash:', e);
    }
  }, []);

  const loadProxies = useCallback(async () => {
    try {
      const data = await api.getProxies();
      setProxies(data.proxies || []);
    } catch (e) {
      console.error('Failed to load proxies:', e);
    }
  }, []);

  const loadPresets = useCallback(async () => {
    try {
      const data = await api.getPresets();
      setPresets(data.presets || []);
    } catch (e) {
      console.error('Failed to load presets:', e);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const data = await api.getSettings();
      setSettings(data);
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
    loadTrash();
    loadProxies();
    loadPresets();
    loadSettings();
  }, [loadProfiles, loadTrash, loadProxies, loadPresets, loadSettings]);

  // Polling every 2s
  useEffect(() => {
    const timer = setInterval(() => {
      if (activeTab === 'profiles') {
        loadProfiles();
      } else if (activeTab === 'trash') {
        loadTrash();
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [activeTab, loadProfiles, loadTrash]);

  // Global Ctrl+N
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setCreateModalPresetIdx(0);
        setCreateModalOpen(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Collect all unique tags for filter
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const p of profiles) {
      for (const t of p.tags || []) {
        if (t && t.toLowerCase() !== 'default') tagSet.add(t);
      }
    }
    return Array.from(tagSet);
  }, [profiles]);

  // Profile actions
  async function handleStartProfile(name: string) {
    try {
      await api.startProfile(name);
      addToast(t.toast.profileStarted(name), 'success');
      await loadProfiles();
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  async function handleStopProfile(name: string) {
    try {
      await api.stopProfile(name);
      addToast(t.toast.profileStopped(name), 'info');
      await loadProfiles();
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  async function handleOpenFolder(name: string) {
    try {
      await api.openFolder(name);
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  async function handleTrashProfile(name: string) {
    try {
      await api.deleteProfile(name);
      setSelectedProfiles((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
      addToast(t.toast.profileTrashed(name), 'info');
      await loadProfiles();
      await loadTrash();
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  async function handleDuplicateProfile(name: string) {
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const newName = `${name}_Copy_${randomSuffix}`;
    const sourceProfile = profiles.find((p) => p.name === name);
    try {
      await api.createProfile({
        name: newName,
        preset: 0,
        tags: sourceProfile?.tags || ['Copy'],
        proxy: sourceProfile?.proxy || null,
      });
      addToast(t.toast.profileCreated(newName), 'success');
      await loadProfiles();
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  async function handleRegenerateIdentity(name: string) {
    try {
      await api.refreshFingerprint(name);
      addToast(`Identity regenerated for '${name}'.`, 'success');
      await loadProfiles();
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  function handleFingerprintSaved(name: string) {
    addToast(t.modal.fingerprintSaved(name), 'success');
    loadProfiles();
  }

  async function handleExportProfile(name: string) {
    const profile = profiles.find((p) => p.name === name);
    if (!profile) return;
    const jsonStr = JSON.stringify(profile, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}_config.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast(`Exported config for '${name}'.`, 'info');
  }

  // Bulk actions
  async function handleBulkStart() {
    if (selectedProfiles.size === 0) return;
    const list = Array.from(selectedProfiles);
    addToast(`Starting ${list.length} profiles...`, 'info');
    for (const name of list) {
      try {
        await api.startProfile(name);
      } catch (e) {
        console.error(`Failed to start ${name}:`, e);
      }
    }
    await loadProfiles();
  }

  async function handleBulkStop() {
    if (selectedProfiles.size === 0) return;
    const list = Array.from(selectedProfiles);
    addToast(`Stopping ${list.length} profiles...`, 'info');
    for (const name of list) {
      try {
        await api.stopProfile(name);
      } catch (e) {
        console.error(`Failed to stop ${name}:`, e);
      }
    }
    await loadProfiles();
  }

  async function handleBulkTrash() {
    if (selectedProfiles.size === 0) return;
    const list = Array.from(selectedProfiles);
    if (!confirm(t.bulk.confirmTrashTitle(list.length))) return;
    for (const name of list) {
      try {
        await api.deleteProfile(name);
      } catch (e) {
        console.error(`Failed to trash ${name}:`, e);
      }
    }
    setSelectedProfiles(new Set());
    addToast(`${list.length} profiles moved to trash.`, 'info');
    await loadProfiles();
    await loadTrash();
  }

  async function handleQuickProfile() {
    const randomId = Math.floor(100 + Math.random() * 900);
    const name = `Quick_Identity_${randomId}`;
    const preset = Math.floor(Math.random() * (presets.length || 4));
    try {
      await api.createProfile({ name, preset, tags: ['Quick'] });
      addToast(t.toast.profileCreated(name), 'success');
      await loadProfiles();
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  async function handleTestFingerprint(specificProfileName?: string) {
    if (profiles.length === 0) {
      addToast('Create a profile first to run fingerprint test.', 'error');
      return;
    }
    const target = specificProfileName || profiles[0].name;
    try {
      addToast(`Testing fingerprint with '${target}'...`, 'info');
      await api.startProfile(target, 'https://browserleaks.com/canvas');
      await loadProfiles();
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  async function handleCreateProfileSubmit(payload: CreateProfilePayload) {
    await api.createProfile(payload);
    addToast(t.toast.profileCreated(payload.name), 'success');
    await loadProfiles();
    setActiveTab('profiles');
  }

  // Trash actions
  async function handleRestoreTrash(trashId: string) {
    try {
      const res = await api.restoreTrash(trashId);
      addToast(`Profile '${res.name}' restored.`, 'success');
      await loadTrash();
      await loadProfiles();
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  async function handlePurgeTrash(trashId: string) {
    try {
      await api.purgeTrash(trashId);
      addToast('Profile permanently deleted.', 'info');
      await loadTrash();
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  async function handlePurgeAllTrash() {
    try {
      await api.purgeTrash();
      addToast('Trash bin emptied.', 'info');
      await loadTrash();
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  // Proxy actions
  async function handleAddProxy(title: string, url: string) {
    await api.addProxy(title, url);
    addToast(`Proxy '${title || url}' added successfully.`, 'success');
    await loadProxies();
  }

  async function handleDeleteProxy(id: string) {
    try {
      await api.deleteProxy(id);
      addToast('Proxy deleted.', 'info');
      await loadProxies();
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  // Settings actions
  async function handleSaveSettings(newSettings: Partial<AppSettings>) {
    try {
      await api.saveSettings(newSettings);
      addToast('Settings saved successfully.', 'success');
      await loadSettings();
      await loadProfiles();
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  const runningCount = profiles.filter((p) => p.is_active).length;

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        profilesCount={profiles.length}
        trashCount={trashItems.length}
        proxiesCount={proxies.length}
        activeEngine={activeEngine}
        runningCount={runningCount}
      />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: 'var(--bg-base)' }}>
        {activeTab === 'profiles' && (
          <>
            <TopBar
              onNewProfile={() => {
                setCreateModalPresetIdx(0);
                setCreateModalOpen(true);
              }}
              onQuickProfile={handleQuickProfile}
              onFromTemplate={() => setActiveTab('templates')}
              onBulkCreate={() => {
                addToast('Bulk create will open in Phase 4', 'info');
              }}
              onImportProfile={() => {
                addToast('Import profiles will open in Phase 4', 'info');
              }}
              onTestFingerprint={() => handleTestFingerprint()}
              search={searchQuery}
              onSearchChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              selectedTag={tagFilter}
              onTagChange={setTagFilter}
              allTags={allTags}
              totalProfilesCount={profiles.length}
              selectedCount={selectedProfiles.size}
              onBulkStart={handleBulkStart}
              onBulkStop={handleBulkStop}
              onBulkTrash={handleBulkTrash}
              onDeselectAll={() => setSelectedProfiles(new Set())}
            />
            <ProfilesView
              profiles={profiles}
              selectedProfiles={selectedProfiles}
              onToggleSelect={(name, checked) => {
                setSelectedProfiles((prev) => {
                  const next = new Set(prev);
                  if (checked) next.add(name);
                  else next.delete(name);
                  return next;
                });
              }}
              onToggleSelectAll={(checked) => {
                if (checked) {
                  setSelectedProfiles(new Set(profiles.map((p) => p.name)));
                } else {
                  setSelectedProfiles(new Set());
                }
              }}
              onDeselectAll={() => setSelectedProfiles(new Set())}
              onStartProfile={handleStartProfile}
              onStopProfile={handleStopProfile}
              onEditProfile={(name) => setEditFpName(name)}
              onOpenFolder={handleOpenFolder}
              onTrashProfile={handleTrashProfile}
              onDuplicateProfile={handleDuplicateProfile}
              onRegenerateIdentity={handleRegenerateIdentity}
              onExportProfile={handleExportProfile}
              onTestProfile={(name) => handleTestFingerprint(name)}
              onOpenNewProfileModal={() => {
                setCreateModalPresetIdx(0);
                setCreateModalOpen(true);
              }}
              searchQuery={searchQuery}
              statusFilter={statusFilter}
              tagFilter={tagFilter}
            />
          </>
        )}

        {activeTab === 'proxies' && (
          <ProxiesView
            proxies={proxies}
            onAddProxy={handleAddProxy}
            onDeleteProxy={handleDeleteProxy}
          />
        )}

        {activeTab === 'templates' && (
          <TemplatesView
            presets={presets}
            onApplyPreset={(idx) => {
              setCreateModalPresetIdx(idx);
              setCreateModalOpen(true);
            }}
          />
        )}

        {activeTab === 'extensions' && <ExtensionsView />}

        {activeTab === 'trash' && (
          <TrashView
            items={trashItems}
            onRestore={handleRestoreTrash}
            onPurge={handlePurgeTrash}
            onPurgeAll={handlePurgeAllTrash}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onSave={handleSaveSettings}
          />
        )}
      </main>

      <CreateProfileModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleCreateProfileSubmit}
        presets={presets}
        defaultPresetIdx={createModalPresetIdx}
      />

      <EditFingerprintModal
        isOpen={editFpName !== null}
        profile={profiles.find((p) => p.name === editFpName) || null}
        onClose={() => setEditFpName(null)}
        onSaved={handleFingerprintSaved}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
