import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, RefreshCw, Shield, Shuffle, Sliders } from 'lucide-react';
import { Modal } from '../components/Modal';
import { ChipInput } from '../components/ui/ChipInput';
import { Combobox } from '../components/ui/Combobox';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { IconButton } from '../components/ui/IconButton';
import { Input } from '../components/ui/Input';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Select } from '../components/ui/Select';
import { Switch } from '../components/ui/Switch';
import { Tabs, TabItem } from '../components/ui/Tabs';
import { Textarea } from '../components/ui/Textarea';
import { t } from '../i18n';
import { api } from '../api';
import { parseGpuName } from '../utils/formatters';
import {
  ConsistencyResult,
  CreateProfilePayload,
  CustomFingerprint,
  Preset,
  Profile,
  ProxyCheckResult,
  ProxyItem,
} from '../types';

type TabId2 = 'general' | 'fingerprint' | 'proxy' | 'advanced';
type ProxySource = 'none' | 'saved' | 'new';

interface ProfileEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  presets: Preset[];
  initialPresetIndex?: number | null;
  proxies: ProxyItem[];
  existingTags: string[];
  folders: string[];
  engineVersion: string;
  existingNames: string[];
  editProfile: Profile | null;
  onCreate: (payload: CreateProfilePayload) => Promise<void>;
  onUpdate: (name: string, fields: Record<string, unknown>) => Promise<void>;
  onCreateAndStart?: (payload: CreateProfilePayload) => Promise<void>;
  onToast: (message: string, type?: 'info' | 'success' | 'error') => void;
}

interface FormState {
  name: string;
  folder: string;
  color: string;
  tags: string[];
  notes: string;
  seed: string;
  os: string;
  platform: string;
  vendor: string;
  renderer: string;
  userAgent: string;
  cores: string;
  memory: string;
  width: string;
  height: string;
  dpr: string;
  colorDepth: string;
  languages: string;
  diversify: boolean;
  langMode: 'proxy' | 'manual';
  tzMode: 'proxy' | 'manual' | 'system';
  timezone: string;
  geoMode: 'block' | 'proxy' | 'manual';
  geoLat: string;
  geoLon: string;
  geoAcc: string;
  webrtcMode: 'disabled' | 'altered' | 'real';
  canvasNoise: boolean;
  webglNoise: boolean;
  audioNoise: boolean;
  clientrectsNoise: boolean;
  fontNoise: boolean;
  portScanProtection: boolean;
  batterySpoof: boolean;
  mediaMic: string;
  mediaCam: string;
  mediaSpk: string;
  dnt: boolean;
  proxySource: ProxySource;
  savedProxyId: string;
  newType: string;
  newHost: string;
  newPort: string;
  newUser: string;
  newPass: string;
  startUrls: string;
  onCloseMode: 'keep' | 'clear_cache' | 'clear_all';
  extraArgs: string;
}

const OS_LABEL: Record<string, string> = {
  win: 'Windows',
  mac: 'macOS',
  ios: 'iOS',
  android: 'Android',
  linux: 'Linux',
};

const OS_BY_PLATFORM: Record<string, string> = {
  Win32: 'win',
  MacIntel: 'mac',
  iPhone: 'ios',
  iPad: 'ios',
  'Linux armv8l': 'android',
  'Linux aarch64': 'android',
  'Linux x86_64': 'linux',
};

const LABEL_COLORS: Array<{ value: string; cssVar: string }> = [
  { value: '', cssVar: 'var(--border-strong)' },
  { value: 'gray', cssVar: 'var(--text-tertiary)' },
  { value: 'blue', cssVar: 'var(--accent)' },
  { value: 'green', cssVar: 'var(--status-success)' },
  { value: 'yellow', cssVar: 'var(--status-warning)' },
  { value: 'red', cssVar: 'var(--status-danger)' },
];

function presetNum(p: Preset): number {
  return p.hardware_concurrency || p.cores || 8;
}

function presetMem(p: Preset): number {
  const mem = p.device_memory || p.memory_gb || 8;
  return Math.min(8, mem);
}

function presetScreen(p: Preset): [number, number] {
  if (p.screen) return p.screen;
  return [p.screen_width || 1920, p.screen_height || 1080];
}

function randomName(): string {
  return `Profile_${Math.floor(100 + Math.random() * 900)}`;
}

function randomSeedHex(): string {
  return (
    Math.floor(Math.random() * 0xffffffff)
      .toString(16)
      .padStart(8, '0') +
    Math.floor(Math.random() * 0xffffffff)
      .toString(16)
      .padStart(8, '0')
  );
}

function gridFromPreset(p: Preset): Partial<FormState> {
  const os = p.os && OS_LABEL[p.os] ? p.os : OS_BY_PLATFORM[p.platform] || 'win';
  const [w, h] = presetScreen(p);
  return {
    os,
    platform: p.platform || 'Win32',
    vendor: p.webgl_vendor || '',
    renderer: p.webgl_renderer || '',
    userAgent: p.user_agent || '',
    cores: String(presetNum(p)),
    memory: String(presetMem(p)),
    width: String(w),
    height: String(h),
    dpr: String(p.device_pixel_ratio || 1),
    colorDepth: String(p.color_depth || 24),
    languages: (p.languages && p.languages.length ? p.languages : ['en-US', 'en']).join(', '),
  };
}

function initialForm(): FormState {
  return {
    name: randomName(),
    folder: '',
    color: '',
    tags: [],
    notes: '',
    seed: randomSeedHex(),
    os: 'win',
    platform: 'Win32',
    vendor: '',
    renderer: '',
    userAgent: '',
    cores: '8',
    memory: '8',
    width: '1920',
    height: '1080',
    dpr: '1',
    colorDepth: '24',
    languages: 'en-US, en',
    diversify: true,
    langMode: 'proxy',
    tzMode: 'proxy',
    timezone: '',
    geoMode: 'proxy',
    geoLat: '',
    geoLon: '',
    geoAcc: '',
    webrtcMode: 'altered',
    canvasNoise: true,
    webglNoise: true,
    audioNoise: true,
    clientrectsNoise: true,
    fontNoise: true,
    portScanProtection: true,
    batterySpoof: true,
    mediaMic: '1',
    mediaCam: '1',
    mediaSpk: '1',
    dnt: false,
    proxySource: 'none',
    savedProxyId: '',
    newType: 'http',
    newHost: '',
    newPort: '',
    newUser: '',
    newPass: '',
    startUrls: '',
    onCloseMode: 'keep',
    extraArgs: '',
  };
}

