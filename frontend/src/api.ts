import {
  AppSettings,
  CreateProfilePayload,
  CustomFingerprint,
  Preset,
  Profile,
  ProfilesResponse,
  ProxyItem,
  TrashItem,
} from './types';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
  }

  return data as T;
}

export const api = {
  // Profiles
  getProfiles: () => request<ProfilesResponse>('/api/profiles'),
  startProfile: (name: string, url?: string) =>
    request<{ status: string; pid?: number }>('/api/profiles/start', {
      method: 'POST',
      body: JSON.stringify({ name, url }),
    }),
  stopProfile: (name: string) =>
    request<{ status: string }>('/api/profiles/stop', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  createProfile: (data: CreateProfilePayload) =>
    request<{ status: string; name: string }>('/api/profiles/create', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteProfile: (name: string) =>
    request<{ status: string }>('/api/profiles/delete', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  refreshFingerprint: (name: string) =>
    request<{ status: string; profile: Profile }>('/api/profiles/refresh_fingerprint', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  setFingerprint: (name: string, fields: CustomFingerprint) =>
    request<{ status: string; profile: Profile }>('/api/profiles/set_fingerprint', {
      method: 'POST',
      body: JSON.stringify({ name, fields }),
    }),
  openFolder: (name: string) =>
    request<{ status: string }>('/api/profiles/open_folder', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  // Trash
  getTrash: () => request<{ items: TrashItem[] }>('/api/trash'),
  restoreTrash: (trash_id: string) =>
    request<{ status: string; name: string }>('/api/trash/restore', {
      method: 'POST',
      body: JSON.stringify({ trash_id }),
    }),
  purgeTrash: (trash_id?: string) =>
    request<{ status: string; count: number }>('/api/trash/purge', {
      method: 'POST',
      body: JSON.stringify({ trash_id }),
    }),

  // Proxies
  getProxies: () => request<{ proxies: ProxyItem[] }>('/api/proxies'),
  addProxy: (title: string, url: string) =>
    request<{ status: string; proxy: ProxyItem }>('/api/proxies/add', {
      method: 'POST',
      body: JSON.stringify({ title, url }),
    }),
  deleteProxy: (id: string) =>
    request<{ status: string }>('/api/proxies/delete', {
      method: 'POST',
      body: JSON.stringify({ id }),
    }),

  // Presets & Settings
  getPresets: () => request<{ presets: Preset[] }>('/api/presets'),
  getSettings: () => request<AppSettings>('/api/settings'),
  saveSettings: (settings: Partial<AppSettings>) =>
    request<{ status: string }>('/api/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    }),
};
