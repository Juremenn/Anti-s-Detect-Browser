/**
 * Anti Detect Browser - Autonomous Background Service Worker (Manifest V3)
 * Core Engine: Fresh IP Routing, Automatic Proxy Auth, Dynamic Header Rewriting, WebRTC Shielding
 */

const RULE_IDS = {
  USER_AGENT: 1001,
  SEC_CH_UA: 1002,
  SEC_CH_UA_PLATFORM: 1003,
  SEC_CH_UA_PLATFORM_VER: 1004,
  SEC_CH_UA_MOBILE: 1005,
  SEC_CH_UA_MODEL: 1006,
  SEC_CH_UA_ARCH: 1007,
  SEC_CH_UA_BITNESS: 1008,
  ACCEPT_LANGUAGE: 1009,
  STRIP_LEAK_HEADERS: 1010
};

let activeConfig = null;
let presetsList = [];

// Initialize configuration
async function initialize() {
  try {
    // 1. Load presets
    try {
      const presetsRes = await fetch(chrome.runtime.getURL('presets.json'));
      presetsList = await presetsRes.json();
    } catch (e) {
      console.warn('[Anti Detect] Failed to load presets.json:', e);
    }

    // 2. Load stored or fallback config
    const stored = await chrome.storage.local.get(['config']);
    if (stored && stored.config) {
      activeConfig = stored.config;
    } else {
      try {
        const configRes = await fetch(chrome.runtime.getURL('config.json'));
        activeConfig = await configRes.json();
      } catch (_) {
        activeConfig = {
          enabled: true,
          profile_seed: 8392819,
          selected_preset_id: 'thinkpad-x1-win11',
          proxy: { enabled: false },
          ip_info: { ip: 'Direct', country: 'US', timezone: 'America/New_York', language: 'en-US' },
          modules: { navigator: true, webgl: true, canvas: true, audio: true, screen: true, webrtc: true }
        };
      }
      await chrome.storage.local.set({ config: activeConfig });
    }

    // 3. Apply WebRTC Shield
    applyWebRTCProtection();

    // 4. Apply Proxy Settings
    applyProxySettings();

    // 5. Apply Declarative Net Request Rules
    await updateHeaderRules();

    console.log('[Anti Detect] Initialized with preset:', activeConfig.selected_preset_id);
  } catch (err) {
    console.error('[Anti Detect] Initialization error:', err);
  }
}

// WebRTC Leak Hardening
function applyWebRTCProtection() {
  if (!chrome.privacy || !chrome.privacy.network) return;
  const webrtcEnabled = activeConfig?.modules?.webrtc !== false;
  const policy = webrtcEnabled ? 'disable_non_proxied_udp' : 'default';

  try {
    chrome.privacy.network.webRTCIPHandlingPolicy.set(
      { value: policy },
      () => {
        if (chrome.runtime.lastError) {
          console.warn('[Anti Detect] WebRTC policy notice:', chrome.runtime.lastError.message);
        }
      }
    );
  } catch (e) {
    console.warn('[Anti Detect] WebRTC setup exception:', e);
  }
}

// Proxy Configuration
function applyProxySettings() {
  if (!chrome.proxy) return;
  const proxy = activeConfig?.proxy;

  if (activeConfig?.enabled && proxy && proxy.enabled && proxy.host && proxy.port) {
    const config = {
      mode: 'fixed_servers',
      rules: {
        singleProxy: {
          scheme: (proxy.scheme || 'http').toLowerCase(),
          host: proxy.host,
          port: parseInt(proxy.port, 10)
        },
        bypassList: ['localhost', '127.0.0.1']
      }
    };
    chrome.proxy.settings.set({ value: config, scope: 'regular' }, () => {
      console.log('[Anti Detect] Proxy routing enabled via:', `${proxy.scheme}://${proxy.host}:${proxy.port}`);
    });
  } else {
    chrome.proxy.settings.clear({ scope: 'regular' }, () => {
      console.log('[Anti Detect] Proxy routing cleared (Direct connection)');
    });
  }
}

// Automatic Proxy Authentication Handler
if (chrome.webRequest && chrome.webRequest.onAuthRequired) {
  chrome.webRequest.onAuthRequired.addListener(
    (details) => {
      const proxy = activeConfig?.proxy;
      if (proxy && proxy.enabled && proxy.username && proxy.password) {
        return {
          authCredentials: {
            username: proxy.username,
            password: proxy.password
          }
        };
      }
      return {};
    },
    { urls: ['<all_urls>'] },
    ['blocking']
  );
}

