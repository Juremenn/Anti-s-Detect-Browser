/**
 * Anti Detect Browser - Content Bridge (Manifest V3 - ISOLATED World)
 * Runs at document_start. Bridges chrome.storage.local configuration
 * and events to the MAIN world spoof-engine.
 */

(() => {
  'use strict';

  // Hydrate active configuration from chrome.storage.local
  function hydrate() {
    chrome.storage.local.get(['config'], (result) => {
      const cfg = result && result.config ? result.config : null;
      if (!cfg) return;

      // 1. Dispatch custom event to window
      window.dispatchEvent(
        new CustomEvent('__ANTI_DETECT_CONFIG_SYNC__', {
          detail: cfg
        })
      );

      // 2. Attach to document element dataset for fallback sync reads
      if (document.documentElement) {
        try {
          document.documentElement.dataset.adConfig = JSON.stringify({
            enabled: cfg.enabled,
            presetId: cfg.selected_preset_id,
            seed: cfg.profile_seed,
            ip: cfg.ip_info,
            modules: cfg.modules
          });
        } catch (_) {}
      }
    });
  }

  // Initial immediate hydration
  hydrate();

  // Re-hydrate when DOM starts ready
  if (document.readyState === 'loading') {
    document.addEventListener('readystatechange', () => {
      if (document.readyState === 'interactive' || document.readyState === 'complete') {
        hydrate();
      }
    }, { once: true });
  }

  // Listen for storage updates (e.g. preset change, fresh IP rotation, seed change)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.config) {
      const newConfig = changes.config.newValue;
      window.dispatchEvent(
        new CustomEvent('__ANTI_DETECT_CONFIG_UPDATED__', {
          detail: newConfig
        })
      );
    }
  });

  // Listen for status requests from page
  window.addEventListener('__ANTI_DETECT_REQUEST_STATUS__', () => {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
      window.dispatchEvent(
        new CustomEvent('__ANTI_DETECT_RESPONSE_STATUS__', {
          detail: res
        })
      );
    });
  });
})();
