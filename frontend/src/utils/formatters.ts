import { t } from '../i18n';
import { Profile } from '../types';

export function parseGpuName(rawRenderer?: string): string {
  if (!rawRenderer) return 'Standard GPU';
  const str = rawRenderer.trim();

  // Apple Silicon
  const appleMatch = str.match(/Apple\s+M\d+(\s+(?:Pro|Max|Ultra))?/i);
  if (appleMatch) return appleMatch[0];

  // NVIDIA RTX / GTX
  const rtxMatch = str.match(/RTX\s+\d{3,4}(?:\s*Ti|\s*Super)?/i);
  if (rtxMatch) return rtxMatch[0].toUpperCase();

  const gtxMatch = str.match(/GTX\s+\d{3,4}(?:\s*Ti)?/i);
  if (gtxMatch) return gtxMatch[0].toUpperCase();

  // AMD Radeon
  const radeonMatch = str.match(/Radeon\s+(?:RX\s+)?[\w\d]+/i);
  if (radeonMatch) return radeonMatch[0];

  // Intel Iris / UHD / Arc
  const intelIrisMatch = str.match(/Iris(?:\s+(?:Xe|Plus))?(?:\s+Graphics)?(?:\s+\d+)?/i);
  if (intelIrisMatch) return `Intel ${intelIrisMatch[0]}`;

  const intelUhdMatch = str.match(/UHD\s+Graphics(?:\s+\d+)?/i);
  if (intelUhdMatch) return `Intel ${intelUhdMatch[0]}`;

  const arcMatch = str.match(/Arc\s+[A-Z]\d+/i);
  if (arcMatch) return `Intel ${arcMatch[0]}`;

  // If inside parentheses like ANGLE (vendor, device, backend)
  const parenMatch = str.match(/ANGLE\s*\([^,]+,\s*([^,]+)/i);
  if (parenMatch && parenMatch[1]) {
    let clean = parenMatch[1].replace(/Direct3D\d+|OpenGL.*|vs_\d+_\d+|ps_\d+_\d+/gi, '').trim();
    clean = clean.replace(/NVIDIA\s+GeForce\s+/i, 'RTX ');
    clean = clean.replace(/\(R\)|\(TM\)/gi, '').trim();
    if (clean.length > 25) clean = clean.substring(0, 25);
    return clean;
  }

  return str.length > 28 ? `${str.substring(0, 26)}...` : str;
}

export function formatFingerprintSpec(profile: Profile): string {
  const gpu = parseGpuName(profile.webgl_renderer);
  const cores = profile.hardware_concurrency || 8;
  const ram = profile.device_memory || 8;
  const w = profile.screen_width || 1920;
  const h = profile.screen_height || 1080;
  return `${gpu} · ${cores}C/${ram}GB · ${w}×${h}`;
}

export function formatProxy(proxyStr?: string | null): {
  isDirect: boolean;
  hostPort: string;
  protocol: string;
  countryCode: string;
} {
  if (!proxyStr || !proxyStr.trim()) {
    return { isDirect: true, hostPort: t.table.directProxy, protocol: '', countryCode: '' };
  }

  const raw = proxyStr.trim();
  try {
    const url = new URL(raw.includes('://') ? raw : `http://${raw}`);
    const protocol = (url.protocol.replace(':', '') || 'http').toUpperCase();
    const hostPort = `${url.hostname}${url.port ? `:${url.port}` : ''}`;
    // Simple heuristic for country/flag if present or default
    return { isDirect: false, hostPort, protocol, countryCode: '' };
  } catch {
    const withoutScheme = raw.replace(/^https?:\/\/|^socks[45]:\/\//i, '');
    const withoutAuth = withoutScheme.includes('@') ? withoutScheme.split('@')[1] : withoutScheme;
    return { isDirect: false, hostPort: withoutAuth, protocol: 'PROXY', countryCode: '' };
  }
}

export function formatRelativeTime(timestamp?: number | string): string {
  if (!timestamp) return t.table.neverUsed;
  const num = typeof timestamp === 'number' ? timestamp : parseInt(String(timestamp), 10);
  if (isNaN(num) || num <= 0) return t.table.neverUsed;

  // normalize seconds vs ms
  const tsMs = num < 10000000000 ? num * 1000 : num;
  const diffSec = Math.floor((Date.now() - tsMs) / 1000);

  if (diffSec < 60) return t.table.justNow;
  if (diffSec < 3600) return t.table.minutesAgo(Math.floor(diffSec / 60));
  if (diffSec < 86400) return t.table.hoursAgo(Math.floor(diffSec / 3600));
  return t.table.daysAgo(Math.floor(diffSec / 86400));
}
