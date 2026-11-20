import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { Sidebar } from './components/Sidebar';
import { ToastContainer } from './components/Toast';
import { TopBar } from './components/TopBar';
import { ConfirmProvider, useConfirm } from './components/ui/ConfirmDialog';
import { useTheme } from './hooks/useTheme';
import { t } from './i18n';
import { ProfileEditDialog } from './modals/ProfileEditDialog';
import {
  AppSettings,
  AuthStatusResponse,
  AuthUser,
  CreateProfilePayload,
  Preset,
  Profile,
  ProxyItem,
  SyncStatusResponse,
  TabId,
  ToastMessage,
  TrashItem,
} from './types';
import { ExtensionsView } from './views/ExtensionsView';
import { LoginView } from './views/LoginView';
import { ProfilesView } from './views/ProfilesView';
import { ProxiesView } from './views/ProxiesView';
import { SettingsView } from './views/SettingsView';
import { TemplatesView } from './views/TemplatesView';
import { TrashView } from './views/TrashView';

function AppContent() {
  const { confirm } = useConfirm();
  const [authLoading, setAuthLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState<AuthStatusResponse | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('profiles');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [proxies, setProxies] = useState<ProxyItem[]>([]);
  const [extensionsCount, setExtensionsCount] = useState<number>(0);
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
  const [initialPresetIdx, setInitialPresetIdx] = useState<number | null>(null);
  const [editFpName, setEditFpName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [syncStatus, setSyncStatus] = useState<SyncStatusResponse | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Theme management (Dark / Light / System)
  const { themeMode, resolvedTheme, setThemeMode, toggleTheme } = useTheme();

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

  // Fetch data with referential equality guards to avoid unnecessary re-renders
  const loadProfiles = useCallback(async () => {
    try {
      const data = await api.getProfiles();
      const incoming = data.profiles || [];
      setProfiles((prev) => {
        if (
          prev.length === incoming.length &&
          prev.every((p, i) => {
            const o = incoming[i];
            return (
              o &&
              p.name === o.name &&
              p.is_active === o.is_active &&
              p.pid === o.pid &&
              p.canvas_seed === o.canvas_seed &&
              p.proxy === o.proxy &&
              p.folder === o.folder
            );
          })
        ) {
          return prev;
        }
        return incoming;
      });

      if (data.active_engine) setActiveEngine(data.active_engine);

      const existing = new Set(incoming.map((p) => p.name));
      setSelectedProfiles((prev) => {
        const next = new Set<string>();
        for (const name of prev) {
          if (existing.has(name)) next.add(name);
        }
        return next.size === prev.size ? prev : next;
      });
    } catch (e) {
      console.error('Failed to load profiles:', e);
    }
  }, []);

  const loadTrash = useCallback(async () => {
    try {
      const data = await api.getTrash();
      const incoming = data.items || [];
      setTrashItems((prev) => {
        if (
          prev.length === incoming.length &&
          prev.every((item, i) => {
            const o = incoming[i];
            return o && item.trash_id === o.trash_id;
          })
        ) {
          return prev;
        }
        return incoming;
      });
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

  const loadExtensionsCount = useCallback(async () => {
    try {
      const data = await api.getExtensions();
      setExtensionsCount((data.extensions || []).length);
    } catch (e) {
      console.error('Failed to load extensions:', e);
    }
  }, []);

  const loadSyncStatus = useCallback(async () => {
    try {
      const status = await api.getSyncStatus();
      setSyncStatus((prev) => {
        if (
          prev &&
          prev.state === 'syncing' &&
          status.state === 'synced'
        ) {
          loadProfiles();
          loadProxies();
          loadTrash();
        } else if (
          prev &&
          status.last_synced_at &&
          prev.last_synced_at !== status.last_synced_at
        ) {
          loadProfiles();
          loadProxies();
        }
        return status;
      });
    } catch (e) {
      console.error('Failed to load sync status:', e);
    }
  }, [loadProfiles, loadProxies, loadTrash]);

  useEffect(() => {
    let cancelled = false;
    async function checkInitialAuth() {
      try {
        const status = await api.getAuthStatus();
        if (cancelled) return;
        setAuthStatus(status);
        setAuthenticated(Boolean(status.authenticated && status.user));
        setAuthUser(status.user || null);
      } catch (e) {
        console.error('Failed to verify auth status:', e);
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
        }
      }
    }
    checkInitialAuth();

    function handleUnauthorized() {
      setAuthenticated(false);
      setAuthUser(null);
      setAuthStatus((prev) => (prev ? { ...prev, authenticated: false, user: null } : null));
    }
    window.addEventListener('anti_detect_auth_unauthorized', handleUnauthorized);
    return () => {
      cancelled = true;
      window.removeEventListener('anti_detect_auth_unauthorized', handleUnauthorized);
    };
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    loadProfiles();
    loadTrash();
    loadProxies();
    loadPresets();
    loadSettings();
    loadExtensionsCount();
    loadSyncStatus();
  }, [authenticated, loadProfiles, loadTrash, loadProxies, loadPresets, loadSettings, loadExtensionsCount, loadSyncStatus]);

  // Poll cloud sync status while authenticated
  useEffect(() => {
    if (!authenticated) return;
    const intervalMs = syncStatus?.state === 'syncing' || isSyncing ? 1500 : 4000;
    const syncTimer = setInterval(() => {
      loadSyncStatus();
    }, intervalMs);
    return () => clearInterval(syncTimer);
  }, [authenticated, syncStatus?.state, isSyncing, loadSyncStatus]);

  // Polling every 3s, paused when unauthenticated or when modal is open to ensure zero interaction lag
  useEffect(() => {
    if (!authenticated) return;
    const isModalOpen = createModalOpen || !!editFpName;
    if (isModalOpen) return;

    const timer = setInterval(() => {
      if (activeTab === 'profiles') {
        loadProfiles();
      } else if (activeTab === 'trash') {
        loadTrash();
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [authenticated, activeTab, loadProfiles, loadTrash, createModalOpen, editFpName]);

  // Global Ctrl+N (only when authenticated)
  useEffect(() => {
    if (!authenticated) return;
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setCreateModalOpen(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [authenticated]);

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

  // Collect all unique folder names for the dialog combobox
  const folders = useMemo(
    () =>
      Array.from(
        new Set(profiles.map((p) => p.folder).filter((f): f is string => !!f)),
      ),
    [profiles],
  );

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
    const ok = await confirm({
      title: 'Move Profiles to Trash',
      description: t.bulk.confirmTrashTitle(list.length),
      confirmLabel: 'Move to Trash',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (!ok) return;
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

  async function handleCreateProfileAndStart(payload: CreateProfilePayload) {
    await api.createProfile(payload);
    addToast(t.toast.profileCreated(payload.name), 'success');
    await loadProfiles();
    setActiveTab('profiles');
    try {
      await api.startProfile(payload.name);
      addToast(t.toast.profileStarted(payload.name), 'success');
      await loadProfiles();
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  async function handleUpdateProfile(name: string, fields: Record<string, unknown>) {
    await api.updateProfile(name, fields);
    addToast(t.modal.fingerprintSaved(name), 'success');
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

  async function handleSyncNow() {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await api.syncNow();
      setSyncStatus(res.sync);
      await Promise.all([loadProfiles(), loadProxies(), loadTrash()]);
      const pulledCount = res.pulled?.length || 0;
      const pushedCount = res.pushed?.length || 0;
      if (res.sync.state === 'needs_reauth') {
        addToast(
          res.sync.error_message || 'Google Drive permission required. Click Reconnect Drive in the sidebar.',
          'error',
        );
      } else if (res.sync.state === 'error' || res.sync.state === 'offline') {
        addToast(res.sync.error_message || 'Cloud sync unavailable offline.', 'error');
      } else if (pulledCount > 0 || pushedCount > 0) {
        addToast(
          `Cloud sync complete (${pulledCount} pulled, ${pushedCount} pushed).`,
          'success',
        );
      } else {
        addToast('All profiles are up to date.', 'success');
      }
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleReconnectDrive() {
    try {
      await api.startGoogleAuth(true);
      addToast('Complete Google Drive authorization in your browser.', 'info');
      let attempts = 0;
      const timer = window.setInterval(async () => {
        attempts += 1;
        try {
          const st = await api.getSyncStatus();
          setSyncStatus(st);
          if (st.drive_authorized && st.state !== 'needs_reauth') {
            window.clearInterval(timer);
            await Promise.all([loadProfiles(), loadProxies(), loadTrash()]);
            if (st.state === 'synced') {
              addToast('Google Drive connected and synced.', 'success');
            }
            return;
          }
        } catch {
          // Ignore transient polling errors while OAuth completes
        }
        if (attempts >= 50) {
          window.clearInterval(timer);
        }
      }, 1200);
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  async function handleSignOut() {
    const confirmed = await confirm({
      title: 'Sign Out',
      description:
        'Your profiles are saved locally and synced to your Google account. You can sign back in on this or any other device anytime.',
      confirmLabel: 'Sign Out',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      await api.logout();
    } catch (e) {
      console.error('Failed to sign out cleanly:', e);
    }

    setAuthenticated(false);
    setAuthUser(null);
    setSyncStatus(null);
    setProfiles([]);
    setTrashItems([]);
    setProxies([]);
    setSelectedProfiles(new Set());
    try {
      const status = await api.getAuthStatus();
      setAuthStatus(status);
    } catch {
      setAuthStatus((prev) => (prev ? { ...prev, authenticated: false, user: null } : null));
    }
  }

  if (authLoading) {
    return (
      <main
        aria-label="Verifying authentication status"
        style={{
          width: '100vw',
          height: '100vh',
          backgroundColor: '#F8FAFC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#475569',
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        Verifying session...
      </main>
    );
  }

  if (!authenticated) {
    return (
      <LoginView
        initialStatus={authStatus}
        onStatusUpdated={(status) => {
          setAuthStatus(status);
        }}
        onAuthenticated={(user) => {
          setAuthUser(user);
          setAuthenticated(true);
        }}
      />
    );
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
        extensionsCount={extensionsCount}
        activeEngine={activeEngine}
        runningCount={runningCount}
        user={authUser}
        onSignOut={handleSignOut}
        syncStatus={syncStatus}
        isSyncing={isSyncing}
        onSyncNow={handleSyncNow}
        onReconnectDrive={handleReconnectDrive}
      />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: 'var(--bg-base)' }}>
        {activeTab === 'profiles' && (
          <>
            <TopBar
              onNewProfile={() => {
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
              resolvedTheme={resolvedTheme}
              onToggleTheme={toggleTheme}
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
            onApplyPreset={(presetIndex) => {
              setInitialPresetIdx(presetIndex);
              setCreateModalOpen(true);
            }}
          />
        )}

        {activeTab === 'extensions' && (
          <ExtensionsView onToast={addToast} onCountChange={setExtensionsCount} />
        )}

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
            themeMode={themeMode}
            onChangeThemeMode={setThemeMode}
          />
        )}
      </main>

      <ProfileEditDialog
        isOpen={createModalOpen || editFpName !== null}
        onClose={() => {
          setCreateModalOpen(false);
          setInitialPresetIdx(null);
          setEditFpName(null);
        }}
        presets={presets}
        initialPresetIndex={initialPresetIdx}
        proxies={proxies}
        existingTags={allTags}
        folders={folders}
        engineVersion={settings.engine_version || ''}
        existingNames={profiles.map((p) => p.name)}
        editProfile={editFpName ? profiles.find((p) => p.name === editFpName) || null : null}
        onCreate={handleCreateProfileSubmit}
        onCreateAndStart={handleCreateProfileAndStart}
        onUpdate={handleUpdateProfile}
        onToast={addToast}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default function App() {
  return (
    <ConfirmProvider>
      <AppContent />
    </ConfirmProvider>
  );
}
