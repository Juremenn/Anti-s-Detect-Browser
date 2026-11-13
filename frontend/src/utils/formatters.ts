/**
 * formatters.ts - Parsing and string formatters for dense, single-line data display.
 */

import { Profile } from '../types';

/**
 * Parses out clean GPU brand and model from verbose ANGLE/WebGL renderer strings.
 * Example inputs:
 *  - "ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)" -> "RTX 3070"
 *  - "ANGLE (Apple, Apple M2, OpenGL 4.1)" -> "Apple M2"
 *  - "ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)" -> "Intel UHD 630"
 */
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

  // Fallback: truncate cleanly
  return str.length > 28 ? `${str.substring(0, 26)}...` : str;
}

/**
 * Returns single line spec: "[GPU] · [Cores]C/[RAM]GB · [Width]×[Height]"
 */
export function formatFingerprintSpec(profile: Profile): string {
  const gpu = parseGpuName(profile.webgl_renderer);
  const cores = profile.hardware_concurrency || 8;
  const ram = profile.device_memory || 8;
  const w = profile.screen_width || 1920;
  const h = profile.screen_height || 1080;
  return `${gpu} · ${cores}C/${ram}GB · ${w}×${h}`;
}

/**
 * Formats a proxy string into host:port without credentials, plus protocol.
 */
export function formatProxy(proxyStr?: string | null): {
  isDirect: boolean;
  hostPort: string;
  protocol: string;
} {
  if (!proxyStr || !proxyStr.trim()) {
    return { isDirect: true, hostPort: 'Direct', protocol: '' };
  }

  const raw = proxyStr.trim();
  try {
    const url = new URL(raw.includes('://') ? raw : `http://${raw}`);
    const protocol = (url.protocol.replace(':', '') || 'http').toUpperCase();
    const hostPort = `${url.hostname}${url.port ? `:${url.port}` : ''}`;
    return { isDirect: false, hostPort, protocol };
  } catch {
    // Fallback if URL parsing fails: strip auth if any
    const withoutScheme = raw.replace(/^https?:\/\/|^socks[45]:\/\//i, '');
    const withoutAuth = withoutScheme.includes('@') ? withoutScheme.split('@')[1] : withoutScheme;
    return { isDirect: false, hostPort: withoutAuth, protocol: 'PROXY' };
  }
}
