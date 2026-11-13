export type TabId = 'profiles' | 'proxies' | 'templates' | 'extensions' | 'trash' | 'settings';

export interface Profile {
  name: string;
  created_at?: string;
  last_used_at?: number | string;
  canvas_seed?: string | number;
  audio_seed?: string | number;
  font_seed?: string | number;
  platform?: string;
  webgl_vendor?: string;
  webgl_renderer?: string;
  user_agent?: string;
  languages?: string[];
  hardware_concurrency?: number;
  device_memory?: number;
  screen_width?: number;
  screen_height?: number;
  color_depth?: number;
  audio_noise?: boolean;
  webrtc_mode?: string;
  proxy?: string | null;
  tags?: string[];
  folder?: string;
  color?: string;
  notes?: string;
  is_active?: boolean;
  pid?: number | null;
  diversify?: boolean;
  custom?: boolean;
  base_preset?: number;
}

export interface TrashItem {
  trash_id: string;
  name: string;
  trashed_at: number | string;
  webgl_renderer?: string;
  platform?: string;
  tags?: string[];
  folder?: string;
}

export interface ProxyItem {
  id: string;
  title: string;
  url: string;
  type?: string;
  host?: string;
  port?: number;
  country?: string;
  latency?: number;
  status?: 'ok' | 'failed' | 'unchecked';
  added_at?: number;
}

export interface Preset {
  id?: string;
  name?: string;
  label: string;
  os?: string;
  platform: string;
  platform_version?: string;
  webgl_vendor?: string;
  webgl_renderer: string;
  gpu_vendor?: string;
  gpu_renderer?: string;
  cores?: number;
  hardware_concurrency?: number;
  memory_gb?: number;
  device_memory?: number;
  screen?: [number, number];
  screen_width?: number;
  screen_height?: number;
  color_depth?: number;
  device_pixel_ratio?: number;
  languages?: string[];
  user_agent?: string;
}

export interface BrowserItem {
  name: string;
  path: string;
}

export interface AppSettings {
  browser_path: string;
  start_url: string;
  mask_webrtc: boolean;
  active_browser_path?: string;
  browsers?: Array<string | BrowserItem>;
  theme?: 'dark' | 'light';
  language?: 'en' | 'id';
}

export interface CustomFingerprint {
  platform?: string;
  webgl_vendor?: string;
  webgl_renderer?: string;
  hardware_concurrency?: number | string;
  device_memory?: number | string;
  screen_width?: number | string;
  screen_height?: number | string;
  user_agent?: string;
  languages?: string;
  color_depth?: number | string;
}

export interface CreateProfilePayload {
  name: string;
  preset?: number | string;
  diversify?: boolean;
  custom?: CustomFingerprint;
  tags?: string[];
  folder?: string;
  proxy?: string | null;
  notes?: string;
}

export interface ProfilesResponse {
  profiles: Profile[];
  active_engine?: string;
  folders?: string[];
  all_tags?: string[];
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

export type SortField = 'name' | 'status' | 'last_used' | 'proxy';
export type SortDirection = 'asc' | 'desc';
