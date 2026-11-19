export type TabId = 'profiles' | 'proxies' | 'templates' | 'extensions' | 'trash' | 'settings';
export type ThemeMode = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

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
  device_pixel_ratio?: number;
  audio_noise?: boolean;
  webrtc_mode?: string;
  timezone_mode?: string;
  timezone?: string;
  locale_mode?: string;
  locale?: string;
  geo_mode?: string;
  geo_lat?: number;
  geo_lon?: number;
  geo_accuracy?: number;
  canvas_noise?: boolean;
  webgl_noise?: boolean;
  clientrects_noise?: boolean;
  font_noise?: boolean;
  port_scan_protection?: boolean;
  battery_spoof?: boolean;
  dnt?: boolean;
  media_mic?: number;
  media_cam?: number;
  media_spk?: number;
  on_close?: string;
  start_urls?: string[];
  extra_args?: string;
  browser_version?: string;
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
  category?: string;
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
  engine_version?: string;
  geoip_db?: string | null;
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
  extra?: Record<string, unknown>;
}

export interface ParsedProxy {
  type: string;
  host: string;
  port: number;
  username: string;
  password: string;
  line?: number;
}

export interface ProxyCheckResult {
  ok: boolean;
  ip?: string | null;
  country?: string | null;
  country_code?: string | null;
  latency_ms?: number | null;
  error?: string | null;
}

export interface ConsistencyFinding {
  rule: string;
  message: string;
  fix?: Record<string, unknown> | null;
}

export interface ConsistencyResult {
  score: number;
  errors: ConsistencyFinding[];
  warnings: ConsistencyFinding[];
}

export interface TemplateEntry {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
  os?: string;
  webgl_renderer?: string;
  hardware_concurrency?: number;
  device_memory?: number;
  screen_width?: number;
  screen_height?: number;
  [key: string]: unknown;
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

export interface ExtensionConfig {
  selected_preset_id: string;
  modules: {
    navigator?: boolean;
    webgl?: boolean;
    canvas?: boolean;
    audio?: boolean;
    screen?: boolean;
    webrtc?: boolean;
    timezone_sync?: boolean;
    geolocation_sync?: boolean;
    client_hints?: boolean;
    font_filter?: boolean;
    client_rects?: boolean;
    iframe_stealth?: boolean;
  };
  proxy_rotation_url?: string;
  auto_rotate?: boolean;
}

export interface Extension {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
  source_type: 'crx' | 'unpacked';
  path: string;
  manifest_version?: number;
  permissions?: string[];
  icon_url?: string;
  status?: 'ready' | 'missing' | 'error';
  configurable?: boolean;
  builtIn?: boolean;
  config?: ExtensionConfig;
}

export interface AuthUser {
  sub?: string;
  name: string;
  email: string;
  picture: string;
}

export interface AuthStatusResponse {
  authenticated: boolean;
  configured: boolean;
  user: AuthUser | null;
  client_id?: string;
  has_client_secret?: boolean;
  pending?: boolean;
  last_error?: string | null;
}

export interface AuthConfigResponse {
  status: string;
  configured: boolean;
  client_id: string;
  has_client_secret?: boolean;
}

export interface AuthStartResponse {
  auth_url: string;
  state: string;
  redirect_uri?: string;
}

