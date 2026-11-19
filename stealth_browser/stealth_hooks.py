"""
stealth_hooks.py - In-page JavaScript hooks for the Fresh Device engine.

Injected as the primary mechanism via CDP Page.addScriptToEvaluateOnNewDocument
(engine level, applies to every new document) and, through CDP auto-attach,
also to iframes, Web Workers, Shared Workers and Service Workers.

Design rules (per spec 4.3):
  - Overriden properties live on the prototype, not on instances.
  - Hooked functions pass Function.prototype.toString checks ("[native code]")
    and keep the original name/length.
  - Noise is deterministic per content: two identical reads return identical
    bytes (same session), so the values are stable like a real device, while
    different profiles/seeds give different bytes.
"""

import json

JS_TEMPLATE = r"""
(() => {
  'use strict';
  const PROFILE = __PROFILE_CONFIG__;

  // --- seeded PRNG (mulberry32) for noise tables -------------------------------
  function mulberry32(seed) {
    let a = (seed >>> 0) || 0x9e3779b9;
    return function() {
      a = (a + 0x6D2B79F5) | 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // A fixed per-seed table: noise values never depend on call order, only on
  // the byte/content position, so repeated reads of identical content match.
  function noiseTable(seed, n) {
    const rng = mulberry32(seed);
    const table = new Int8Array(n);
    for (let i = 0; i < n; i++) table[i] = rng() > 0.5 ? 1 : -1;
    return table;
  }
  const canvasTable = noiseTable(PROFILE.canvas_seed || 1337, 512);
  const audioTable  = noiseTable(PROFILE.audio_seed || 4242, 512);
  const rectTable   = noiseTable(PROFILE.font_seed || 9999, 512);
  const mediaTable  = noiseTable(PROFILE.media_seed || 7777, 512);

  function tableSign(table, i) { return table[(i | 0) & (table.length - 1)]; }

  // --- toString guard ----------------------------------------------------------
  const nativeToString = Function.prototype.toString;
  const hooked = new WeakSet();
  function markNative(fn, original) {
    hooked.add(fn);
    try {
      Object.defineProperty(fn, 'name', { value: original.name, configurable: true });
      Object.defineProperty(fn, 'length', { value: original.length, configurable: true });
    } catch (e) {}
  }
  try {
    const toStringFn = function toString() {
      return hooked.has(this) ? 'function ' + (this.name || '') + '() { [native code] }'
                              : nativeToString.call(this);
    };
    markNative(toStringFn, Function.prototype.toString);
    Object.defineProperty(Function.prototype, 'toString', {
      value: toStringFn, writable: true, configurable: true, enumerable: false,
    });
    hooked.add(toStringFn);
  } catch (e) {}

  // --- 1. webdriver / automation ------------------------------------------------
  try {
    delete Object.getPrototypeOf(navigator).webdriver;
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined, configurable: true, enumerable: true,
    });
  } catch (e) {}

  // --- 2. hardware & navigator ---------------------------------------------------
  try {
    if (PROFILE.hardware_concurrency) {
      Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', {
        get: () => PROFILE.hardware_concurrency, configurable: true, enumerable: true,
      });
    }
    if (PROFILE.device_memory) {
      Object.defineProperty(Navigator.prototype, 'deviceMemory', {
        get: () => PROFILE.device_memory, configurable: true, enumerable: true,
      });
    }
    if (PROFILE.platform) {
      Object.defineProperty(Navigator.prototype, 'platform', {
        get: () => PROFILE.platform, configurable: true, enumerable: true,
      });
    }
    const langs = PROFILE.languages && PROFILE.languages.length ? PROFILE.languages : null;
    if (langs) {
      Object.defineProperty(Navigator.prototype, 'languages', {
        get: () => Object.freeze([...langs]), configurable: true, enumerable: true,
      });
      Object.defineProperty(Navigator.prototype, 'language', {
        get: () => langs[0], configurable: true, enumerable: true,
      });
    }
    if (typeof PROFILE.dnt === 'boolean') {
      Object.defineProperty(Navigator.prototype, 'doNotTrack', {
        get: () => PROFILE.dnt ? '1' : null, configurable: true, enumerable: true,
      });
    }
  } catch (e) {}

  // --- 3. screen geometry (incl. DPR & avail) ------------------------------------
  try {
    const w = PROFILE.screen_width || window.screen.width;
    const h = PROFILE.screen_height || window.screen.height;
    const availH = Math.max(h - (PROFILE.avail_offset || 40), Math.floor(h * 0.7));
    const depth = PROFILE.color_depth || 24;
    const dpr = PROFILE.device_pixel_ratio || window.devicePixelRatio || 1;
    for (const [prop, val] of [['width', w], ['height', h], ['availWidth', w],
                               ['availHeight', availH], ['colorDepth', depth], ['pixelDepth', depth]]) {
      Object.defineProperty(Screen.prototype, prop, {
        get: () => val, configurable: true, enumerable: true,
      });
    }
    Object.defineProperty(window, 'devicePixelRatio', {
      get: () => dpr, configurable: true, enumerable: true,
    });
  } catch (e) {}

  // --- 4. WebGL -------------------------------------------------------------------
  try {
    const vendor = PROFILE.webgl_vendor || '';
    const renderer = PROFILE.webgl_renderer || '';
    const maxTex = PROFILE.webgl_max_texture_size || 0;
    const VENDOR = 0x9245, RENDERER = 0x9246, MAX_TEXTURE = 0x0D33;
    function hookWebGL(proto) {
      if (!proto) return;
      const orig = proto.getParameter;
      if (!orig) return;
      const hookedGet = function getParameter(param) {
        if (param === VENDOR && vendor) return vendor;
        if (param === RENDERER && renderer) return renderer;
        if (param === MAX_TEXTURE && maxTex) return maxTex;
        return orig.apply(this, arguments);
      };
      markNative(hookedGet, orig);
      proto.getParameter = hookedGet;
    }
    if (PROFILE.webgl_noise !== false) {
      hookWebGL(window.WebGLRenderingContext && WebGLRenderingContext.prototype);
      hookWebGL(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype);

      function hookReadPixels(proto) {
        if (!proto || !proto.readPixels) return;
        const origRead = proto.readPixels;
        const readHook = function readPixels(...args) {
          origRead.apply(this, args);
          try {
            const pixels = args[6];
            if (pixels && (pixels instanceof Uint8Array || pixels instanceof Uint8ClampedArray) && pixels.length >= 16) {
              let anchor = 0;
              const stride = Math.max(4, Math.floor(pixels.length / 32));
              for (let i = 0; i < pixels.length; i += stride) anchor = (anchor + pixels[i]) & 511;
              const step = Math.max(16, Math.floor(pixels.length / 128));
              for (let i = anchor % step; i < pixels.length; i += step) {
                const n = tableSign(canvasTable, (i + anchor) & 511);
                pixels[i] = Math.min(255, Math.max(0, pixels[i] + n));
              }
            }
          } catch (e) {}
        };
        markNative(readHook, origRead);
        proto.readPixels = readHook;
      }
      hookReadPixels(window.WebGLRenderingContext && WebGLRenderingContext.prototype);
      hookReadPixels(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype);
    }
  } catch (e) {}

  // --- 5. canvas: deterministic per-content noise ----------------------------------
  try {
    if (PROFILE.canvas_noise !== false) {
      const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
      const origToBlob = HTMLCanvasElement.prototype.toBlob;

      function perturb(imageData) {
        const d = imageData.data;
        const len = d.length;
        // Content-derived table offset: same content -> same noise every time.
        let anchor = 0;
        const stride = Math.max(1, Math.floor(len / 64)) * 4;
        for (let i = 0; i < len; i += stride) anchor = (anchor + d[i]) & 511;
        const step = Math.max(4, Math.floor(len / 512) / 4 | 0) * 4;
        for (let i = anchor % step; i < len; i += step) {
          const n = tableSign(canvasTable, i / step + anchor);
          d[i] = Math.min(255, Math.max(0, d[i] + n));
        }
        return imageData;
      }

      const getImageDataHook = function getImageData(...args) {
        return perturb(origGetImageData.apply(this, args));
      };
      markNative(getImageDataHook, origGetImageData);
      CanvasRenderingContext2D.prototype.getImageData = getImageDataHook;

      const toDataURLHook = function toDataURL(...args) {
        try {
          const ctx = this.getContext('2d');
          if (ctx && this.width > 0 && this.height > 0) {
            const img = origGetImageData.call(ctx, 0, 0, this.width, this.height);
            perturb(img);
            ctx.putImageData(img, 0, 0);
          }
        } catch (e) {}
        return origToDataURL.apply(this, args);
      };
      markNative(toDataURLHook, origToDataURL);
      HTMLCanvasElement.prototype.toDataURL = toDataURLHook;

      const toBlobHook = function toBlob(callback, ...args) {
        try {
          const ctx = this.getContext('2d');
          if (ctx && this.width > 0 && this.height > 0) {
            const img = origGetImageData.call(ctx, 0, 0, this.width, this.height);
            perturb(img);
            ctx.putImageData(img, 0, 0);
          }
        } catch (e) {}
        return origToBlob.apply(this, [callback, ...args]);
      };
      markNative(toBlobHook, origToBlob);
      HTMLCanvasElement.prototype.toBlob = toBlobHook;
    }
  } catch (e) {}

  // --- 6. audio: deterministic per-content noise ------------------------------------
  try {
    if (PROFILE.audio_noise !== false) {
      if (window.AnalyserNode) {
        const origFloat = AnalyserNode.prototype.getFloatFrequencyData;
        const floatHook = function getFloatFrequencyData(array) {
          origFloat.apply(this, arguments);
          let anchor = 0;
          const step = Math.max(1, Math.floor(array.length / 64));
          for (let i = 0; i < array.length; i += step) anchor = (anchor + ((array[i] * 100) | 0)) & 511;
          for (let i = anchor % 7; i < array.length; i += 7) {
            array[i] += tableSign(audioTable, i / 7 + anchor) * 0.0001;
          }
        };
        markNative(floatHook, origFloat);
        AnalyserNode.prototype.getFloatFrequencyData = floatHook;
      }
      if (window.AudioBuffer) {
        const origChannel = AudioBuffer.prototype.getChannelData;
        const channelHook = function getChannelData(channel) {
          const data = origChannel.apply(this, arguments);
          let anchor = 0;
          const len = data.length;
          const stride = Math.max(1, Math.floor(len / 64));
          for (let i = 0; i < len; i += stride) anchor = (anchor + ((data[i] * 1e6) | 0)) & 511;
          const step = Math.max(8, Math.floor(len / 500));
          for (let i = anchor % step; i < len; i += step) {
            data[i] += tableSign(audioTable, i / step + anchor) * 0.00002;
          }
          return data;
        };
        markNative(channelHook, origChannel);
        AudioBuffer.prototype.getChannelData = channelHook;
      }
    }
  } catch (e) {}

  // --- 7. ClientRects: deterministic per-rect jitter ---------------------------------
  try {
    if (PROFILE.clientrects_noise !== false) {
      const origRects = Element.prototype.getClientRects;
      const rectsHook = function getClientRects() {
        const rects = origRects.apply(this, arguments);
        const out = [];
        for (let i = 0; i < rects.length; i++) {
          const r = rects[i];
          const seed = (r.x * 4096 + r.y * 64 + r.width * 2 + r.height) & 511;
          const dx = tableSign(rectTable, seed) * 0.001;
          out.push(new DOMRect(r.x + dx, r.y + dx,
                               r.width + dx * 0.5, r.height + dx * 0.5));
        }
        return out;
      };
      markNative(rectsHook, origRects);
      Element.prototype.getClientRects = rectsHook;

      const origBound = Element.prototype.getBoundingClientRect;
      const boundHook = function getBoundingClientRect() {
        const r = origBound.apply(this, arguments);
        const seed = (r.x * 4096 + r.y * 64 + r.width * 2 + r.height) & 511;
        const dx = tableSign(rectTable, seed) * 0.001;
        return new DOMRect(r.x + dx, r.y + dx, r.width + dx * 0.5, r.height + dx * 0.5);
      };
      markNative(boundHook, origBound);
      Element.prototype.getBoundingClientRect = boundHook;
    }
  } catch (e) {}

  // --- 8. WebRTC -----------------------------------------------------------------------
  // Engine level: --force-webrtc-ip-handling-policy (set by the launcher).
  // JS layer only scrubs local addresses from SDP when masking is on.
  try {
    if (PROFILE.webrtc_mode !== 'real' && window.RTCPeerConnection) {
      const origOffer = RTCPeerConnection.prototype.createOffer;
      const offerHook = function createOffer(...args) {
        return origOffer.apply(this, args).then((offer) => {
          if (offer && offer.sdp) {
            offer.sdp = offer.sdp.replace(
              /(candidate[^ ]* [0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/g, '$1x');
          }
          return offer;
        });
      };
      markNative(offerHook, origOffer);
      RTCPeerConnection.prototype.createOffer = offerHook;
    }
  } catch (e) {}

  // --- 9. media devices (counts + deterministic ids) -------------------------------------
  try {
    const mic = PROFILE.media_mic, cam = PROFILE.media_cam, spk = PROFILE.media_spk;
    if (Array.isArray(mic) || Array.isArray(cam) || Array.isArray(spk)) {
      const fake = [];
      const mkDevice = (kind, index) => ({
        deviceId: 'id' + (mediaTable[index] + index) + '_' + (index * 7 + (mediaTable[index + 3] & 127)).toString(16),
        kind, label: '', groupId: 'g' + ((index + (mediaTable[index + 5] & 63)) % 8),
        toJSON() { return this; },
      });
      const n = (x) => (Array.isArray(x) ? x.length : 0);
      for (let i = 0; i < n(mic); i++) fake.push(mkDevice('audioinput', i * 3 + 1));
      for (let i = 0; i < n(cam); i++) fake.push(mkDevice('videoinput', i * 3 + 2));
      for (let i = 0; i < n(spk); i++) fake.push(mkDevice('audiooutput', i * 3 + 3));

      const origEnum = MediaDevices.prototype.enumerateDevices;
      const enumHook = function enumerateDevices() {
        return Promise.resolve(fake);
      };
      markNative(enumHook, origEnum);
      MediaDevices.prototype.enumerateDevices = enumHook;
    }
  } catch (e) {}

  // --- 10. speech synthesis voices (OS-typical, from preset) -----------------------------
  try {
    const voices = PROFILE.voices;
    if (voices && voices.length && window.speechSynthesis) {
      const fake = voices.map((name, i) => ({
        default: i === 0,
        lang: (name.match(/\(([^)]+)\)/) || [, PROFILE.languages ? PROFILE.languages[0] : 'en-US'])[1].replace('_', '-'),
        localService: true,
        name,
        voiceURI: name,
        eventIndex: i,
        onvoiceschanged: null,
        addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; },
      }));
      const origVoices = SpeechSynthesis.prototype.getVoices;
      const voicesHook = function getVoices() {
        return fake;
      };
      markNative(voicesHook, origVoices);
      SpeechSynthesis.prototype.getVoices = voicesHook;
    }
  } catch (e) {}

  // --- 11. Font metrics noise (measureText) -------------------------------------
  try {
    if (PROFILE.font_noise !== false && window.CanvasRenderingContext2D) {
      const origMeasure = CanvasRenderingContext2D.prototype.measureText;
      if (origMeasure) {
        const measureHook = function measureText(text) {
          const metrics = origMeasure.apply(this, arguments);
          try {
            const str = String(text || '');
            let h = 0;
            for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 511;
            const delta = tableSign(rectTable, h) * 0.0005;
            const origWidth = metrics.width;
            Object.defineProperty(metrics, 'width', {
              get: () => origWidth + delta,
              configurable: true,
            });
          } catch (e) {}
          return metrics;
        };
        markNative(measureHook, origMeasure);
        CanvasRenderingContext2D.prototype.measureText = measureHook;
      }
    }
  } catch (e) {}

  // --- 12. Battery API spoofing -------------------------------------------------
  try {
    if (PROFILE.battery_spoof !== false && Navigator.prototype.getBattery) {
      const origBattery = Navigator.prototype.getBattery;
      const fakeBattery = {
        charging: true,
        chargingTime: 0,
        dischargingTime: Infinity,
        level: 1.0,
        onchargingchange: null,
        onchargingtimechange: null,
        ondischargingtimechange: null,
        onlevelchange: null,
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() { return false; },
      };
      const batteryHook = function getBattery() {
        return Promise.resolve(fakeBattery);
      };
      markNative(batteryHook, origBattery);
      Navigator.prototype.getBattery = batteryHook;
    }
  } catch (e) {}

  // --- 13. Localhost Port Scan Protection ---------------------------------------
  try {
    if (PROFILE.port_scan_protection !== false) {
      const isBlockedLocalTarget = (rawUrl) => {
        try {
          const u = new URL(String(rawUrl), location.href);
          if (u.host === location.host) return false;
          const hn = u.hostname.toLowerCase();
          return hn === '127.0.0.1' || hn === 'localhost' || hn === '0.0.0.0' || hn === '[::1]';
        } catch (e) {
          return false;
        }
      };
      if (window.fetch) {
        const origFetch = window.fetch;
        const fetchHook = function fetch(input, init) {
          const url = typeof input === 'string' ? input : (input && input.url) || '';
          if (isBlockedLocalTarget(url)) {
            return Promise.reject(new TypeError('Failed to fetch'));
          }
          return origFetch.apply(this, arguments);
        };
        markNative(fetchHook, origFetch);
        window.fetch = fetchHook;
      }
    }
  } catch (e) {}

  // Quiet by default: no console fingerprints of the injection itself.
})();
"""


