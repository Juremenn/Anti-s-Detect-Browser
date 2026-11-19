/**
 * Anti Detect Browser - Popup Controller (Manifest V3)
 * Custom Searchable Device Picker with Category Filters & Zero Lag
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Device Picker Elements
  const pickerTrigger = document.getElementById('pickerTrigger');
  const pickerTriggerName = document.getElementById('pickerTriggerName');
  const pickerOsBadge = document.getElementById('pickerOsBadge');
  const pickerPopover = document.getElementById('pickerPopover');
  const pickerSearchInput = document.getElementById('pickerSearchInput');
  const pickerClearBtn = document.getElementById('pickerClearBtn');
  const pickerFilterPills = document.getElementById('pickerFilterPills');
  const pickerList = document.getElementById('pickerList');

  // Metadata Display Elements
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

  // Module Toggles
  const modWebGL = document.getElementById('modWebGL');
  const modCanvas = document.getElementById('modCanvas');
  const modAudio = document.getElementById('modAudio');
  const modScreen = document.getElementById('modScreen');
  const modTimezone = document.getElementById('modTimezone');
  const modClientRects = document.getElementById('modClientRects');

  let activeConfig = null;
  let presetsList = [];
  let currentOsFilter = 'all';
  let isPickerOpen = false;

  // Request status from background worker
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
    if (res && res.config) {
      activeConfig = res.config;
      presetsList = res.presets || [];
      renderUI();
    }
  });

  function getOsBadgeLabel(os) {
    if (!os) return 'DEV';
    const lower = os.toLowerCase();
    if (lower.includes('win')) return 'WIN';
    if (lower.includes('mac')) return 'MAC';
    if (lower.includes('ios') || lower.includes('iphone') || lower.includes('ipad')) return 'IOS';
    if (lower.includes('and')) return 'AND';
    return os.toUpperCase().slice(0, 3);
  }

  function renderUI() {
    if (!activeConfig) return;

    updateSelectedPresetView();

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

  function updateSelectedPresetView() {
    const selectedId = activeConfig ? activeConfig.selected_preset_id : '';
    const preset = presetsList.find((p) => p.id === selectedId) || presetsList[0];
    if (preset) {
      pickerTriggerName.textContent = preset.name;
      pickerOsBadge.textContent = getOsBadgeLabel(preset.os);
      presetCategory.textContent = (preset.category || 'laptop').toUpperCase();
      platformVal.textContent = `${preset.platform} (${preset.os.toUpperCase()})`;
      gpuVal.textContent = preset.webgl_renderer || 'Default WebGL';
    }
  }

  // --- Device Picker Logic --------------------------------------------------

  function togglePicker(open) {
    isPickerOpen = typeof open === 'boolean' ? open : !isPickerOpen;
    pickerPopover.style.display = isPickerOpen ? 'flex' : 'none';
    if (isPickerOpen) {
      pickerTrigger.classList.add('active');
      pickerSearchInput.value = '';
      pickerClearBtn.style.display = 'none';
      renderPickerList();
      setTimeout(() => pickerSearchInput.focus(), 30);
    } else {
      pickerTrigger.classList.remove('active');
    }
  }

  pickerTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePicker();
  });

  // Close when clicked outside
  document.addEventListener('click', (e) => {
    if (isPickerOpen && !e.target.closest('#devicePickerContainer')) {
      togglePicker(false);
    }
  });

  // Search input handler
  pickerSearchInput.addEventListener('input', () => {
    pickerClearBtn.style.display = pickerSearchInput.value ? 'block' : 'none';
    renderPickerList();
  });

  pickerClearBtn.addEventListener('click', () => {
    pickerSearchInput.value = '';
    pickerClearBtn.style.display = 'none';
    pickerSearchInput.focus();
    renderPickerList();
  });

  // Filter pills
  pickerFilterPills.addEventListener('click', (e) => {
    const pill = e.target.closest('.filter-pill');
    if (!pill) return;
    pickerFilterPills.querySelectorAll('.filter-pill').forEach((p) => p.classList.remove('active'));
    pill.classList.add('active');
    currentOsFilter = pill.getAttribute('data-os') || 'all';
    renderPickerList();
  });

  // Render option items
  function renderPickerList() {
    const query = pickerSearchInput.value.toLowerCase().trim();
    const activeId = activeConfig ? activeConfig.selected_preset_id : '';

    const filtered = presetsList.filter((p) => {
      if (currentOsFilter !== 'all') {
        const itemOs = (p.os || '').toLowerCase();
        if (currentOsFilter === 'win' && itemOs !== 'win' && itemOs !== 'windows') return false;
        if (currentOsFilter === 'mac' && itemOs !== 'mac' && itemOs !== 'macos') return false;
        if (currentOsFilter === 'ios' && itemOs !== 'ios') return false;
        if (currentOsFilter === 'android' && itemOs !== 'android') return false;
      }
      if (!query) return true;
      const haystack = `${p.name} ${p.label || ''} ${p.os || ''} ${p.platform || ''} ${p.webgl_renderer || ''}`.toLowerCase();
      return haystack.includes(query);
    });

    pickerList.innerHTML = '';
    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.style.padding = '16px';
      empty.style.textAlign = 'center';
      empty.style.color = '#94A3B8';
      empty.style.fontSize = '11px';
      empty.textContent = 'No matching devices found';
      pickerList.appendChild(empty);
      return;
    }

    filtered.forEach((p) => {
      const item = document.createElement('div');
      item.className = `picker-item ${p.id === activeId ? 'selected' : ''}`;

      const left = document.createElement('div');
      left.className = 'picker-item-name';
      left.textContent = p.name;
      item.appendChild(left);

      const badge = document.createElement('span');
      badge.className = 'picker-os-badge';
      badge.textContent = getOsBadgeLabel(p.os);
      item.appendChild(badge);

      item.addEventListener('click', () => {
        selectPreset(p.id);
      });

      pickerList.appendChild(item);
    });
  }

  function selectPreset(presetId) {
    if (!activeConfig) return;
    activeConfig.selected_preset_id = presetId;
    updateSelectedPresetView();
    togglePicker(false);

    chrome.runtime.sendMessage({
      type: 'UPDATE_CONFIG',
      config: { selected_preset_id: presetId }
    });
  }

  // --- Network & Action Handlers --------------------------------------------

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