function validationFields(form: FormState): Record<string, unknown> {
  return {
    os: form.os,
    platform: form.platform,
    webgl_renderer: form.renderer,
    user_agent: form.userAgent,
    hardware_concurrency: parseInt(form.cores, 10),
    device_memory: parseFloat(form.memory),
    screen_width: parseInt(form.width, 10),
    screen_height: parseInt(form.height, 10),
    device_pixel_ratio: parseFloat(form.dpr),
    color_depth: parseInt(form.colorDepth, 10),
    languages: form.languages.split(',').map((s) => s.trim()).filter(Boolean),
    timezone: form.tzMode === 'manual' ? form.timezone.trim() : '',
  };
}

function collectCustom(form: FormState): CustomFingerprint {
  const fields: CustomFingerprint = {
    platform: form.platform,
    hardware_concurrency: form.cores,
    device_memory: form.memory,
    screen_width: form.width,
    screen_height: form.height,
    color_depth: form.colorDepth,
    languages: form.languages,
  };
  if (form.vendor.trim()) fields.webgl_vendor = form.vendor.trim();
  if (form.renderer.trim()) fields.webgl_renderer = form.renderer.trim();
  if (form.userAgent.trim()) fields.user_agent = form.userAgent.trim();
  return fields;
}

function buildProxyUrl(form: FormState): string {
  const auth = form.newUser ? `${form.newUser}:${form.newPass}@` : '';
  return `${form.newType}://${auth}${form.newHost}:${form.newPort}`;
}

function behaviorExtra(form: FormState): Record<string, unknown> {
  const extra: Record<string, unknown> = {
    color: form.color,
    webrtc_mode: form.webrtcMode,
    timezone_mode: form.tzMode,
    locale_mode: form.langMode,
    geo_mode: form.geoMode,
    canvas_noise: form.canvasNoise,
    webgl_noise: form.webglNoise,
    audio_noise: form.audioNoise,
    clientrects_noise: form.clientrectsNoise,
    font_noise: form.fontNoise,
    port_scan_protection: form.portScanProtection,
    battery_spoof: form.batterySpoof,
    dnt: form.dnt,
    media_mic: parseInt(form.mediaMic, 10) || 0,
    media_cam: parseInt(form.mediaCam, 10) || 0,
    media_spk: parseInt(form.mediaSpk, 10) || 0,
    on_close: form.onCloseMode,
    start_urls: form.startUrls.split('\n').map((s) => s.trim()).filter(Boolean),
    extra_args: form.extraArgs.trim(),
  };
  if (form.tzMode === 'manual') extra.timezone = form.timezone.trim();
  if (form.langMode === 'manual') extra.locale = form.languages.split(',')[0]?.trim() || '';
  if (form.geoMode === 'manual') {
    if (form.geoLat.trim()) extra.geo_lat = parseFloat(form.geoLat);
    if (form.geoLon.trim()) extra.geo_lon = parseFloat(form.geoLon);
    if (form.geoAcc.trim()) extra.geo_accuracy = parseFloat(form.geoAcc);
  }
  return extra;
}

function applyFix(form: FormState, fix: Record<string, unknown>): FormState {
  const next = { ...form };
  for (const [key, value] of Object.entries(fix)) {
    if (value === null || value === undefined) continue;
    if (key === 'os' && typeof value === 'string') next.os = value;
    else if (key === 'platform') next.platform = String(value);
    else if (key === 'webgl_renderer') next.renderer = String(value);
    else if (key === 'user_agent') next.userAgent = String(value);
    else if (key === 'device_memory') next.memory = String(value);
    else if (key === 'hardware_concurrency') next.cores = String(value);
    else if (key === 'screen_width') next.width = String(value);
    else if (key === 'screen_height') next.height = String(value);
    else if (key === 'device_pixel_ratio') next.dpr = String(value);
    else if (key === 'languages' && Array.isArray(value)) next.languages = value.join(', ');
    else if (key === 'timezone' && typeof value === 'string') {
      next.timezone = value;
      next.tzMode = 'manual';
    }
  }
  return next;
}

