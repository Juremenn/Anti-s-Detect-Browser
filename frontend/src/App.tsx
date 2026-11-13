import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { Sidebar } from './components/Sidebar';
import { ToastContainer } from './components/Toast';
import { TopBar } from './components/TopBar';
import { CreateProfileModal } from './modals/CreateProfileModal';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const addToast = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = `t_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Fetch initial data
  const loadProfiles = useCallback(async () => {
    try {
      const data = await api.getProfiles();
      setProfiles(data.profiles || []);
      if (data.active_engine) setActiveEngine(data.active_engine);

      // Clean selections for profiles no longer existing
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

  // Background polling every 2s
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

  // Actions: Profiles
  async function handleStartProfile(name: string) {
    try {
      await api.startProfile(name);
      addToast(`Browser untuk profil '${name}' diluncurkan.`, 'success');
      await loadProfiles();
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  async function handleStopProfile(name: string) {
    try {
      await api.stopProfile(name);
      addToast(`Profil '${name}' dihentikan.`, 'info');
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
      addToast(`Profil '${name}' dipindahkan ke Trash Bin.`, 'info');
      await loadProfiles();
      await loadTrash();
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  // Bulk Actions
  async function handleBulkStart() {
    if (selectedProfiles.size === 0) return;
    const list = Array.from(selectedProfiles);
    addToast(`Memulai ${list.length} profil...`, 'info');
    for (const name of list) {
      try {
        await api.startProfile(name);
      } catch (e) {
        console.error(`Gagal start ${name}:`, e);
      }
    }
    await loadProfiles();
  }

  async function handleBulkStop() {
    if (selectedProfiles.size === 0) return;
    const list = Array.from(selectedProfiles);
    addToast(`Menghentikan ${list.length} profil...`, 'info');
    for (const name of list) {
      try {
        await api.stopProfile(name);
      } catch (e) {
        console.error(`Gagal stop ${name}:`, e);
      }
    }
    await loadProfiles();
  }

  async function handleBulkTrash() {
    if (selectedProfiles.size === 0) return;
    const list = Array.from(selectedProfiles);
    if (!confirm(`Pindahkan ${list.length} profil terpilih ke Trash Bin?`)) return;
    for (const name of list) {
      try {
        await api.deleteProfile(name);
      } catch (e) {
        console.error(`Gagal trash ${name}:`, e);
      }
    }
    setSelectedProfiles(new Set());
    addToast(`${list.length} profil dipindahkan ke Trash Bin.`, 'info');
    await loadProfiles();
    await loadTrash();
  }

  async function handleQuickProfile() {
    const randomId = Math.floor(100 + Math.random() * 900);
    const name = `Quick_Identity_${randomId}`;
    const preset = Math.floor(Math.random() * (presets.length || 4));
    try {
      await api.createProfile({ name, preset, tags: ['Quick'] });
      addToast(`Profil '${name}' berhasil dibuat.`, 'success');
      await loadProfiles();
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  async function handleTestFingerprint() {
    if (profiles.length === 0) {
      addToast('Buat profil terlebih dahulu sebelum uji fingerprint.', 'error');
      return;
    }
    const target = profiles[0].name;
    try {
      await api.startProfile(target, 'https://browserleaks.com/canvas');
      addToast(`Membuka BrowserLeaks dengan profil '${target}'.`, 'info');
      await loadProfiles();
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  async function handleCreateProfileSubmit(payload: CreateProfilePayload) {
    await api.createProfile(payload);
    addToast(`Profil '${payload.name}' berhasil dibuat.`, 'success');
    await loadProfiles();
    setActiveTab('profiles');
  }

  // Trash Actions
  async function handleRestoreTrash(trashId: string) {
    try {
      const res = await api.restoreTrash(trashId);
      addToast(`Profil '${res.name}' berhasil dikembalikan.`, 'success');
      await loadTrash();
      await loadProfiles();
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  async function handlePurgeTrash(trashId: string) {
    try {
      await api.purgeTrash(trashId);
      addToast('Item berhasil dihapus permanen.', 'info');
      await loadTrash();
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  async function handlePurgeAllTrash() {
    try {
      await api.purgeTrash();
      addToast('Trash Bin telah dikosongkan.', 'info');
      await loadTrash();
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  // Proxy Actions
  async function handleAddProxy(title: string, url: string) {
    await api.addProxy(title, url);
    addToast(`Proxy '${title || url}' berhasil ditambahkan.`, 'success');
    await loadProxies();
  }

  async function handleDeleteProxy(id: string) {
    try {
      await api.deleteProxy(id);
      addToast('Proxy berhasil dihapus.', 'info');
      await loadProxies();
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  // Settings Actions
  async function handleSaveSettings(newSettings: Partial<AppSettings>) {
    try {
      await api.saveSettings(newSettings);
      addToast('Pengaturan berhasil disimpan.', 'success');
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
              onTestFingerprint={handleTestFingerprint}
              search={searchQuery}
              onSearchChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
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
              onOpenFolder={handleOpenFolder}
              onTrashProfile={handleTrashProfile}
              onBulkStart={handleBulkStart}
              onBulkStop={handleBulkStop}
              onBulkTrash={handleBulkTrash}
              onOpenNewProfileModal={() => {
                setCreateModalPresetIdx(0);
                setCreateModalOpen(true);
              }}
              onQuickProfile={handleQuickProfile}
              searchQuery={searchQuery}
              statusFilter={statusFilter}
            />
          </>
        )}

        {activeTab === 'trash' && (
          <TrashView
            items={trashItems}
            onRestore={handleRestoreTrash}
            onPurge={handlePurgeTrash}
            onPurgeAll={handlePurgeAllTrash}
          />
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

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
