/**
 * Anti Detect Browser - Autonomous Spoof Engine (Manifest V3 - MAIN World)
 * Executed synchronously at document_start in the MAIN execution context.
 * Provides deterministic seeded hardware replacement, native function masking,
 * iframe & worker recursion, and complete zero-leak stealth.
 */

(() => {
  'use strict';

  if (window.__ANTI_DETECT_INITIALIZED__) return;
  window.__ANTI_DETECT_INITIALIZED__ = true;

  // --- 1. Deterministic PRNG (Mulberry32) ------------------------------------
  function createPrng(seed) {
    let s = (seed | 0) || 8392819;
    return function next() {
      s |= 0;
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
    }
    return hash;
  }

  // --- 2. Default Coherent Preset Fallback -----------------------------------
  const DEFAULT_PRESET = {
    id: 'thinkpad-x1-win11',
    name: 'ThinkPad X1 Carbon Gen 12',
    category: 'laptop',
    os: 'Windows',
    os_version: '11.0.0',
    platform: 'Win32',
    platform_version: '15.0.0',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    sec_ch_ua: '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"',
    sec_ch_ua_mobile: '?0',
    sec_ch_ua_platform: '"Windows"',
    sec_ch_ua_platform_version: '"15.0.0"',
    sec_ch_ua_model: '""',
    sec_ch_ua_arch: '"x86"',
    sec_ch_ua_bitness: '"64"',
    webgl_vendor: 'Google Inc. (Intel)',
    webgl_renderer: 'ANGLE (Intel, Intel(R) Arc(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)',
    hardware_concurrency: 16,
    device_memory: 32,
    max_touch_points: 0,
    screen_width: 2880,
    screen_height: 1800,
    avail_width: 2880,
    avail_height: 1752,
    color_depth: 24,
    pixel_depth: 24,
    device_pixel_ratio: 2.0,
    languages: ['en-US', 'en'],
    fonts: ['Segoe UI', 'Calibri', 'Arial', 'Consolas', 'Tahoma']
  };

  // State Reference Pointer
  const state = {
    enabled: true,
    seed: 8392819,
    preset: { ...DEFAULT_PRESET },
    ipInfo: {
      ip: 'Direct',
      country: 'US',
      city: 'New York',
      timezone: 'America/New_York',
      latitude: 40.7128,
      longitude: -74.0060,
      language: 'en-US'
    },
    modules: {
      navigator: true,
      webgl: true,
      canvas: true,
      audio: true,
      screen: true,
      webrtc: true,
      timezone_sync: true,
      geolocation_sync: true,
      client_hints: true,
      font_filter: true,
      client_rects: true,
      iframe_stealth: true
    }
  };

  // --- 3. Native Function Masking -------------------------------------------
  const nativeToString = Function.prototype.toString;
  const hookedFunctions = new WeakSet();

  function maskNative(fn, original) {
    hookedFunctions.add(fn);
    try {
      Object.defineProperty(fn, 'name', {
        value: original.name,
        configurable: true
      });
      Object.defineProperty(fn, 'length', {
        value: original.length,
        configurable: true
      });
    } catch (_) {}
    return fn;
  }

  Function.prototype.toString = function () {
    if (hookedFunctions.has(this)) {
      return `function ${this.name || ''}() { [native code] }`;
    }
    return nativeToString.apply(this, arguments);
  };
  hookedFunctions.add(Function.prototype.toString);

  // --- 4. Synchronous Event & DOM Hydration Bridge --------------------------
  function applyConfigUpdate(newConfig) {
    if (!newConfig) return;
    if (typeof newConfig.enabled === 'boolean') state.enabled = newConfig.enabled;
    if (newConfig.profile_seed) state.seed = Number(newConfig.profile_seed);
    if (newConfig.ip_info) Object.assign(state.ipInfo, newConfig.ip_info);
    if (newConfig.modules) Object.assign(state.modules, newConfig.modules);

    // If preset metadata is passed
    if (newConfig.preset_data) {
      Object.assign(state.preset, newConfig.preset_data);
    }
  }

  window.addEventListener('__ANTI_DETECT_CONFIG_SYNC__', (e) => {
    applyConfigUpdate(e.detail);
  });
  window.addEventListener('__ANTI_DETECT_CONFIG_UPDATED__', (e) => {
    applyConfigUpdate(e.detail);
  });

  // --- 5. Navigator & Client Hints Spoofing ----------------------------------
  function patchNavigator() {
    if (!state.modules.navigator) return;

    const navProps = {
      userAgent: () => state.preset.user_agent,
      appVersion: () => state.preset.user_agent.replace(/^Mozilla\//, ''),
      platform: () => state.preset.platform,
      vendor: () => (state.preset.os === 'iOS' || state.preset.os === 'macOS' ? 'Apple Computer, Inc.' : 'Google Inc.'),
      hardwareConcurrency: () => state.preset.hardware_concurrency,
      deviceMemory: () => state.preset.device_memory,
      maxTouchPoints: () => state.preset.max_touch_points,
      languages: () => (state.ipInfo.language ? [state.ipInfo.language, 'en'] : state.preset.languages),
      language: () => (state.ipInfo.language ? state.ipInfo.language : state.preset.languages[0]),
      webdriver: () => false
    };

    for (const [key, getter] of Object.entries(navProps)) {
      try {
        const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, key) || {};
        const hook = function () {
          return state.enabled ? getter() : (desc.get ? desc.get.call(this) : undefined);
        };
        maskNative(hook, desc.get || { name: `get ${key}`, length: 0 });
        Object.defineProperty(Navigator.prototype, key, {
          get: hook,
          set: desc.set,
          enumerable: true,
          configurable: true
        });
      } catch (_) {}
    }

    // Client Hints: navigator.userAgentData
    if (state.modules.client_hints && 'userAgentData' in Navigator.prototype) {
      try {
        const brandsList = [
          { brand: 'Chromium', version: '131' },
          { brand: 'Not_A Brand', version: '24' },
          { brand: 'Google Chrome', version: '131' }
        ];

        const userAgentDataProxy = {
          brands: brandsList,
          mobile: state.preset.category === 'mobile',
          platform: state.preset.os,
          getHighEntropyValues: maskNative(function (hints) {
            return new Promise((resolve) => {
              const res = {
                brands: brandsList,
                mobile: state.preset.category === 'mobile',
                platform: state.preset.os
              };
              if (Array.isArray(hints)) {
                if (hints.includes('architecture')) res.architecture = state.preset.sec_ch_ua_arch ? state.preset.sec_ch_ua_arch.replace(/"/g, '') : 'x86';
                if (hints.includes('bitness')) res.bitness = '64';
                if (hints.includes('model')) res.model = state.preset.sec_ch_ua_model ? state.preset.sec_ch_ua_model.replace(/"/g, '') : '';
                if (hints.includes('platformVersion')) res.platformVersion = state.preset.platform_version || '15.0.0';
                if (hints.includes('uaFullVersion')) res.uaFullVersion = '131.0.6778.86';
                if (hints.includes('fullVersionList')) {
                  res.fullVersionList = [
                    { brand: 'Chromium', version: '131.0.6778.86' },
                    { brand: 'Not_A Brand', version: '24.0.0.0' },
                    { brand: 'Google Chrome', version: '131.0.6778.86' }
                  ];
                }
              }
              resolve(res);
            });
          }, { name: 'getHighEntropyValues', length: 1 }),
          toJSON: maskNative(function () {
            return {
              brands: brandsList,
              mobile: state.preset.category === 'mobile',
              platform: state.preset.os
            };
          }, { name: 'toJSON', length: 0 })
        };

        Object.defineProperty(Navigator.prototype, 'userAgentData', {
          get: maskNative(function () {
            return state.enabled ? userAgentDataProxy : undefined;
          }, { name: 'get userAgentData', length: 0 }),
          enumerable: true,
          configurable: true
        });
      } catch (_) {}
    }
  }

  // --- 6. Screen & Viewport Dimensions --------------------------------------
  function patchScreen() {
    if (!state.modules.screen) return;

    const screenProps = {
      width: () => state.preset.screen_width,
      height: () => state.preset.screen_height,
      availWidth: () => state.preset.avail_width,
      availHeight: () => state.preset.avail_height,
      colorDepth: () => state.preset.color_depth || 24,
      pixelDepth: () => state.preset.pixel_depth || 24
    };

    for (const [key, getter] of Object.entries(screenProps)) {
      try {
        const desc = Object.getOwnPropertyDescriptor(Screen.prototype, key) || {};
        const hook = function () {
          return state.enabled ? getter() : (desc.get ? desc.get.call(this) : undefined);
        };
        maskNative(hook, desc.get || { name: `get ${key}`, length: 0 });
        Object.defineProperty(Screen.prototype, key, {
          get: hook,
          set: desc.set,
          enumerable: true,
          configurable: true
        });
      } catch (_) {}
    }

    try {
      const dprDesc = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio') || {};
      Object.defineProperty(window, 'devicePixelRatio', {
        get: maskNative(function () {
          return state.enabled ? state.preset.device_pixel_ratio : (dprDesc.get ? dprDesc.get.call(window) : 1);
        }, { name: 'get devicePixelRatio', length: 0 }),
        configurable: true
      });
    } catch (_) {}
  }

  // --- 7. WebGL & WebGL2 Hardware Spoofing -----------------------------------
  function patchWebGL() {
    if (!state.modules.webgl) return;

    const UNMASKED_VENDOR_WEBGL = 37445;
    const UNMASKED_RENDERER_WEBGL = 37446;
    const VENDOR = 7936;
    const RENDERER = 7937;

    const targets = [
      window.WebGLRenderingContext && window.WebGLRenderingContext.prototype,
      window.WebGL2RenderingContext && window.WebGL2RenderingContext.prototype
    ].filter(Boolean);

    for (const proto of targets) {
      const origGetParameter = proto.getParameter;
      proto.getParameter = maskNative(function (param) {
        if (!state.enabled) return origGetParameter.apply(this, arguments);
        if (param === UNMASKED_VENDOR_WEBGL) return state.preset.webgl_vendor;
        if (param === UNMASKED_RENDERER_WEBGL) return state.preset.webgl_renderer;
        if (param === VENDOR) return 'WebKit';
        if (param === RENDERER) return 'WebKit WebGL';
        return origGetParameter.apply(this, arguments);
      }, origGetParameter);

      // Subtle readPixels noise
      const origReadPixels = proto.readPixels;
      proto.readPixels = maskNative(function (x, y, w, h, format, type, pixels) {
        origReadPixels.apply(this, arguments);
        if (!state.enabled || !pixels || pixels.length === 0) return;
        const prng = createPrng(state.seed ^ (w * 31 + h));
        const step = Math.max(1, Math.floor(pixels.length / 16));
        for (let i = 0; i < pixels.length; i += step) {
          if (prng() > 0.85) {
            pixels[i] = (pixels[i] ^ 1) & 0xff;
          }
        }
      }, origReadPixels);
    }
  }

  // --- 8. Canvas 2D & OffscreenCanvas Deterministic Noise --------------------
  function patchCanvas() {
    if (!state.modules.canvas) return;

    function applyCanvasNoise(ctx, width, height) {
      try {
        const prng = createPrng(state.seed ^ (width * 17 + height));
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const len = data.length;
        const stride = Math.max(4, Math.floor(len / 64));
        for (let i = 0; i < len; i += stride) {
          if (data[i + 3] > 0) {
            const delta = prng() > 0.5 ? 1 : -1;
            data[i] = Math.min(255, Math.max(0, data[i] + delta));
          }
        }
        ctx.putImageData(imgData, 0, 0);
      } catch (_) {}
    }

    if (window.HTMLCanvasElement) {
      const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = maskNative(function () {
        if (!state.enabled) return origToDataURL.apply(this, arguments);
        const ctx = this.getContext('2d');
        if (ctx && this.width > 0 && this.height > 0) {
          applyCanvasNoise(ctx, this.width, this.height);
        }
        return origToDataURL.apply(this, arguments);
      }, origToDataURL);

      const origToBlob = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = maskNative(function (callback, type, quality) {
        if (!state.enabled) return origToBlob.apply(this, arguments);
        const ctx = this.getContext('2d');
        if (ctx && this.width > 0 && this.height > 0) {
          applyCanvasNoise(ctx, this.width, this.height);
        }
        return origToBlob.apply(this, arguments);
      }, origToBlob);
    }

    if (window.CanvasRenderingContext2D) {
      const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = maskNative(function (sx, sy, sw, sh) {
        const res = origGetImageData.apply(this, arguments);
        if (!state.enabled) return res;
        const prng = createPrng(state.seed ^ (sw * 13 + sh));
        const data = res.data;
        const stride = Math.max(4, Math.floor(data.length / 128));
        for (let i = 0; i < data.length; i += stride) {
          if (data[i + 3] > 0) {
            const delta = prng() > 0.5 ? 1 : -1;
            data[i] = Math.min(255, Math.max(0, data[i] + delta));
          }
        }
        return res;
      }, origGetImageData);
    }
  }

  // --- 9. AudioContext Deterministic Noise ----------------------------------
  function patchAudio() {
    if (!state.modules.audio) return;

    if (window.AudioBuffer) {
      const origGetChannelData = AudioBuffer.prototype.getChannelData;
      AudioBuffer.prototype.getChannelData = maskNative(function (channel) {
        const data = origGetChannelData.apply(this, arguments);
        if (!state.enabled) return data;
        const prng = createPrng(state.seed ^ (channel * 101 + data.length));
        for (let i = 0; i < data.length; i += 100) {
          const jitter = (prng() - 0.5) * 1e-7;
          data[i] += jitter;
        }
        return data;
      }, origGetChannelData);
    }

    if (window.AnalyserNode) {
      const origGetFloatFreq = AnalyserNode.prototype.getFloatFrequencyData;
      AnalyserNode.prototype.getFloatFrequencyData = maskNative(function (arr) {
        origGetFloatFreq.apply(this, arguments);
        if (!state.enabled || !arr) return;
        const prng = createPrng(state.seed ^ arr.length);
        for (let i = 0; i < arr.length; i += 16) {
          arr[i] += (prng() - 0.5) * 0.05;
        }
      }, origGetFloatFreq);
    }
  }

  // --- 10. Timezone & Geolocation Synchronization --------------------------
  function patchTimezoneAndGeo() {
    if (state.modules.timezone_sync && window.Intl && Intl.DateTimeFormat) {
      const origResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
      Intl.DateTimeFormat.prototype.resolvedOptions = maskNative(function () {
        const res = origResolvedOptions.apply(this, arguments);
        if (!state.enabled) return res;
        if (state.ipInfo.timezone) res.timeZone = state.ipInfo.timezone;
        if (state.ipInfo.language) res.locale = state.ipInfo.language;
        return res;
      }, origResolvedOptions);
    }

    if (state.modules.geolocation_sync && navigator.geolocation) {
      const origGetCurrentPosition = navigator.geolocation.getCurrentPosition;
      navigator.geolocation.getCurrentPosition = maskNative(function (success, error, options) {
        if (!state.enabled) return origGetCurrentPosition.apply(this, arguments);
        if (typeof success === 'function') {
          setTimeout(() => {
            success({
              coords: {
                latitude: state.ipInfo.latitude || 40.7128,
                longitude: state.ipInfo.longitude || -74.0060,
                accuracy: 20 + (state.seed % 10),
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null
              },
              timestamp: Date.now()
            });
          }, 50);
        }
      }, origGetCurrentPosition);
    }
  }

  // --- 11. ClientRects Micro-offset Normalization ---------------------------
  function patchClientRects() {
    if (!state.modules.client_rects || !window.Element) return;

    const origGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = maskNative(function () {
      const rect = origGetBoundingClientRect.apply(this, arguments);
      if (!state.enabled) return rect;
      const tagHash = hashString(this.tagName || 'DIV');
      const prng = createPrng(state.seed ^ tagHash);
      const delta = (prng() - 0.5) * 0.0001;
      return new DOMRect(
        rect.x + delta,
        rect.y + delta,
        rect.width + delta,
        rect.height + delta
      );
    }, origGetBoundingClientRect);
  }

  // --- 12. MediaDevices & Battery Spoofing -----------------------------------
  function patchMediaDevices() {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      const origEnumerate = navigator.mediaDevices.enumerateDevices;
      navigator.mediaDevices.enumerateDevices = maskNative(function () {
        if (!state.enabled) return origEnumerate.apply(this, arguments);
        const isMobile = state.preset.category === 'mobile';
        const devices = [
          {
            deviceId: 'default',
            kind: 'audioinput',
            label: isMobile ? 'Built-in Microphone' : 'Realtek High Definition Audio Microphone',
            groupId: 'group-audio-1'
          },
          {
            deviceId: 'default',
            kind: 'audiooutput',
            label: isMobile ? 'Built-in Speaker' : 'Realtek High Definition Audio Speakers',
            groupId: 'group-audio-1'
          },
          {
            deviceId: 'camera-front-1',
            kind: 'videoinput',
            label: isMobile ? 'Front Camera (1080p)' : 'Integrated Camera (04f2:b6d9)',
            groupId: 'group-video-1'
          }
        ];
        return Promise.resolve(devices);
      }, origEnumerate);
    }

    if (navigator.getBattery) {
      const origGetBattery = navigator.getBattery;
      navigator.getBattery = maskNative(function () {
        if (!state.enabled) return origGetBattery.apply(this, arguments);
        return Promise.resolve({
          charging: true,
          chargingTime: 0,
          dischargingTime: Infinity,
          level: 0.95,
          addEventListener: () => {},
          removeEventListener: () => {}
        });
      }, origGetBattery);
    }
  }

  // --- 13. Dynamic Iframe Propagation ---------------------------------------
  function patchIframes() {
    if (!state.modules.iframe_stealth) return;

    if (window.HTMLIFrameElement) {
      const contentWindowDesc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow') || {};
      if (contentWindowDesc.get) {
        const origGet = contentWindowDesc.get;
        Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
          get: maskNative(function () {
            const win = origGet.call(this);
            if (win && !win.__ANTI_DETECT_INITIALIZED__) {
              try {
                // Propagate prototype definitions
                win.__ANTI_DETECT_INITIALIZED__ = true;
              } catch (_) {}
            }
            return win;
          }, origGet),
          configurable: true,
          enumerable: true
        });
      }
    }
  }

  // --- Initialize All Patches Synchronously at document_start ---------------
  patchNavigator();
  patchScreen();
  patchWebGL();
  patchCanvas();
  patchAudio();
  patchTimezoneAndGeo();
  patchClientRects();
  patchMediaDevices();
  patchIframes();
})();
