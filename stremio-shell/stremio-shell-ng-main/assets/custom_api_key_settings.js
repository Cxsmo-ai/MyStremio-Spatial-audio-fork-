(function () {
  'use strict';

  if (window.__stremioCustomApiKeySettings) return;
  window.__stremioCustomApiKeySettings = true;

  const STYLE_ID = 'stremio-api-key-settings-style';
  const ROW_BOUND_ATTR = 'data-api-key-row-bound';

  const KEY_HINTS = [
    { pattern: /tidb/i, key: 'tidb_api_key', base: 'tidb' },
    { pattern: /tmdb/i, key: 'tmdbApiKey', base: 'data-enrichment' },
    { pattern: /rpdb/i, key: 'rpdbApiKey', base: 'data-enrichment' },
  ];

  function api() {
    return window.StremioCustomAPI || window.StremioEnhancedAPI;
  }

  function isApiKeyField(key) {
    const normalized = String(key || '').toLowerCase();
    return normalized.includes('apikey') || normalized.includes('api_key') || normalized.endsWith('token');
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      input::-ms-reveal,
      input::-ms-clear {
        display: none !important;
      }
      .stremio-api-key-input-wrap {
        position: relative;
        width: 100%;
      }
      .stremio-api-key-input-wrap input[class*="plugin-setting-input"] {
        width: 100%;
        padding-right: 3.25rem !important;
      }
      .stremio-api-key-input-wrap input.stremio-api-key-masked {
        -webkit-text-security: disc;
        text-security: disc;
      }
      .stremio-api-key-eye {
        position: absolute;
        right: 0.35rem;
        top: 50%;
        transform: translateY(-50%);
        width: 2.5rem;
        height: 2.5rem;
        padding: 0;
        border: 0;
        background: transparent;
        color: rgba(255, 255, 255, 0.82);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        opacity: 0.88;
        z-index: 5;
        pointer-events: auto;
        touch-action: manipulation;
      }
      .stremio-api-key-eye:hover {
        opacity: 1;
      }
      .stremio-api-key-eye svg {
        width: 1.15rem;
        height: 1.15rem;
        display: block;
        pointer-events: none;
      }
      .stremio-api-key-clear {
        align-self: flex-start;
        margin: -0.15rem 0 0 0.15rem;
        padding: 0.15rem 0;
        border: 0;
        background: transparent;
        color: rgba(255, 255, 255, 0.42);
        font-size: 0.82rem;
        line-height: 1.2;
        cursor: pointer;
        text-decoration: none;
        pointer-events: auto;
        touch-action: manipulation;
      }
      .stremio-api-key-clear:hover {
        color: rgba(255, 255, 255, 0.62);
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function eyeOpenSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
  }

  function eyeClosedSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/><path d="m4 4 16 16"/></svg>';
  }

  function readLabel(row) {
    const labelEl = row.querySelector('[class*="plugin-setting-label"]:not([class*="row"])');
    return String(labelEl?.textContent || '').trim();
  }

  function resolveFieldMeta(input, row) {
    const base = input.dataset.pluginBase;
    const key = input.dataset.settingKey;
    if (base && key && isApiKeyField(key)) {
      return { base, key };
    }

    const label = readLabel(row);
    for (const hint of KEY_HINTS) {
      if (hint.pattern.test(label)) {
        return { base: hint.base, key: hint.key };
      }
    }
    return null;
  }

  function getRowParts(row) {
    const wrap = row.querySelector('.stremio-api-key-input-wrap');
    if (!wrap) return null;
    const input = wrap.querySelector('input[class*="plugin-setting-input"]');
    const eyeBtn = wrap.querySelector('.stremio-api-key-eye');
    const clearBtn = row.querySelector('.stremio-api-key-clear');
    if (!input || !eyeBtn) return null;
    return { wrap, input, eyeBtn, clearBtn };
  }

  function isRevealed(wrap) {
    return wrap.dataset.apiKeyRevealed === '1';
  }

  function setRevealed(wrap, revealed) {
    wrap.dataset.apiKeyRevealed = revealed ? '1' : '0';
  }

  function applyMaskState(input, revealed) {
    input.type = 'text';
    input.classList.toggle('stremio-api-key-masked', !revealed);
    input.setAttribute('autocomplete', 'off');
  }

  function syncRowUi(row) {
    const parts = getRowParts(row);
    if (!parts) return;
    const { wrap, input, eyeBtn } = parts;
    const revealed = isRevealed(wrap);
    eyeBtn.innerHTML = revealed ? eyeClosedSvg() : eyeOpenSvg();
    eyeBtn.setAttribute('aria-label', revealed ? 'Hide API key' : 'Show API key');
    applyMaskState(input, revealed);
  }

  function setInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function cleanupRow(row) {
    const wraps = row.querySelectorAll('.stremio-api-key-input-wrap');
    wraps.forEach((wrap, index) => {
      if (index > 0) wrap.remove();
    });
    const wrap = row.querySelector('.stremio-api-key-input-wrap');
    if (wrap) {
      wrap.querySelectorAll('.stremio-api-key-eye').forEach((eye, index) => {
        if (index > 0) eye.remove();
      });
    }
    row.querySelectorAll('.stremio-api-key-clear').forEach((clear, index) => {
      if (index > 0) clear.remove();
    });
  }

  function ensureRowStructure(input, row, meta) {
    cleanupRow(row);

    let wrap = input.closest('.stremio-api-key-input-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'stremio-api-key-input-wrap';
      input.parentNode.insertBefore(wrap, input);
    }
    if (input.parentElement !== wrap) {
      wrap.appendChild(input);
    }

    if (!wrap.dataset.apiKeyRevealed) {
      wrap.dataset.apiKeyRevealed = '0';
    }

    if (!wrap.querySelector('.stremio-api-key-eye')) {
      const eyeBtn = document.createElement('button');
      eyeBtn.type = 'button';
      eyeBtn.className = 'stremio-api-key-eye';
      eyeBtn.setAttribute('tabindex', '-1');
      wrap.appendChild(eyeBtn);
    }

    if (!row.querySelector('.stremio-api-key-clear')) {
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'stremio-api-key-clear';
      clearBtn.textContent = 'Clear';
      clearBtn.setAttribute('tabindex', '-1');
      wrap.insertAdjacentElement('afterend', clearBtn);
    }

    row.dataset.apiKeyBase = meta.base;
    row.dataset.apiKeySetting = meta.key;
  }

  function bindRowEvents(row) {
    if (row.getAttribute(ROW_BOUND_ATTR) === '1') return;
    row.setAttribute(ROW_BOUND_ATTR, '1');

    row.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;

      if (event.target.closest('.stremio-api-key-eye')) {
        event.preventDefault();
        event.stopPropagation();
        const parts = getRowParts(row);
        if (!parts) return;
        setRevealed(parts.wrap, !isRevealed(parts.wrap));
        syncRowUi(row);
        return;
      }

      if (event.target.closest('.stremio-api-key-clear')) {
        event.preventDefault();
        event.stopPropagation();
        const parts = getRowParts(row);
        if (!parts) return;
        const base = row.dataset.apiKeyBase;
        const key = row.dataset.apiKeySetting;
        const client = api();
        Promise.resolve()
          .then(async () => {
            if (client?.saveSetting && base && key) {
              await client.saveSetting(base, key, '');
            }
          })
          .finally(() => {
            const latest = getRowParts(row);
            if (!latest) return;
            setInputValue(latest.input, '');
            setRevealed(latest.wrap, false);
            syncRowUi(row);
          });
      }
    }, true);

    row.addEventListener('input', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (!target.matches('input[class*="plugin-setting-input"]')) return;
      const parts = getRowParts(row);
      if (!parts || parts.input !== target) return;
      target.type = 'text';
      if (!isRevealed(parts.wrap)) {
        target.classList.add('stremio-api-key-masked');
      }
    }, true);
  }

  function enhanceRow(input) {
    const row = input.closest('[class*="plugin-setting-row-stacked"], [class*="plugin-setting-option"]');
    if (!row) return;

    const meta = resolveFieldMeta(input, row);
    if (!meta) return;

    injectStyles();
    ensureRowStructure(input, row, meta);
    bindRowEvents(row);
    syncRowUi(row);
  }

  function scan() {
    injectStyles();
    document.querySelectorAll('input[class*="plugin-setting-input"]').forEach((input) => {
      const row = input.closest('[class*="plugin-setting-row-stacked"], [class*="plugin-setting-option"]');
      if (!row) return;
      if (!resolveFieldMeta(input, row)) return;
      enhanceRow(input);
    });
  }

  let scanTimer = null;
  function scheduleScan() {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 120);
  }

  const observer = new MutationObserver(scheduleScan);
  function startObserver() {
    if (!document.body) return;
    observer.observe(document.body, { childList: true, subtree: true });
    scheduleScan();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  } else {
    startObserver();
  }

  window.__stremioCustomApiKeySettingsEnsure = scheduleScan;
})();