def build_profile_config(profile: dict, languages=None) -> dict:
    """The subset of the profile the in-page hooks need, with resolved values.

    `languages` comes from the launch-time resolver ("based on proxy" may differ
    from the stored list); it overrides the stored value so Accept-Language and
    navigator.languages always match.
    """
    media = None
    if profile.get("media_mic") is not None or profile.get("media_cam") is not None:
        media = {
            "mic": ["mic"] * int(profile.get("media_mic") or 0),
            "cam": ["cam"] * int(profile.get("media_cam") or 0),
            "spk": ["spk"] * int(profile.get("media_spk") or 0),
        }
    return {
        "name": profile.get("name"),
        "platform": profile.get("platform"),
        "hardware_concurrency": profile.get("hardware_concurrency"),
        "device_memory": profile.get("device_memory"),
        "languages": languages if languages else (profile.get("languages") or []),
        "screen_width": profile.get("screen_width"),
        "screen_height": profile.get("screen_height"),
        "avail_offset": profile.get("avail_offset", 40),
        "color_depth": profile.get("color_depth"),
        "device_pixel_ratio": profile.get("device_pixel_ratio"),
        "webgl_vendor": profile.get("webgl_vendor"),
        "webgl_renderer": profile.get("webgl_renderer"),
        "webgl_max_texture_size": profile.get("webgl_max_texture_size"),
        "canvas_seed": int(profile.get("canvas_seed") or 1337),
        "audio_seed": int(profile.get("audio_seed") or 4242),
        "font_seed": int(profile.get("font_seed") or 9999),
        "media_seed": int(profile.get("media_seed") or 7777),
        "canvas_noise": profile.get("canvas_noise", True),
        "webgl_noise": profile.get("webgl_noise", True),
        "audio_noise": profile.get("audio_noise", True),
        "clientrects_noise": profile.get("clientrects_noise", True),
        "font_noise": profile.get("font_noise", True),
        "port_scan_protection": profile.get("port_scan_protection", True),
        "battery_spoof": profile.get("battery_spoof", True),
        "webrtc_mode": profile.get("webrtc_mode", "altered"),
        "dnt": profile.get("dnt", False),
        "media": media,
        "voices": profile.get("voices"),
    }


def generate_stealth_script(profile: dict, languages=None) -> str:
    """Generate the IIFE payload customized with the (resolved) profile values."""
    config = build_profile_config(profile, languages)
    # Flatten media counts into lists for the JS side.
    if config["media"]:
        config["media_mic"] = config["media"]["mic"]
        config["media_cam"] = config["media"]["cam"]
        config["media_spk"] = config["media"]["spk"]
    config.pop("media", None)
    profile_json = json.dumps(config, indent=2)
    return JS_TEMPLATE.replace("__PROFILE_CONFIG__", profile_json)
