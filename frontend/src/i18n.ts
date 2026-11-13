/**
 * i18n.ts - Centralized English UI text dictionary for Octo Browser Offline Studio.
 * Designed so additional language packs (e.g. Indonesian) can be registered cleanly.
 */

export const en = {
  // Navigation
  nav: {
    profiles: 'Profiles',
    proxies: 'Proxies',
    templates: 'Templates',
    trash: 'Trash Bin',
    settings: 'Settings',
  },

  // Sidebar
  sidebar: {
    appName: 'Octo Browser',
    offline: 'Offline',
    engineLabel: 'Engine',
    engineDetecting: 'Detecting...',
    stats: (profiles: number, running: number) =>
      `${profiles} ${profiles === 1 ? 'profile' : 'profiles'} · ${running} running`,
    collapseSidebar: 'Collapse sidebar',
    expandSidebar: 'Expand sidebar',
  },

  // Top Bar & Filters
  topbar: {
    title: 'Profiles',
    searchPlaceholder: 'Search profiles...',
    searchShortcut: 'Ctrl+K',
    searchShortcutMac: '⌘K',
    filterAll: 'All',
    filterRunning: 'Running',
    filterIdle: 'Idle',
    newProfile: 'New profile',
    quickProfile: 'Quick profile',
    testFingerprint: 'Fingerprint test',
    testFingerprintTooltip: 'Launch BrowserLeaks canvas test',
  },

  // Bulk Selection Bar
  bulk: {
    selectedCount: (count: number) => `${count} selected`,
    start: 'Start',
    stop: 'Stop',
    moveToTrash: 'Move to trash',
    clear: 'Clear',
    confirmTrashTitle: (count: number) =>
      `Move ${count} selected ${count === 1 ? 'profile' : 'profiles'} to trash?`,
  },

  // Table Columns
  table: {
    selectAll: 'Select all profiles',
    selectRow: (name: string) => `Select profile ${name}`,
    name: 'Profile',
    status: 'Status',
    fingerprint: 'Fingerprint',
    proxy: 'Proxy',
    tags: 'Tags',
    actions: 'Actions',
    directProxy: 'Direct',
    seed: (val: string | number) => `Seed: ${val}`,
  },

  // Statuses
  status: {
    running: 'Running',
    idle: 'Idle',
    starting: 'Starting...',
  },

  // Row Actions
  actions: {
    start: 'Start',
    stop: 'Stop',
    more: 'More actions',
    openFolder: 'Open profile folder',
    duplicate: 'Duplicate profile',
    testFingerprint: 'Test fingerprint',
    delete: 'Delete',
    confirmDelete: (name: string) => `Move profile '${name}' to trash?`,
  },

  // Empty States
  empty: {
    noProfilesTitle: 'No profiles yet',
    noProfilesDesc: 'Create an isolated browser identity with unique hardware fingerprints.',
    noResultsTitle: 'No profiles found',
    noResultsDesc: 'Try adjusting your search query or status filter.',
    createFirstProfile: 'New profile',
    clearFilter: 'Clear filter',
    trashEmptyTitle: 'Trash bin is empty',
    trashEmptyDesc: 'Deleted browser profiles will be stored here before permanent removal.',
    proxiesEmptyTitle: 'No proxies configured',
    proxiesEmptyDesc: 'Add HTTP, HTTPS, or SOCKS5 proxies to assign to your identities.',
    addProxy: 'Add proxy',
  },

  // Modals
  modal: {
    createProfileTitle: 'New Profile',
    profileName: 'Profile Name',
    profileNamePlaceholder: 'e.g. Work_Identity_1',
    preset: 'Hardware & OS Preset',
    tags: 'Tags (comma separated)',
    tagsPlaceholder: 'e.g. Primary, Work, E-Commerce',
    proxy: 'Proxy (Optional)',
    proxyPlaceholder: 'e.g. http://127.0.0.1:8080 or socks5://user:pass@host:port',
    cancel: 'Cancel',
    create: 'Create Profile',
    creating: 'Creating...',
    nameRequired: 'Profile name is required.',

    addProxyTitle: 'Add New Proxy',
    proxyTitle: 'Proxy Label (Optional)',
    proxyTitlePlaceholder: 'e.g. US Residential Node',
    proxyUrl: 'Proxy URL',
    proxyUrlPlaceholder: 'http://user:pass@host:port or socks5://ip:port',
    addProxyBtn: 'Add Proxy',
    addingProxy: 'Adding...',
    proxyUrlRequired: 'Proxy URL is required.',

    confirm: 'Confirm',
  },

  // Trash View
  trash: {
    title: 'Trash Bin',
    description: 'Profiles here can be restored or permanently removed from disk.',
    emptyTrash: 'Empty Trash',
    restore: 'Restore',
    purge: 'Delete permanently',
    confirmPurgeAll: 'Permanently remove all profiles in trash? This cannot be undone.',
    confirmPurgeItem: (name: string) =>
      `Permanently remove '${name}'? All profile cookies and local data will be erased.`,
    colOriginalName: 'Profile Name',
    colDeletedAt: 'Deleted Time',
    colActions: 'Actions',
  },

  // Proxies View
  proxies: {
    title: 'Proxies',
    description: 'Manage proxy list to easily attach to any browser profile.',
    addProxy: 'Add Proxy',
    colTitle: 'Label',
    colUrl: 'Proxy Endpoint',
    colType: 'Protocol',
    colActions: 'Actions',
    delete: 'Delete',
  },

  // Templates View
  templates: {
    title: 'Hardware Templates',
    description: 'Preconfigured browser identity specs with authentic GPU, CPU, and screen resolutions.',
    useTemplate: 'Use Template',
  },

  // Settings View
  settings: {
    title: 'Settings',
    description: 'Global browser execution and fingerprint masking parameters.',
    browserPath: 'Chromium Executable Path',
    browserPathHelp: 'Leave blank to auto-detect Chrome/Brave/Edge installed on your system.',
    startUrl: 'Default Launch URL',
    startUrlHelp: 'URL opened when a profile starts (default: BrowserLeaks Canvas).',
    maskWebRTC: 'Mask WebRTC IP Leakage',
    maskWebRTCHelp: 'Prevent local IP address exposure via WebRTC ICE candidates.',
    saveChanges: 'Save Changes',
    saving: 'Saving...',
  },

  // Toast feedback
  toast: {
    profileStarted: (name: string) => `Profile '${name}' launched.`,
    profileStopped: (name: string) => `Profile '${name}' stopped.`,
    profileTrashed: (name: string) => `Profile '${name}' moved to trash.`,
    profileRestored: (name: string) => `Profile '${name}' restored.`,
    profilePurged: (name: string) => `Profile '${name}' permanently deleted.`,
    trashCleared: 'Trash bin emptied.',
    profileCreated: (name: string) => `Profile '${name}' created successfully.`,
    proxyAdded: (name: string) => `Proxy '${name}' added successfully.`,
    proxyDeleted: 'Proxy deleted.',
    settingsSaved: 'Settings saved successfully.',
    bulkStarting: (count: number) => `Starting ${count} profiles...`,
    bulkStopping: (count: number) => `Stopping ${count} profiles...`,
    bulkTrashed: (count: number) => `${count} profiles moved to trash.`,
    noProfileForTest: 'Create a profile first to run the fingerprint test.',
    testingFingerprint: (name: string) => `Testing canvas fingerprint with '${name}'...`,
  },
};

export type Translations = typeof en;
export const t = en;