// Declarative Net Request Header Rules
async function updateHeaderRules() {
  if (!chrome.declarativeNetRequest) return;

  const preset = presetsList.find((p) => p.id === activeConfig?.selected_preset_id) || presetsList[0];
  if (!preset || !activeConfig?.enabled) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: Object.values(RULE_IDS)
    });
    return;
  }

  const rulesToAdd = [];

  // User-Agent
  if (preset.user_agent) {
    rulesToAdd.push({
      id: RULE_IDS.USER_AGENT,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { header: 'User-Agent', operation: 'set', value: preset.user_agent }
        ]
      },
      condition: {
        urlFilter: '*',
        resourceTypes: ['main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'xmlhttprequest', 'websocket', 'other']
      }
    });
  }

  // Client Hints
  if (preset.sec_ch_ua) {
    rulesToAdd.push({
      id: RULE_IDS.SEC_CH_UA,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { header: 'Sec-CH-UA', operation: 'set', value: preset.sec_ch_ua }
        ]
      },
      condition: { urlFilter: '*', resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'other'] }
    });
  }

  if (preset.sec_ch_ua_platform) {
    rulesToAdd.push({
      id: RULE_IDS.SEC_CH_UA_PLATFORM,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { header: 'Sec-CH-UA-Platform', operation: 'set', value: preset.sec_ch_ua_platform }
        ]
      },
      condition: { urlFilter: '*', resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'other'] }
    });
  }

  // Accept-Language
  const lang = (activeConfig.ip_info && activeConfig.ip_info.language) || (preset.languages && preset.languages[0]) || 'en-US';
  rulesToAdd.push({
    id: RULE_IDS.ACCEPT_LANGUAGE,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [
        { header: 'Accept-Language', operation: 'set', value: `${lang},en;q=0.9` }
      ]
    },
    condition: { urlFilter: '*', resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'other'] }
  });

  // Strip Leak Headers
  rulesToAdd.push({
    id: RULE_IDS.STRIP_LEAK_HEADERS,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [
        { header: 'X-Forwarded-For', operation: 'remove' },
        { header: 'X-Real-IP', operation: 'remove' },
        { header: 'Via', operation: 'remove' },
        { header: 'Client-IP', operation: 'remove' }
      ]
    },
    condition: { urlFilter: '*', resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'other'] }
  });

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: Object.values(RULE_IDS),
    addRules: rulesToAdd
  });
}

// 1-Click Fresh IP Rotation
async function rotateFreshIP() {
  const rotationUrl = activeConfig?.proxy?.rotation_url;
  let webhookTriggered = false;

  if (rotationUrl) {
    try {
      await fetch(rotationUrl, { method: 'GET', mode: 'no-cors' });
      webhookTriggered = true;
      await new Promise((r) => setTimeout(r, 2000));
    } catch (e) {
      console.warn('[Anti Detect] Webhook error:', e);
    }
  }

  // Refresh IP Metadata
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (res.ok) {
      const data = await res.json();
      activeConfig.ip_info = {
        ip: data.ip || 'Unknown',
        country: data.country_code || 'US',
        country_name: data.country_name || '',
        city: data.city || '',
        timezone: data.timezone || 'UTC',
        latitude: data.latitude || 0,
        longitude: data.longitude || 0,
        language: data.languages ? data.languages.split(',')[0] : 'en-US'
      };
      await chrome.storage.local.set({ config: activeConfig });
      await updateHeaderRules();
      return { success: true, webhookTriggered, ipInfo: activeConfig.ip_info };
    }
  } catch (err) {
    console.warn('[Anti Detect] IP fetch failed, using fallback:', err);
  }

  return { success: webhookTriggered, webhookTriggered, ipInfo: activeConfig?.ip_info };
}

// Runtime Message Dispatcher
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_STATUS') {
    sendResponse({
      config: activeConfig,
      presets: presetsList
    });
    return true;
  }

  if (msg.type === 'ROTATE_IP') {
    rotateFreshIP().then((result) => {
      sendResponse(result);
    });
    return true;
  }

  if (msg.type === 'REGENERATE_SEED') {
    const newSeed = Math.floor(Math.random() * 9000000) + 1000000;
    activeConfig.profile_seed = newSeed;
    chrome.storage.local.set({ config: activeConfig }).then(() => {
      sendResponse({ status: 'ok', seed: newSeed });
    });
    return true;
  }

  if (msg.type === 'UPDATE_CONFIG') {
    activeConfig = { ...activeConfig, ...msg.config };
    chrome.storage.local.set({ config: activeConfig }).then(async () => {
      applyWebRTCProtection();
      applyProxySettings();
      await updateHeaderRules();
      sendResponse({ status: 'ok', config: activeConfig });
    });
    return true;
  }
});

// Startup & Installation Lifecycle
chrome.runtime.onInstalled.addListener(initialize);
chrome.runtime.onStartup.addListener(initialize);
initialize();
