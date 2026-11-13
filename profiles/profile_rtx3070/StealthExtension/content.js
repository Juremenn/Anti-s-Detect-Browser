
(() => {
  // Profile settings provided by Python launcher
  const PROFILE = {
  "name": "profile_rtx3070",
  "uuid": "0851e608-09ef-4c43-b0c0-b722d996ea82",
  "created_at": "1719533905",
  "user_data_dir": "C:\\Users\\Nel\\Documents\\Reverse-Engineer-Anything\\Octo-Browser\\profiles\\profile_rtx3070\\UserData",
  "proxy": "",
  "mask_webrtc": true,
  "canvas_seed": 2149064,
  "audio_seed": 3582461,
  "font_seed": 2398972,
  "os": "win",
  "platform": "Win32",
  "webgl_vendor": "Google Inc. (NVIDIA)",
  "webgl_renderer": "ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)",
  "hardware_concurrency": 8,
  "device_memory": 8,
  "screen_width": 1920,
  "screen_height": 1080,
  "color_depth": 24,
  "languages": [
    "id-ID",
    "id",
    "en-US",
    "en"
  ],
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
};

  // --- 1. SEEDED PSEUDO-RANDOM GENERATOR (Mulberry32) ---
  function createPRNG(seed) {
    return function() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const canvasPRNG = createPRNG(PROFILE.canvas_seed || 1337);
  const audioPRNG = createPRNG(PROFILE.audio_seed || 4242);
  const fontPRNG = createPRNG(PROFILE.font_seed || 9999);

  // Helper to preserve Function.prototype.toString
  const nativeToString = Function.prototype.toString;
  const hookedFunctions = new WeakSet();
  function protectFunction(target, original) {
    hookedFunctions.add(target);
    try {
      Object.defineProperty(target, 'name', { value: original.name });
      Object.defineProperty(target, 'length', { value: original.length });
    } catch(e) {}
  }

  Function.prototype.toString = function() {
    if (hookedFunctions.has(this)) {
      return 'function () { [native code] }';
    }
    return nativeToString.apply(this, arguments);
  };
  hookedFunctions.add(Function.prototype.toString);

  // --- 2. AUTOMATION / WEBDRIVER REMOVAL ---
  try {
    if (navigator.webdriver !== undefined) {
      delete Object.getPrototypeOf(navigator).webdriver;
    }
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
      configurable: true
    });
  } catch(e) {}

  // --- 3. HARDWARE & OS MASKING ---
  try {
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => PROFILE.hardware_concurrency || 8,
      configurable: true
    });
    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => PROFILE.device_memory || 8,
      configurable: true
    });
    Object.defineProperty(navigator, 'platform', {
      get: () => PROFILE.platform || 'Win32',
      configurable: true
    });
    if (PROFILE.languages && PROFILE.languages.length) {
      Object.defineProperty(navigator, 'languages', {
        get: () => Object.freeze([...PROFILE.languages]),
        configurable: true
      });
      Object.defineProperty(navigator, 'language', {
        get: () => PROFILE.languages[0],
        configurable: true
      });
    }
  } catch(e) {}

  // --- 4. SCREEN GEOMETRY MASKING ---
  try {
    const width = PROFILE.screen_width || 1920;
    const height = PROFILE.screen_height || 1080;
    const availWidth = width;
    const availHeight = height - 40; // Simulated Windows taskbar
    const colorDepth = PROFILE.color_depth || 24;

    Object.defineProperty(screen, 'width', { get: () => width });
    Object.defineProperty(screen, 'height', { get: () => height });
    Object.defineProperty(screen, 'availWidth', { get: () => availWidth });
    Object.defineProperty(screen, 'availHeight', { get: () => availHeight });
    Object.defineProperty(screen, 'colorDepth', { get: () => colorDepth });
    Object.defineProperty(screen, 'pixelDepth', { get: () => colorDepth });
  } catch(e) {}

  // --- 5. WEBGL SPOOFING (UNMASKED VENDOR & RENDERER) ---
  try {
    const vendor = PROFILE.webgl_vendor || 'Google Inc. (NVIDIA)';
    const renderer = PROFILE.webgl_renderer || 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)';

    function hookWebGLContext(proto) {
      if (!proto) return;
      const origGetParameter = proto.getParameter;
      proto.getParameter = function(param) {
        // 0x9245 = UNMASKED_VENDOR_WEBGL
        if (param === 0x9245) return vendor;
        // 0x9246 = UNMASKED_RENDERER_WEBGL
        if (param === 0x9246) return renderer;
        return origGetParameter.apply(this, arguments);
      };
      protectFunction(proto.getParameter, origGetParameter);
    }

    hookWebGLContext(window.WebGLRenderingContext ? WebGLRenderingContext.prototype : null);
    hookWebGLContext(window.WebGL2RenderingContext ? WebGL2RenderingContext.prototype : null);
  } catch(e) {}

  // --- 6. CANVAS SUB-PIXEL DETERMINISTIC SPOOFING ---
  try {
    const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    const origToBlob = HTMLCanvasElement.prototype.toBlob;

    function perturbImageData(imageData) {
      const d = imageData.data;
      const len = d.length;
      // Perturb deterministic pixels across the canvas without altering visual perception
      const step = Math.max(16, Math.floor(len / 1000));
      for (let i = 0; i < len; i += step) {
        const noise = (canvasPRNG() > 0.5 ? 1 : -1);
        d[i] = Math.min(255, Math.max(0, d[i] + noise));
      }
      return imageData;
    }

    CanvasRenderingContext2D.prototype.getImageData = function(...args) {
      const res = origGetImageData.apply(this, args);
      return perturbImageData(res);
    };
    protectFunction(CanvasRenderingContext2D.prototype.getImageData, origGetImageData);

    HTMLCanvasElement.prototype.toDataURL = function(...args) {
      try {
        const ctx = this.getContext('2d');
        if (ctx && this.width > 0 && this.height > 0) {
          const imgData = origGetImageData.call(ctx, 0, 0, this.width, this.height);
          perturbImageData(imgData);
          ctx.putImageData(imgData, 0, 0);
        }
      } catch(e) {}
      return origToDataURL.apply(this, args);
    };
    protectFunction(HTMLCanvasElement.prototype.toDataURL, origToDataURL);

    HTMLCanvasElement.prototype.toBlob = function(callback, ...args) {
      try {
        const ctx = this.getContext('2d');
        if (ctx && this.width > 0 && this.height > 0) {
          const imgData = origGetImageData.call(ctx, 0, 0, this.width, this.height);
          perturbImageData(imgData);
          ctx.putImageData(imgData, 0, 0);
        }
      } catch(e) {}
      return origToBlob.apply(this, [callback, ...args]);
    };
    protectFunction(HTMLCanvasElement.prototype.toBlob, origToBlob);
  } catch(e) {}

  // --- 7. WEBAUDIO & FREQUENCY DATA PERTURBATION ---
  try {
    if (window.AnalyserNode) {
      const origGetFloatFreq = AnalyserNode.prototype.getFloatFrequencyData;
      AnalyserNode.prototype.getFloatFrequencyData = function(array) {
        origGetFloatFreq.apply(this, arguments);
        const len = array.length;
        for (let i = 0; i < len; i++) {
          // Micro-perturbation (< 0.0001 dB)
          array[i] += (audioPRNG() - 0.5) * 0.0001;
        }
      };
      protectFunction(AnalyserNode.prototype.getFloatFrequencyData, origGetFloatFreq);

      const origGetByteFreq = AnalyserNode.prototype.getByteFrequencyData;
      AnalyserNode.prototype.getByteFrequencyData = function(array) {
        origGetByteFreq.apply(this, arguments);
        const len = array.length;
        for (let i = 0; i < len; i += 20) {
          array[i] = (array[i] ^ (audioPRNG() > 0.5 ? 1 : 0)) & 0xFF;
        }
      };
      protectFunction(AnalyserNode.prototype.getByteFrequencyData, origGetByteFreq);
    }

    if (window.AudioBuffer) {
      const origGetChannelData = AudioBuffer.prototype.getChannelData;
      AudioBuffer.prototype.getChannelData = function(channel) {
        const data = origGetChannelData.apply(this, arguments);
        const len = data.length;
        const step = Math.max(32, Math.floor(len / 500));
        for (let i = 0; i < len; i += step) {
          data[i] += (audioPRNG() - 0.5) * 0.00002;
        }
        return data;
      };
      protectFunction(AudioBuffer.prototype.getChannelData, origGetChannelData);
    }
  } catch(e) {}

  // --- 8. CLIENT RECTS / FONT GEOMETRY PERTURBATION ---
  try {
    const origGetClientRects = Element.prototype.getClientRects;
    Element.prototype.getClientRects = function() {
      const rects = origGetClientRects.apply(this, arguments);
      return rects;
    };
    protectFunction(Element.prototype.getClientRects, origGetClientRects);

    const origGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function() {
      const rect = origGetBoundingClientRect.apply(this, arguments);
      const delta = (fontPRNG() - 0.5) * 0.002;
      return new DOMRect(
        rect.x + delta,
        rect.y + delta,
        rect.width + (delta * 0.5),
        rect.height + (delta * 0.5)
      );
    };
    protectFunction(Element.prototype.getBoundingClientRect, origGetBoundingClientRect);
  } catch(e) {}

  // --- 9. WEBRTC LOCAL IP LEAK PROTECTION ---
  try {
    if (PROFILE.mask_webrtc && window.RTCPeerConnection) {
      const origCreateOffer = RTCPeerConnection.prototype.createOffer;
      RTCPeerConnection.prototype.createOffer = function(...args) {
        return origCreateOffer.apply(this, args).then(offer => {
          if (offer && offer.sdp) {
            offer.sdp = offer.sdp.replace(/(IP4\s+)(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)/g, '$10.0.0.0');
          }
          return offer;
        });
      };
      protectFunction(RTCPeerConnection.prototype.createOffer, origCreateOffer);
    }
  } catch(e) {}

  console.log('[StealthEngine] Injected identity profile: ' + PROFILE.name + ' (' + PROFILE.webgl_renderer + ')');
})();
