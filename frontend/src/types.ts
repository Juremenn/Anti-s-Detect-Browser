export type TabId = 'profiles' | 'proxies' | 'templates' | 'trash' | 'settings';

export interface Profile {
  name: string;
  created_at?: string;
  canvas_seed?: string;
  webgl_renderer?: string;
  platform?: string;
  hardware_concurrency?: number;
  device_memory?: number;
  screen_width?: number;
  screen_height?: number;
  audio_noise?: boolean;
  webrtc_mode?: string;
  proxy?: string;
  tags?: string[];
  notes?: string;
  folder?: string;
  is_active?: boolean;
  pid?: number | null;
}

export interface TrashItem {
  trash_id: string;
  name: string;
  trashed_at: number | string;
  webgl_renderer?: string;
  platform?: string;
}

export interface ProxyItem {
  id: string;
  title: string;
  url: string;
  added_at?: number;
}

export interface Preset {
  label: string;
  platform: string;
  gpu_vendor: string;
  gpu_renderer: string;
  cores: number;
  memory_gb: number;
  screen: [number, number];
}

export interface AppSettings {
  browser_path: string;
  start_url: string;
  mask_webrtc: boolean;
  active_browser_path?: string;
  browsers?: string[];
}

export interface CreateProfilePayload {
  name: string;
  preset?: number;
  tags?: string[];
  proxy?: string | null;
  notes?: string;
}

export interface ProfilesResponse {
  profiles: Profile[];
  folders: string[];
  active_engine: string;
  trash_count: number;
}

export interface ToastMessage {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'error';
}
