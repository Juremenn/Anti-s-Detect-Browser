/**
 * Anti Detect Browser - Options Controller (Manifest V3)
 */

document.addEventListener('DOMContentLoaded', async () => {
  const proxyEnabled = document.getElementById('proxyEnabled');
  const proxyScheme = document.getElementById('proxyScheme');
  const proxyHost = document.getElementById('proxyHost');
  const proxyPort = document.getElementById('proxyPort');
  const proxyUser = document.getElementById('proxyUser');
  const proxyPass = document.getElementById('proxyPass');
  const rotationUrl = document.getElementById('rotationUrl');
  const profileSeed = document.getElementById('profileSeed');
  const btnGenSeed = document.getElementById('btnGenSeed');
  const btnSaveTop = document.getElementById('btnSaveTop');
  const btnSaveBottom = document.getElementById('btnSaveBottom');
  const toastMessage = document.getElementById('toastMessage');

  const modNav = document.getElementById('modNav');
  const modWebGL = document.getElementById('modWebGL');
  const modCanvas = document.getElementById('modCanvas');
  const modAudio = document.getElementById('modAudio');
  const modScreen = document.getElementById('modScreen');
  const modTz = document.getElementById('modTz');
  const modWebrtc = document.getElementById('modWebrtc');
  const modRects = document.getElementById('modRects');
  const modIframe = document.getElementById('modIframe');

  let activeConfig = null;

  // Load from storage
  const stored = await chrome.storage.local.get(['config']);
  activeConfig = stored && stored.config ? stored.config : {};

  // Populate fields
  const p = activeConfig.proxy || {};
  proxyEnabled.checked = Boolean(p.enabled);
  proxyScheme.value = p.scheme || 'http';
  proxyHost.value = p.host || '';
  proxyPort.value = p.port || '';
  proxyUser.value = p.username || '';
  proxyPass.value = p.password || '';
  rotationUrl.value = p.rotation_url || '';

  profileSeed.value = String(activeConfig.profile_seed || 8392819);

  const m = activeConfig.modules || {};
  modNav.checked = m.navigator !== false;
  modWebGL.checked = m.webgl !== false;
  modCanvas.checked = m.canvas !== false;
  modAudio.checked = m.audio !== false;
  modScreen.checked = m.screen !== false;
  modTz.checked = m.timezone_sync !== false;
  modWebrtc.checked = m.webrtc !== false;
  modRects.checked = m.client_rects !== false;
  modIframe.checked = m.iframe_stealth !== false;

  btnGenSeed.addEventListener('click', () => {
    profileSeed.value = String(Math.floor(Math.random() * 9000000) + 1000000);
  });

  function saveSettings() {
    activeConfig.profile_seed = parseInt(profileSeed.value, 10) || 8392819;
    activeConfig.proxy = {
      enabled: proxyEnabled.checked,
      scheme: proxyScheme.value,
      host: proxyHost.value.trim(),
      port: parseInt(proxyPort.value, 10) || 0,
      username: proxyUser.value.trim(),
      password: proxyPass.value.trim(),
      rotation_url: rotationUrl.value.trim()
    };
    activeConfig.modules = {
      navigator: modNav.checked,
      webgl: modWebGL.checked,
      canvas: modCanvas.checked,
      audio: modAudio.checked,
      screen: modScreen.checked,
      timezone_sync: modTz.checked,
      webrtc: modWebrtc.checked,
      client_rects: modRects.checked,
      iframe_stealth: modIframe.checked
    };

    chrome.runtime.sendMessage(
      { type: 'UPDATE_CONFIG', config: activeConfig },
      () => {
        toastMessage.style.display = 'block';
        setTimeout(() => {
          toastMessage.style.display = 'none';
        }, 3000);
      }
    );
  }

  btnSaveTop.addEventListener('click', saveSettings);
  btnSaveBottom.addEventListener('click', saveSettings);
});