export function ProfileEditDialog({
  isOpen,
  onClose,
  presets,
  initialPresetIndex = null,
  proxies,
  existingTags,
  folders,
  engineVersion,
  existingNames,
  editProfile,
  onCreate,
  onUpdate,
  onCreateAndStart,
  onToast,
}: ProfileEditDialogProps) {
  const { prompt } = useConfirm();
  const [tab, setTab] = useState<TabId2>('general');
  const [form, setForm] = useState<FormState>(initialForm);
  const [presetVal, setPresetVal] = useState('random');
  const [resolvedIdx, setResolvedIdx] = useState(0);
  const [fpDirty, setFpDirty] = useState(false);
  const [validation, setValidation] = useState<ConsistencyResult | null>(null);
  const [proxyCountry, setProxyCountry] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<ProxyCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedToList, setSavedToList] = useState(false);

  const set = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const osPresets = useMemo(
    () => presets.map((p, idx) => ({ p, idx })).filter(({ p }) => !p.os || p.os === form.os),
    [presets, form.os],
  );

  function pickRandomPreset(os: string): number {
    const candidates = presets.map((p, idx) => ({ p, idx })).filter(({ p }) => !p.os || p.os === os);
    if (candidates.length === 0) return 0;
    return candidates[Math.floor(Math.random() * candidates.length)].idx;
  }

  function applyPreset(idx: number) {
    const p = presets[idx];
    if (!p) return;
    setForm((prev) => ({ ...prev, ...gridFromPreset(p) }));
    setResolvedIdx(idx);
    setFpDirty(false);
  }

  const activeEditIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      activeEditIdRef.current = null;
      return;
    }

    const currentId = editProfile
      ? editProfile.name
      : `__NEW_${initialPresetIndex ?? 'rand'}__`;
    if (activeEditIdRef.current === currentId) {
      return;
    }
    activeEditIdRef.current = currentId;

    setTab('general');
    setError('');
    setSaving(false);
    setValidation(null);
    setProxyCountry(null);
    setCheckResult(null);
    setPasteText('');
    setShowPass(false);
    setSavedToList(false);
    setFpDirty(false);

    if (editProfile) {
      const savedMatch = proxies.find((x) => x.url === editProfile.proxy);
      const base = initialForm();
      setForm({
        ...base,
        name: editProfile.name,
        folder: editProfile.folder || '',
        color: editProfile.color || '',
        tags: editProfile.tags || [],
        notes: editProfile.notes || '',
        os: OS_BY_PLATFORM[editProfile.platform || 'Win32'] || 'win',
        platform: editProfile.platform || 'Win32',
        vendor: editProfile.webgl_vendor || '',
        renderer: editProfile.webgl_renderer || '',
        userAgent: editProfile.user_agent || '',
        cores: String(editProfile.hardware_concurrency ?? 8),
        memory: String(editProfile.device_memory ?? 8),
        width: String(editProfile.screen_width ?? 1920),
        height: String(editProfile.screen_height ?? 1080),
        dpr: String(editProfile.device_pixel_ratio ?? 1),
        colorDepth: String(editProfile.color_depth ?? 24),
        languages: (editProfile.languages || []).join(', '),
        diversify: editProfile.diversify !== false,
        langMode: (editProfile.locale_mode as 'proxy' | 'manual') || 'proxy',
        tzMode: (editProfile.timezone_mode as 'proxy' | 'manual' | 'system') || 'proxy',
        timezone: editProfile.timezone || '',
        geoMode: (editProfile.geo_mode as 'block' | 'proxy' | 'manual') || 'proxy',
        geoLat: editProfile.geo_lat != null ? String(editProfile.geo_lat) : '',
        geoLon: editProfile.geo_lon != null ? String(editProfile.geo_lon) : '',
        geoAcc: editProfile.geo_accuracy != null ? String(editProfile.geo_accuracy) : '',
        webrtcMode: (editProfile.webrtc_mode as FormState['webrtcMode']) || 'altered',
        canvasNoise: editProfile.canvas_noise !== false,
        webglNoise: editProfile.webgl_noise !== false,
        audioNoise: editProfile.audio_noise !== false,
        clientrectsNoise: editProfile.clientrects_noise !== false,
        fontNoise: editProfile.font_noise !== false,
        portScanProtection: editProfile.port_scan_protection !== false,
        batterySpoof: editProfile.battery_spoof !== false,
        mediaMic: String(editProfile.media_mic ?? 1),
        mediaCam: String(editProfile.media_cam ?? 1),
        mediaSpk: String(editProfile.media_spk ?? 1),
        dnt: !!editProfile.dnt,
        proxySource: !editProfile.proxy ? 'none' : savedMatch ? 'saved' : 'new',
        savedProxyId: savedMatch?.id || '',
        startUrls: (editProfile.start_urls || []).join('\n'),
        onCloseMode: (editProfile.on_close as FormState['onCloseMode']) || 'keep',
        extraArgs: editProfile.extra_args || '',
      });
      setPresetVal('custom');
      setFpDirty(true);
      setProxyCountry(savedMatch?.country || null);
      if (editProfile.proxy && !savedMatch) {
        api.parseProxies(editProfile.proxy).then((res) => {
          const first = res.parsed[0];
          if (first) {
            setForm((prev) => ({
              ...prev,
              newType: first.type,
              newHost: first.host,
              newPort: String(first.port),
              newUser: first.username,
              newPass: first.password,
            }));
          }
        }).catch(() => undefined);
      }
    } else {
      const base = initialForm();
      setForm(base);
      const idx =
        initialPresetIndex != null && presets[initialPresetIndex]
          ? initialPresetIndex
          : pickRandomPreset('win');
      const p = presets[idx];
      setForm((prev) => ({ ...prev, ...(p ? gridFromPreset(p) : {}) }));
      setResolvedIdx(idx);
      setPresetVal(initialPresetIndex != null ? String(idx) : 'random');
    }
  }, [isOpen, editProfile?.name, initialPresetIndex]);

  function handlePresetChange(value: string) {
    setPresetVal(value);
    if (value === 'custom') {
      setFpDirty(true);
      return;
    }
    const idx = value === 'random' ? pickRandomPreset(form.os) : parseInt(value, 10) || 0;
    setPresetVal(value === 'random' ? 'random' : String(idx));
    applyPreset(idx);
  }

  function handleOsChange(os: string) {
    if (os === form.os) return;
    const idx = pickRandomPreset(os);
    setForm((prev) => ({ ...prev, os }));
    setPresetVal('random');
    if (presets[idx] && (!presets[idx].os || presets[idx].os === os)) {
      setForm((prev) => ({ ...prev, ...gridFromPreset(presets[idx]) }));
      setResolvedIdx(idx);
      setFpDirty(false);
    } else {
      setFpDirty(true);
    }
  }

  function handleRerollIdentity() {
    const idx = pickRandomPreset(form.os);
    const p = presets[idx];
    setForm((prev) => ({
      ...prev,
      seed: randomSeedHex(),
      ...(p ? gridFromPreset(p) : {}),
    }));
    setResolvedIdx(idx);
    setPresetVal('random');
    setFpDirty(false);
    onToast(t.modal.seedRerolled, 'info');
  }

  const validationKey = useMemo(() => {
    return JSON.stringify([
      form.os,
      form.platform,
      form.renderer,
      form.userAgent,
      form.cores,
      form.memory,
      form.width,
      form.height,
      form.dpr,
      form.colorDepth,
      form.languages,
      form.tzMode,
      form.timezone,
      proxyCountry,
    ]);
  }, [
    form.os,
    form.platform,
    form.renderer,
    form.userAgent,
    form.cores,
    form.memory,
    form.width,
    form.height,
    form.dpr,
    form.colorDepth,
    form.languages,
    form.tzMode,
    form.timezone,
    proxyCountry,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      api.validateProfile(validationFields(form), proxyCountry)
        .then((res) => setValidation(res))
        .catch(() => setValidation(null));
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, validationKey]);

  const nameError = useMemo(() => {
    const clean = form.name.trim();
    if (!clean) return t.modal.nameRequired;
    if (existingNames.includes(clean) && clean !== editProfile?.name) {
      return t.modal.nameUniqueness(clean);
    }
    return '';
  }, [form.name, existingNames, editProfile]);

  const fpErrors = validation?.errors || [];
  const fpWarnings = validation?.warnings || [];

  const tabs: TabItem<TabId2>[] = [
    { id: 'general', label: t.modal.dialogGeneral, hasError: !!nameError },
    { id: 'fingerprint', label: 'Anti-Detect & Fingerprint', hasError: fpErrors.length > 0 },
    { id: 'proxy', label: t.modal.dialogProxy, hasError: false },
    { id: 'advanced', label: t.modal.dialogAdvanced, hasError: false },
  ];

  function activeProxy(): { url: string; label: string } | null {
    if (form.proxySource === 'none') return null;
    if (form.proxySource === 'saved') {
      const p = proxies.find((x) => x.id === form.savedProxyId);
      if (!p) return null;
      return { url: p.url, label: `${p.host || p.url}${p.country ? ` · ${p.country}` : ''}` };
    }
    if (!form.newHost || !form.newPort) return null;
    return { url: buildProxyUrl(form), label: `${form.newHost}:${form.newPort}` };
  }

  async function handleParse() {
    if (!pasteText.trim()) return;
    try {
      const res = await api.parseProxies(pasteText);
      const first = res.parsed[0];
      if (first) {
        set({
          proxySource: 'new',
          newType: first.type,
          newHost: first.host,
          newPort: String(first.port),
          newUser: first.username,
          newPass: first.password,
        });
        onToast(t.modal.parsedOk(res.parsed.length), 'success');
      } else {
        onToast(t.modal.parseError, 'error');
      }
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  async function handleCheck() {
    if (!form.newHost || !form.newPort) {
      onToast(t.modal.proxyMissing, 'error');
      return;
    }
    setChecking(true);
    setCheckResult(null);
    try {
      const res = await api.checkProxy(buildProxyUrl(form));
      setCheckResult(res);
      if (res.ok) {
        const cc = res.country || res.country_code || null;
        setProxyCountry(cc ? String(cc) : null);
      }
    } catch (e: unknown) {
      setCheckResult({ ok: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setChecking(false);
    }
  }

  async function handleSaveToList() {
    if (!form.newHost || !form.newPort) return;
    try {
      await api.addProxy(form.newHost, buildProxyUrl(form));
      setSavedToList(true);
      onToast(`${form.newHost}:${form.newPort} -> ${t.modal.saveToList}`, 'success');
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  function collectCreatePayload(cleanName: string): CreateProfilePayload {
    const proxy = activeProxy();
    const payload: CreateProfilePayload = {
      name: cleanName,
      tags: form.tags,
      folder: form.folder.trim(),
      notes: form.notes,
      proxy: proxy ? proxy.url : null,
      extra: behaviorExtra(form),
    };
    if (presetVal === 'custom' || fpDirty) {
      payload.preset = resolvedIdx;
      payload.custom = collectCustom(form);
      payload.diversify = false;
    } else {
      payload.preset = resolvedIdx;
      payload.diversify = form.diversify;
    }
    return payload;
  }

  function collectUpdateFields(): Record<string, unknown> {
    const proxy = activeProxy();
    const fields: Record<string, unknown> = {
      ...behaviorExtra(form),
      tags: form.tags,
      folder: form.folder.trim(),
      notes: form.notes,
      proxy: proxy ? proxy.url : '',
      platform: form.platform,
      hardware_concurrency: parseInt(form.cores, 10),
      device_memory: parseFloat(form.memory),
      screen_width: parseInt(form.width, 10),
      screen_height: parseInt(form.height, 10),
      color_depth: parseInt(form.colorDepth, 10),
      languages: form.languages.split(',').map((s) => s.trim()).filter(Boolean),
    };
    if (form.name.trim()) fields.name = form.name.trim();
    if (form.vendor.trim()) fields.webgl_vendor = form.vendor.trim();
    if (form.renderer.trim()) fields.webgl_renderer = form.renderer.trim();
    if (form.userAgent.trim()) fields.user_agent = form.userAgent.trim();
    return fields;
  }

  async function save(startAfter: boolean) {
    const clean = form.name.trim();
    if (!clean || nameError || saving) return;
    setSaving(true);
    setError('');
    try {
      if (editProfile) {
        await onUpdate(editProfile.name, collectUpdateFields());
      } else {
        const payload = collectCreatePayload(clean);
        if (startAfter && onCreateAndStart) {
          await onCreateAndStart(payload);
        } else {
          await onCreate(payload);
        }
      }
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAsTemplate() {
    const suggested = form.name.trim();
    const tplName = await prompt({
      title: t.modal.saveAsTemplate,
      description: 'Enter a name for this profile template:',
      defaultValue: suggested,
      placeholder: 'Template name...',
      confirmLabel: 'Save Template',
      cancelLabel: 'Cancel',
    });
    if (!tplName || !tplName.trim()) return;
    try {
      const proxy = activeProxy();
      const config = {
        ...validationFields(form),
        webgl_vendor: form.vendor.trim() || undefined,
        ...(behaviorExtra(form)),
        proxy: proxy ? proxy.url : '',
        folder: form.folder.trim(),
        tags: form.tags,
        notes: form.notes,
        diversify: form.diversify,
      };
      await api.saveTemplate(tplName.trim(), config);
      onToast(t.modal.savedTemplate(tplName.trim()), 'success');
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void save(false);
  }

  function fixButton(finding: { fix?: Record<string, unknown> | null }) {
    if (!finding.fix) return null;
    return (
      <button
        type="button"
        className="btn btn-secondary"
        style={{ height: 24, padding: '0 8px', fontSize: 11 }}
        onClick={() => {
          setForm((prev) => applyFix(prev, finding.fix as Record<string, unknown>));
          setFpDirty(true);
          onToast(t.modal.fixed, 'success');
        }}
      >
        {t.modal.fix}
      </button>
    );
  }

  const score = validation?.score ?? null;
  const scoreColor =
    score == null
      ? 'var(--text-tertiary)'
      : score >= 90
        ? 'var(--status-success)'
        : score >= 70
          ? 'var(--status-warning)'
          : 'var(--status-danger)';

  const summaryProxy = activeProxy();

  const activeShields = useMemo(() => {
    const items: Array<{ label: string; on: boolean }> = [
      { label: 'Canvas 2D', on: form.canvasNoise },
      { label: 'WebGL 3D', on: form.webglNoise },
      { label: 'AudioContext', on: form.audioNoise },
      { label: 'ClientRects', on: form.clientrectsNoise },
      { label: 'Font Metrics', on: form.fontNoise },
      { label: 'Port Shield', on: form.portScanProtection },
      { label: 'Battery Spoof', on: form.batterySpoof },
      { label: 'WebRTC Guard', on: form.webrtcMode !== 'real' },
      { label: 'IP Timezone', on: form.tzMode !== 'system' },
    ];
    return items;
  }, [
    form.canvasNoise,
    form.webglNoise,
    form.audioNoise,
    form.clientrectsNoise,
    form.fontNoise,
    form.portScanProtection,
    form.batterySpoof,
    form.webrtcMode,
    form.tzMode,
  ]);

  const activeShieldCount = activeShields.filter((s) => s.on).length;

  const summaryRow = (label: string, value: ReactNode, titleText?: string) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: '5px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>{label}</span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-mono)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'right',
        }}
        title={titleText || (typeof value === 'string' ? value : undefined)}
      >
        {value}
      </span>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      title={editProfile ? t.modal.editProfileTitle(editProfile.name) : t.modal.createProfileTitle}
      onClose={onClose}
      maxWidth={960}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            {t.modal.cancel}
          </button>
          {!editProfile && (
            <button type="button" className="btn btn-ghost" onClick={handleSaveAsTemplate} disabled={saving}>
              {t.modal.saveAsTemplate}
            </button>
          )}
          <button
            type="submit"
            form="profile-edit-form"
            className="btn btn-secondary"
            disabled={saving || !!nameError}
          >
            {saving ? t.modal.creating : editProfile ? t.modal.save : t.modal.create}
          </button>
          {!editProfile && onCreateAndStart && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void save(true)}
              disabled={saving || !!nameError}
            >
              {t.modal.createAndStart}
            </button>
          )}
        </>
      }
    >
      <form
        id="profile-edit-form"
        onSubmit={handleSubmit}
        style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}
      >
        {/* Left: Tabs + Form Sections */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Tabs tabs={tabs} activeTab={tab} onChange={setTab} />

          {error && (
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: 'rgba(220, 38, 38, 0.08)',
                border: '1px solid var(--status-danger)',
                borderRadius: 'var(--radius-control)',
                fontSize: 12.5,
                color: 'var(--status-danger)',
              }}
            >
              {error}
            </div>
          )}

          {tab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Profile Name + Folder + Color */}
              <div className="section-card">
                <div>
                  <label className="field-label">{t.modal.profileName}</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <Input
                        value={form.name}
                        onChange={(e) => set({ name: e.target.value })}
                        error={nameError}
                        disabled={!!editProfile}
                        style={editProfile ? { opacity: 0.7 } : undefined}
                      />
                    </div>
                    {!editProfile && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        title={t.modal.shuffleName}
                        onClick={() => set({ name: randomName() })}
                        style={{ padding: '0 12px', flexShrink: 0 }}
                      >
                        <Shuffle size={14} strokeWidth={1.75} />
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 14 }}>
                  <div>
                    <label className="field-label">{t.modal.folderLabel}</label>
                    <Combobox
                      value={form.folder}
                      onChange={(v) => set({ folder: v })}
                      options={folders}
                    />
                  </div>

                  <div>
                    <label className="field-label">{t.modal.colorLabel}</label>
                    <div
                      style={{
                        height: 'var(--control-height)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {LABEL_COLORS.map((c) => (
                        <button
                          key={c.value || 'none'}
                          type="button"
                          onClick={() => set({ color: c.value })}
                          aria-label={c.value || 'no color'}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 'var(--radius-control)',
                            border: `2px solid ${
                              form.color === c.value ? 'var(--accent)' : 'var(--border)'
                            }`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            backgroundColor: 'var(--bg-surface)',
                          }}
                        >
                          <span
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              backgroundColor: c.cssVar,
                              display: 'block',
                            }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Anti-Detect & Hardware Identity Setup right on General Tab */}
              <div className="section-card">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Shield size={16} strokeWidth={2} color="var(--accent)" />
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                      Anti-Detect & Hardware Identity
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleRerollIdentity}
                      style={{ height: 28, padding: '0 10px', fontSize: 12 }}
                    >
                      <RefreshCw size={12} strokeWidth={1.75} />
                      <span>Randomize Identity</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setTab('fingerprint')}
                      style={{ height: 28, padding: '0 10px', fontSize: 12 }}
                    >
                      <Sliders size={12} strokeWidth={1.75} />
                      <span>Advanced Anti-Detect</span>
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14, alignItems: 'end' }}>
                  <div>
                    <label className="field-label">{t.modal.osLabel}</label>
                    <SegmentedControl
                      value={form.os}
                      onChange={handleOsChange}
                      options={[
                        { value: 'win', label: t.modal.osWindows },
                        { value: 'mac', label: t.modal.osMac },
                        { value: 'linux', label: t.modal.osLinux },
                      ]}
                    />
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <label className="field-label">{t.modal.preset} ({osPresets.length} templates)</label>
                    <Select
                      value={presetVal}
                      onChange={(e) => handlePresetChange(e.target.value)}
                    >
                      <option value="random">{t.modal.presetRandom}</option>
                      {osPresets.map(({ p, idx }) => (
                        <option key={idx} value={String(idx)}>
                          {p.label ||
                            `${p.name || p.webgl_renderer || 'Standard'} · ${presetNum(p)}C/${presetMem(p)}GB · ${presetScreen(p)[0]}x${presetScreen(p)[1]}`}
                        </option>
                      ))}
                      <option value="custom">{t.modal.customOption}</option>
                    </Select>
                  </div>
                </div>

                {/* Quick Anti-Detect Toggles */}
                <div
                  style={{
                    borderTop: '1px solid var(--border)',
                    paddingTop: 10,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 10,
                  }}
                >
                  <Switch
                    checked={form.canvasNoise}
                    onChange={(v) => set({ canvasNoise: v })}
                    label="Canvas 2D Noise"
                  />
                  <Switch
                    checked={form.webglNoise}
                    onChange={(v) => set({ webglNoise: v })}
                    label="WebGL 3D Spoof"
                  />
                  <Switch
                    checked={form.audioNoise}
                    onChange={(v) => set({ audioNoise: v })}
                    label="AudioContext Noise"
                  />
                  <Switch
                    checked={form.clientrectsNoise}
                    onChange={(v) => set({ clientrectsNoise: v })}
                    label="ClientRects Jitter"
                  />
                  <Switch
                    checked={form.fontNoise}
                    onChange={(v) => set({ fontNoise: v })}
                    label="Font Fingerprint"
                  />
                  <Switch
                    checked={form.portScanProtection}
                    onChange={(v) => set({ portScanProtection: v })}
                    label="Port Scan Shield"
                  />
                </div>
              </div>

              {/* Tags & Notes */}
              <div className="section-card">
                <div>
                  <label className="field-label">{t.modal.tags}</label>
                  <ChipInput
                    tags={form.tags}
                    onChange={(tags) => set({ tags })}
                    suggestions={existingTags}
                  />
                </div>

                <div>
                  <label className="field-label">{t.modal.notesLabel}</label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => set({ notes: e.target.value })}
                    placeholder="Tambahkan catatan akun, email, atau keterangan profil..."
                    style={{ minHeight: 68 }}
                  />
                </div>
              </div>
            </div>
          )}

          {tab === 'fingerprint' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Card 1: Hardware & Device Specification */}
              <div className="section-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                    Hardware & Browser Emulation
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{t.modal.seedLabel}:</span>
                    <code
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        color: 'var(--accent)',
                        backgroundColor: 'var(--accent-subtle)',
                        padding: '2px 8px',
                        borderRadius: 6,
                      }}
                    >
                      {form.seed}
                    </code>
                    <IconButton
                      tooltip={t.modal.seedRegenerate}
                      size="sm"
                      onClick={handleRerollIdentity}
                    >
                      <RefreshCw size={13} strokeWidth={1.75} />
                    </IconButton>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12, alignItems: 'end' }}>
                  <div>
                    <label className="field-label">{t.modal.osLabel}</label>
                    <SegmentedControl
                      value={form.os}
                      onChange={handleOsChange}
                      options={[
                        { value: 'win', label: t.modal.osWindows },
                        { value: 'mac', label: t.modal.osMac },
                        { value: 'linux', label: t.modal.osLinux },
                      ]}
                    />
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <label className="field-label">{t.modal.preset}</label>
                    <Select
                      value={presetVal}
                      onChange={(e) => handlePresetChange(e.target.value)}
                    >
                      <option value="random">{t.modal.presetRandom}</option>
                      {osPresets.map(({ p, idx }) => (
                        <option key={idx} value={String(idx)}>
                          {p.label ||
                            `${p.name || p.webgl_renderer || 'Standard'} · ${presetNum(p)}C/${presetMem(p)}GB · ${presetScreen(p)[0]}x${presetScreen(p)[1]}`}
                        </option>
                      ))}
                      <option value="custom">{t.modal.customOption}</option>
                    </Select>
                  </div>
                </div>

                {presetVal !== 'custom' && !fpDirty && (
                  <div>
                    <Switch
                      checked={form.diversify}
                      onChange={(v) => set({ diversify: v })}
                      label={t.modal.diversify}
                    />
                    <span className="field-hint">{t.modal.diversifyHint}</span>
                  </div>
                )}

                <div className="fp-grid">
                  <div>
                    <label className="field-label">{t.modal.platform}</label>
                    <Select
                      value={form.platform}
                      onChange={(e) => {
                        set({ platform: e.target.value });
                        setFpDirty(true);
                      }}
                    >
                      <option value="Win32">Win32</option>
                      <option value="MacIntel">MacIntel</option>
                      <option value="Linux x86_64">Linux x86_64</option>
                    </Select>
                  </div>
                  <div>
                    <label className="field-label">{t.modal.cores}</label>
                    <Input
                      type="number"
                      min={1}
                      max={128}
                      value={form.cores}
                      onChange={(e) => {
                        set({ cores: e.target.value });
                        setFpDirty(true);
                      }}
                    />
                  </div>
                  <div>
                    <label className="field-label">{t.modal.ram}</label>
                    <Select
                      value={form.memory}
                      onChange={(e) => {
                        set({ memory: e.target.value });
                        setFpDirty(true);
                      }}
                    >
                      {['0.25', '0.5', '1', '2', '4', '8'].map((m) => (
                        <option key={m} value={m}>{m} GB</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="field-label">{t.modal.colorDepth}</label>
                    <Select
                      value={form.colorDepth}
                      onChange={(e) => {
                        set({ colorDepth: e.target.value });
                        setFpDirty(true);
                      }}
                    >
                      <option value="24">24-bit</option>
                      <option value="30">30-bit</option>
                    </Select>
                  </div>
                  <div>
                    <label className="field-label">{t.modal.resWidth}</label>
                    <Input
                      type="number"
                      min={400}
                      max={7680}
                      value={form.width}
                      onChange={(e) => {
                        set({ width: e.target.value });
                        setFpDirty(true);
                      }}
                    />
                  </div>
                  <div>
                    <label className="field-label">{t.modal.resHeight}</label>
                    <Input
                      type="number"
                      min={400}
                      max={7680}
                      value={form.height}
                      onChange={(e) => {
                        set({ height: e.target.value });
                        setFpDirty(true);
                      }}
                    />
                  </div>
                  <div>
                    <label className="field-label">{t.modal.dprLabel}</label>
                    <Select
                      value={form.dpr}
                      onChange={(e) => {
                        set({ dpr: e.target.value });
                        setFpDirty(true);
                      }}
                    >
                      {['1', '1.25', '1.5', '2'].map((d) => (
                        <option key={d} value={d}>{d}x</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="field-label">{t.modal.webglVendor}</label>
                    <Input
                      value={form.vendor}
                      onChange={(e) => {
                        set({ vendor: e.target.value });
                        setFpDirty(true);
                      }}
                      placeholder="Google Inc. (NVIDIA)"
                    />
                  </div>
                  <div className="fp-full">
                    <label className="field-label">{t.modal.webglRenderer}</label>
                    <Input
                      value={form.renderer}
                      onChange={(e) => {
                        set({ renderer: e.target.value });
                        setFpDirty(true);
                      }}
                      placeholder="ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)"
                    />
                  </div>
                  <div className="fp-full">
                    <label className="field-label">{t.modal.userAgent}</label>
                    <Input
                      value={form.userAgent}
                      onChange={(e) => {
                        set({ userAgent: e.target.value });
                        setFpDirty(true);
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Anti-Detect Shield & Fingerprint Noise */}
              <div className="section-card">
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Anti-Detect Shield & Fingerprint Noise
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Switch
                    checked={form.canvasNoise}
                    onChange={(v) => set({ canvasNoise: v })}
                    label="Canvas 2D Noise (getImageData / toDataURL)"
                  />
                  <Switch
                    checked={form.webglNoise}
                    onChange={(v) => set({ webglNoise: v })}
                    label="WebGL 3D & ReadPixels Noise"
                  />
                  <Switch
                    checked={form.audioNoise}
                    onChange={(v) => set({ audioNoise: v })}
                    label="AudioContext Signal Perturbation"
                  />
                  <Switch
                    checked={form.clientrectsNoise}
                    onChange={(v) => set({ clientrectsNoise: v })}
                    label="ClientRects DOM Sub-pixel Jitter"
                  />
                  <Switch
                    checked={form.fontNoise}
                    onChange={(v) => set({ fontNoise: v })}
                    label="Font Metrics Fingerprint Masking"
                  />
                  <Switch
                    checked={form.portScanProtection}
                    onChange={(v) => set({ portScanProtection: v })}
                    label="Localhost Port Scan Protection"
                  />
                  <Switch
                    checked={form.batterySpoof}
                    onChange={(v) => set({ batterySpoof: v })}
                    label="Battery & Power Status Spoofing"
                  />
                  <Switch
                    checked={form.dnt}
                    onChange={(v) => set({ dnt: v })}
                    label={t.modal.dntLabel}
                  />
                </div>
              </div>

              {/* Card 3: Network Environment & IP Auto-Match */}
              <div className="section-card">
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Environment & Browser IP Auto-Match (VPN / Proxy)
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label className="field-label">{t.modal.timezoneLabel}</label>
                    <SegmentedControl
                      size="sm"
                      value={form.tzMode}
                      onChange={(v) => set({ tzMode: v as FormState['tzMode'] })}
                      options={[
                        { value: 'proxy', label: t.modal.tzModeProxy },
                        { value: 'manual', label: t.modal.tzModeManual },
                        { value: 'system', label: 'System' },
                      ]}
                    />
                    {form.tzMode === 'manual' && (
                      <div style={{ marginTop: 8 }}>
                        <Input
                          value={form.timezone}
                          onChange={(e) => set({ timezone: e.target.value })}
                          placeholder="Asia/Jakarta"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="field-label">{t.modal.languageMode}</label>
                    <SegmentedControl
                      size="sm"
                      value={form.langMode}
                      onChange={(v) => set({ langMode: v as FormState['langMode'] })}
                      options={[
                        { value: 'proxy', label: t.modal.langModeProxy },
                        { value: 'manual', label: t.modal.langModeManual },
                      ]}
                    />
                    {form.langMode === 'manual' && (
                      <div style={{ marginTop: 8 }}>
                        <Input
                          value={form.languages}
                          onChange={(e) => {
                            set({ languages: e.target.value });
                            setFpDirty(true);
                          }}
                          placeholder="id-ID, id, en-US, en"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label className="field-label">{t.modal.geoLabel}</label>
                    <SegmentedControl
                      size="sm"
                      value={form.geoMode}
                      onChange={(v) => set({ geoMode: v as FormState['geoMode'] })}
                      options={[
                        { value: 'block', label: t.modal.geoBlock },
                        { value: 'proxy', label: t.modal.geoProxy },
                        { value: 'manual', label: 'Manual' },
                      ]}
                    />
                  </div>

                  <div>
                    <label className="field-label">{t.modal.webrtcLabel}</label>
                    <SegmentedControl
                      size="sm"
                      value={form.webrtcMode}
                      onChange={(v) => set({ webrtcMode: v as FormState['webrtcMode'] })}
                      options={[
                        { value: 'disabled', label: t.modal.webrtcDisabled },
                        { value: 'altered', label: t.modal.webrtcAltered },
                        { value: 'real', label: t.modal.webrtcReal },
                      ]}
                    />
                  </div>
                </div>

                {form.geoMode === 'manual' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    <div>
                      <label className="field-label">Latitude</label>
                      <Input
                        value={form.geoLat}
                        onChange={(e) => set({ geoLat: e.target.value })}
                        placeholder="-6.2"
                      />
                    </div>
                    <div>
                      <label className="field-label">Longitude</label>
                      <Input
                        value={form.geoLon}
                        onChange={(e) => set({ geoLon: e.target.value })}
                        placeholder="106.8"
                      />
                    </div>
                    <div>
                      <label className="field-label">Accuracy (m)</label>
                      <Input
                        value={form.geoAcc}
                        onChange={(e) => set({ geoAcc: e.target.value })}
                        placeholder="100"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="field-label">{t.modal.mediaLabel}</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    <div>
                      <span className="field-hint" style={{ marginTop: 0, marginBottom: 4 }}>
                        {t.modal.mediaMic}
                      </span>
                      <Input
                        type="number"
                        min={0}
                        max={4}
                        value={form.mediaMic}
                        onChange={(e) => set({ mediaMic: e.target.value })}
                        sizeVariant="sm"
                      />
                    </div>
                    <div>
                      <span className="field-hint" style={{ marginTop: 0, marginBottom: 4 }}>
                        {t.modal.mediaCam}
                      </span>
                      <Input
                        type="number"
                        min={0}
                        max={4}
                        value={form.mediaCam}
                        onChange={(e) => set({ mediaCam: e.target.value })}
                        sizeVariant="sm"
                      />
                    </div>
                    <div>
                      <span className="field-hint" style={{ marginTop: 0, marginBottom: 4 }}>
                        {t.modal.mediaSpk}
                      </span>
                      <Input
                        type="number"
                        min={0}
                        max={4}
                        value={form.mediaSpk}
                        onChange={(e) => set({ mediaSpk: e.target.value })}
                        sizeVariant="sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'proxy' && (
            <div className="section-card">
              <div>
                <label className="field-label">{t.modal.proxySource}</label>
                <SegmentedControl
                  value={form.proxySource}
                  onChange={(v) => set({ proxySource: v as ProxySource })}
                  options={[
                    { value: 'none', label: t.modal.proxyNone },
                    { value: 'saved', label: t.modal.proxySaved },
                    { value: 'new', label: t.modal.proxyNew },
                  ]}
                />
              </div>

              {form.proxySource === 'saved' && (
                <div>
                  <label className="field-label">{t.modal.proxySaved}</label>
                  {proxies.length === 0 ? (
                    <span className="field-hint">{t.empty.proxiesEmptyTitle}</span>
                  ) : (
                    <Select
                      value={form.savedProxyId}
                      onChange={(e) => {
                        set({ savedProxyId: e.target.value });
                        const p = proxies.find((x) => x.id === e.target.value);
                        setProxyCountry(p?.country || null);
                      }}
                    >
                      <option value="">-</option>
                      {proxies.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title || p.url}{p.country ? ` · ${p.country}` : ''}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
              )}

              {form.proxySource === 'new' && (
                <>
                  <div className="fp-grid">
                    <div>
                      <label className="field-label">{t.modal.proxyType}</label>
                      <Select value={form.newType} onChange={(e) => set({ newType: e.target.value })}>
                        {['http', 'https', 'socks4', 'socks5'].map((tp) => (
                          <option key={tp} value={tp}>{tp.toUpperCase()}</option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label className="field-label">{t.modal.proxyHost}</label>
                      <Input value={form.newHost} onChange={(e) => set({ newHost: e.target.value })} placeholder="1.2.3.4" />
                    </div>
                    <div>
                      <label className="field-label">{t.modal.proxyPort}</label>
                      <Input type="number" min={1} max={65535} value={form.newPort} onChange={(e) => set({ newPort: e.target.value })} placeholder="8080" />
                    </div>
                    <div>
                      <label className="field-label">{t.modal.proxyUser}</label>
                      <Input value={form.newUser} onChange={(e) => set({ newUser: e.target.value })} />
                    </div>
                    <div className="fp-full">
                      <label className="field-label">{t.modal.proxyPass}</label>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <Input
                            type={showPass ? 'text' : 'password'}
                            value={form.newPass}
                            onChange={(e) => set({ newPass: e.target.value })}
                          />
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          title={showPass ? t.modal.proxyHide : t.modal.proxyShow}
                          onClick={() => setShowPass((v) => !v)}
                          style={{ padding: '0 12px', flexShrink: 0 }}
                        >
                          {showPass ? <EyeOff size={14} strokeWidth={1.75} /> : <Eye size={14} strokeWidth={1.75} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="field-label">{t.modal.pasteBox}</label>
                    <Textarea
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      placeholder={t.modal.pasteHint}
                      style={{ minHeight: 56, fontFamily: 'var(--font-mono)', fontSize: 12 }}
                    />
                    <span className="field-hint">{t.modal.pasteHint}</span>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button type="button" className="btn btn-secondary" onClick={handleParse}>
                        {t.modal.parseBtn}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleCheck}
                      disabled={checking}
                    >
                      {checking ? t.modal.checking : t.modal.checkBtn}
                    </button>
                    {checkResult && (
                      <span
                        style={{
                          fontSize: 'var(--text-caption)',
                          fontFamily: 'var(--font-mono)',
                          color: checkResult.ok ? 'var(--status-success)' : 'var(--status-danger)',
                        }}
                      >
                        {checkResult.ok
                          ? (checkResult.country || checkResult.country_code
                              ? t.modal.checkOkCountry(
                                  String(checkResult.ip),
                                  String(checkResult.country || checkResult.country_code),
                                  checkResult.latency_ms || 0,
                                )
                              : t.modal.checkOk(String(checkResult.ip), checkResult.latency_ms || 0))
                          : `${t.modal.checkFailed}: ${checkResult.error || ''}`}
                      </span>
                    )}
                  </div>

                  {checkResult?.ok && !savedToList && (
                    <div>
                      <button type="button" className="btn btn-ghost" onClick={handleSaveToList}>
                        {t.modal.saveToList}
                      </button>
                    </div>
                  )}

                  <span className="field-hint">{t.modal.proxyAuthNote}</span>
                </>
              )}
            </div>
          )}

          {tab === 'advanced' && (
            <div className="section-card">
              <div>
                <label className="field-label">{t.modal.advStartUrls}</label>
                <Textarea
                  value={form.startUrls}
                  onChange={(e) => set({ startUrls: e.target.value })}
                  placeholder={'https://example.com'}
                  style={{ minHeight: 68, fontFamily: 'var(--font-mono)', fontSize: 12 }}
                />
              </div>

              <div>
                <label className="field-label">{t.modal.advOnClose}</label>
                <SegmentedControl
                  value={form.onCloseMode}
                  onChange={(v) => set({ onCloseMode: v as FormState['onCloseMode'] })}
                  options={[
                    { value: 'keep', label: t.modal.closeKeep },
                    { value: 'clear_cache', label: t.modal.closeClearCache },
                    { value: 'clear_all', label: t.modal.closeClearAll },
                  ]}
                />
              </div>

              <div>
                <label className="field-label">{t.modal.advExtraArgs}</label>
                <Textarea
                  value={form.extraArgs}
                  onChange={(e) => set({ extraArgs: e.target.value })}
                  placeholder="--mute-audio --blink-settings=imageLoadingEnabled=false"
                  style={{ minHeight: 68, fontFamily: 'var(--font-mono)', fontSize: 12 }}
                />
                <span className="field-hint" style={{ color: 'var(--status-warning)' }}>
                  {t.modal.advArgsWarning}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Structured Summary & Anti-Detect Status Card */}
        <div
          style={{
            width: 296,
            flexShrink: 0,
            backgroundColor: 'var(--bg-base)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-panel)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              {t.modal.dialogSummary}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--accent)',
                backgroundColor: 'var(--accent-subtle)',
                padding: '2px 8px',
                borderRadius: 99,
              }}
            >
              {activeShieldCount}/{activeShields.length} Shields
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {summaryRow(t.modal.summaryOs, OS_LABEL[form.os] || form.os)}
            {summaryRow(
              t.modal.summaryBrowser,
              engineVersion ? `Chrome ${engineVersion.split('.')[0]}` : 'Chrome',
            )}
            {summaryRow(
              t.modal.summaryGpu,
              parseGpuName(form.renderer) || '-',
              form.renderer,
            )}
            {summaryRow(t.modal.summaryCpu, `${form.cores || '?'}C / ${form.memory || '?'}GB`)}
            {summaryRow(t.modal.summaryScreen, `${form.width || '?'}×${form.height || '?'} @${form.dpr}x`)}
            {summaryRow(
              t.modal.summaryTimezone,
              form.tzMode === 'manual'
                ? form.timezone || '-'
                : form.tzMode === 'system'
                  ? 'System'
                  : 'Auto (Browser IP)',
            )}
            {summaryRow(
              t.modal.summaryLanguage,
              form.langMode === 'manual'
                ? form.languages.split(',').slice(0, 2).join(', ')
                : 'Auto (Browser IP)',
            )}
            {summaryRow(
              t.modal.summaryProxy,
              summaryProxy
                ? `${summaryProxy.label}${proxyCountry ? ` · ${proxyCountry}` : ''}`
                : 'Direct / VPN Ext',
            )}
          </div>

          {/* Active Anti-Detect Shield Pills */}
          <div>
            <span
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-tertiary)',
                marginBottom: 6,
              }}
            >
              Active Anti-Detect Layers
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {activeShields.map((s) => (
                <span
                  key={s.label}
                  style={{
                    fontSize: 10.5,
                    fontWeight: 500,
                    padding: '2px 7px',
                    borderRadius: 6,
                    backgroundColor: s.on ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                    color: s.on ? 'var(--accent)' : 'var(--text-tertiary)',
                    border: `1px solid ${s.on ? 'transparent' : 'var(--border)'}`,
                  }}
                >
                  {s.label}
                </span>
              ))}
            </div>
          </div>

          {/* Consistency Score Card */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-control)',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
                {t.modal.consistencyScore}
              </span>
              <span style={{ fontSize: 18, fontWeight: 700, color: scoreColor }}>
                {score == null ? '-' : score}
              </span>
            </div>

            {fpErrors.length === 0 && fpWarnings.length === 0 && score != null && (
              <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--status-success)' }}>
                {t.modal.consistencyGood}
              </span>
            )}

            {[...fpErrors, ...fpWarnings].map((f, i) => (
              <div
                key={`${f.rule}_${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 6,
                  marginTop: 4,
                  padding: '6px 8px',
                  backgroundColor: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    marginTop: 5,
                    flexShrink: 0,
                    backgroundColor:
                      i < fpErrors.length ? 'var(--status-danger)' : 'var(--status-warning)',
                  }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1 }}>
                  {f.message}
                </span>
                {fixButton(f)}
              </div>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
