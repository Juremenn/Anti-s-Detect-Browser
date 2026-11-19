/**
 * Anti Detect Browser - Popup Controller (Manifest V3)
 */

document.addEventListener('DOMContentLoaded', async () => {
  const presetSelect = document.getElementById('presetSelect');
  const presetCategory = document.getElementById('presetCategory');
  const platformVal = document.getElementById('platformVal');
  const gpuVal = document.getElementById('gpuVal');
  const ipVal = document.getElementById('ipVal');
  const geoVal = document.getElementById('geoVal');
  const tzVal = document.getElementById('tzVal');
  const seedVal = document.getElementById('seedVal');
  const btnRotate = document.getElementById('btnRotate');
  const btnRegenSeed = document.getElementById('btnRegenSeed');
  const linkOptions = document.getElementById('linkOptions');

  const modWebGL = document.getElementById('modWebGL');
  const modCanvas = document.getElementById('modCanvas');
  const modAudio = document.getElementById('modAudio');
  const modScreen = document.getElementById('modScreen');
  const modTimezone = document.getElementById('modTimezone');
  const modClientRects = document.getElementById('modClientRects');

  let activeConfig = null;
  let presetsList = [];

  // Request status from background worker
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
    if (res && res.config) {
      activeConfig = res.config;
      presetsList = res.presets || [];
      renderUI();
    }
  });

  function renderUI() {
    if (!activeConfig) return;

    // Populate Presets
    presetSelect.innerHTML = '';
    presetsList.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name} (${p.os})`;
      if (p.id === activeConfig.selected_preset_id) {
        opt.selected = true;
      }
      presetSelect.appendChild(opt);
    });

    updatePresetDetails();

    // IP and Network
    const ip = activeConfig.ip_info || {};
    ipVal.textContent = ip.ip || 'Direct';
    geoVal.textContent = [ip.country, ip.city].filter(Boolean).join(' · ') || 'Local / Direct';
    tzVal.textContent = ip.timezone || 'Local';

    // Seed
    seedVal.textContent = String(activeConfig.profile_seed || 8392819);

    // Modules
    const mods = activeConfig.modules || {};
    modWebGL.checked = mods.webgl !== false;
    modCanvas.checked = mods.canvas !== false;
    modAudio.checked = mods.audio !== false;
    modScreen.checked = mods.screen !== false;
    modTimezone.checked = mods.timezone_sync !== false;
    modClientRects.checked = mods.client_rects !== false;
  }

  function updatePresetDetails() {
    const selectedId = presetSelect.value;
    const preset = presetsList.find((p) => p.id === selectedId) || presetsList[0];
    if (preset) {
      presetCategory.textContent = (preset.category || 'laptop').toUpperCase();
      platformVal.textContent = `${preset.platform} (${preset.os})`;
      gpuVal.textContent = preset.webgl_renderer || 'Default WebGL';
    }
  }

  // Handle Preset Change
  presetSelect.addEventListener('change', () => {
    const selectedId = presetSelect.value;
    updatePresetDetails();
    if (activeConfig) {
      activeConfig.selected_preset_id = selectedId;
      chrome.runtime.sendMessage({
        type: 'UPDATE_CONFIG',
        config: { selected_preset_id: selectedId }
      });
    }
  });

  // Handle Rotate IP
  btnRotate.addEventListener('click', () => {
    btnRotate.disabled = true;
    btnRotate.querySelector('span').textContent = 'Rotating...';

    chrome.runtime.sendMessage({ type: 'ROTATE_IP' }, (res) => {
      btnRotate.disabled = false;
      btnRotate.querySelector('span').textContent = 'Rotate IP';
      if (res && res.ipInfo) {
        activeConfig.ip_info = res.ipInfo;
        ipVal.textContent = res.ipInfo.ip || 'Direct';
        geoVal.textContent = [res.ipInfo.country, res.ipInfo.city].filter(Boolean).join(' · ') || 'Local';
        tzVal.textContent = res.ipInfo.timezone || 'Local';
      }
    });
  });

  // Handle Regenerate Seed
  btnRegenSeed.addEventListener('click', () => {
    btnRegenSeed.disabled = true;
    chrome.runtime.sendMessage({ type: 'REGENERATE_SEED' }, (res) => {
      btnRegenSeed.disabled = false;
      if (res && res.seed) {
        seedVal.textContent = String(res.seed);
        if (activeConfig) activeConfig.profile_seed = res.seed;
      }
    });
  });

  // Handle Module Toggles
  function saveModules() {
    if (!activeConfig) return;
    activeConfig.modules = {
      ...activeConfig.modules,
      webgl: modWebGL.checked,
      canvas: modCanvas.checked,
      audio: modAudio.checked,
      screen: modScreen.checked,
      timezone_sync: modTimezone.checked,
      client_rects: modClientRects.checked
    };
    chrome.runtime.sendMessage({
      type: 'UPDATE_CONFIG',
      config: { modules: activeConfig.modules }
    });
  }

  [modWebGL, modCanvas, modAudio, modScreen, modTimezone, modClientRects].forEach((el) => {
    el.addEventListener('change', saveModules);
  });

  // Open Full Settings
  linkOptions.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  });
});
