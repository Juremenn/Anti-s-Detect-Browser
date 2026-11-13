import {
  AppSettings,
  ConsistencyResult,
  CreateProfilePayload,
  CustomFingerprint,
  ParsedProxy,
  Preset,
  Profile,
  ProfilesResponse,
  ProxyCheckResult,
  ProxyItem,
  TemplateEntry,
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
  updateProfile: (name: string, fields: Record<string, unknown>) =>
    request<{ status: string; profile: Profile }>('/api/profiles/update', {
      method: 'POST',
      body: JSON.stringify({ name, fields }),
    }),
  validateProfile: (fields: Record<string, unknown>, proxyCountry?: string | null) =>
    request<ConsistencyResult>('/api/profiles/validate', {
      method: 'POST',
      body: JSON.stringify({ fields, proxy_country: proxyCountry ?? null }),
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
  parseProxies: (text: string) =>
    request<{ parsed: ParsedProxy[]; errors: Array<{ line: number; error: string }> }>(
      '/api/proxies/parse',
      { method: 'POST', body: JSON.stringify({ text }) },
    ),
  checkProxy: (url: string) =>
    request<ProxyCheckResult>('/api/proxies/check', {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),

  // Templates
  getTemplates: () => request<{ templates: TemplateEntry[] }>('/api/templates'),
  saveTemplate: (name: string, profile: string | Record<string, unknown>, description = '') =>
    request<{ status: string; template: TemplateEntry }>('/api/templates/save', {
      method: 'POST',
      body: JSON.stringify(
        typeof profile === 'string'
          ? { name, profile, description }
          : { name, config: profile, description },
      ),
    }),
  deleteTemplate: (id: string) =>
    request<{ status: string }>('/api/templates/delete', {
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
