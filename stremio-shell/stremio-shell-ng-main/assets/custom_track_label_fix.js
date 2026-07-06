(function () {
  'use strict';

  if (window.__stremioCustomTrackLabelFix) return;
  window.__stremioCustomTrackLabelFix = true;

  const MOJIBAKE_MARKERS = [
    '×',
    'Ã',
    'â',
    'ä',
    'å',
    'ç',
    'è',
    'é',
    'ö',
    'ü',
    'ð',
    'Ø',
    '§',
    'ù',
    'ÿ',
  ];

  const ISO2_TO_ISO3 = {
    de: 'ger',
    en: 'eng',
    ja: 'jpn',
    fr: 'fre',
    es: 'spa',
    it: 'ita',
    pt: 'por',
    ru: 'rus',
    ko: 'kor',
    zh: 'zho',
    ar: 'ara',
    nl: 'nld',
    pl: 'pol',
    tr: 'tur',
    cs: 'ces',
  };

  function looksMojibake(value) {
    if (!value || typeof value !== 'string') return false;
    if (value.isascii?.() === true) return false;
    if (/^[\x00-\x7f]*$/.test(value)) return false;
    if (MOJIBAKE_MARKERS.some((ch) => value.includes(ch))) return true;
    if (
      /[\u0080-\u00ff]{2,}/.test(value) &&
      !/[\u0400-\u04ff\u0590-\u05ff\u0600-\u06ff\u0900-\u097f\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(
        value
      )
    ) {
      return true;
    }
    return false;
  }

  function fixMojibake(value) {
    if (!value || typeof value !== 'string') return value;
    try {
      const bytes = Uint8Array.from([...value].map((ch) => ch.charCodeAt(0) & 0xff));
      const fixed = new TextDecoder('utf-8').decode(bytes);
      if (fixed && fixed !== value && !looksMojibake(fixed)) return fixed;
    } catch (_) {}
    return value;
  }

  function normalizeLangCode(code) {
    if (!code || typeof code !== 'string') return '';
    const trimmed = code.trim().toLowerCase();
    if (!trimmed) return '';
    if (trimmed.length === 2) return ISO2_TO_ISO3[trimmed] || trimmed;
    return trimmed;
  }

  function languageLabelForTrack(track) {
    const names = window.__stremioLanguageNames;
    if (!names || typeof names !== 'object') return null;
    const candidates = [track?.lang, track?.language, track?.id?.lang].filter(Boolean);
    for (const raw of candidates) {
      const code = normalizeLangCode(String(raw));
      if (!code) continue;
      if (names[code]) return names[code];
      const short = code.slice(0, 2);
      if (names[short]) return names[short];
    }
    return null;
  }

  function sanitizeTrack(track) {
    if (!track || typeof track !== 'object') return track;
    const next = Object.assign({}, track);
    let title = typeof next.title === 'string' ? next.title.trim() : '';

    if (title && looksMojibake(title)) {
      const fixed = fixMojibake(title);
      title = looksMojibake(fixed) ? '' : fixed;
    }

    const label = languageLabelForTrack(next);
    if (!title && label) {
      next.title = label;
      return next;
    }

    if (title && label && looksMojibake(title)) {
      next.title = label;
      return next;
    }

    if (title) next.title = title;
    return next;
  }

  function sanitizeTrackList(tracks) {
    if (!Array.isArray(tracks)) return tracks;
    return tracks.map(sanitizeTrack);
  }

  function patchPayload(raw) {
    if (raw == null) return raw;

    let data = raw;
    let asString = false;
    if (typeof raw === 'string') {
      try {
        data = JSON.parse(raw);
        asString = true;
      } catch (_) {
        return raw;
      }
    }

    const args = Array.isArray(data?.args) ? data.args : Array.isArray(data) ? data : null;
    const change = args?.[0] === 'mpv-prop-change' ? args[1] : data?.[1];
    if (!change || change.name !== 'track-list' || !Array.isArray(change.data)) {
      return raw;
    }

    change.data = sanitizeTrackList(change.data);

    if (asString) {
      try {
        return JSON.stringify(data);
      } catch (_) {
        return raw;
      }
    }
    return data;
  }

  function patchDomText(root) {
    if (!root) return;
    const scope =
      root instanceof Element
        ? root
        : document.querySelector('[class*="player-container"] [class*="side-drawer"]') ||
          document.querySelector('[class*="player-container"] [class*="menu-container"]') ||
          document.body;

    scope.querySelectorAll(
      '[class*="option"], [class*="menu-item"], [class*="label"], [class*="multiselect"] [class*="option"]'
    ).forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const text = (el.textContent || '').trim();
      if (!text || !looksMojibake(text)) return;
      const fixed = fixMojibake(text);
      if (fixed && fixed !== text && !looksMojibake(fixed)) {
        el.textContent = fixed;
      }
    });
  }

  function wrapListener(listener) {
    return function wrapped(ev) {
      try {
        const patched = patchPayload(ev?.data);
        if (patched !== ev?.data) {
          if (typeof Event === 'function') {
            const next =
              typeof MessageEvent === 'function'
                ? new MessageEvent(ev.type, { data: patched })
                : { ...ev, data: patched };
            return listener.call(this, next);
          }
          return listener.call(this, { ...ev, data: patched });
        }
      } catch (_) {}
      return listener.call(this, ev);
    };
  }

  function hookIncomingTrackList() {
    if (window.__stremioCustomTrackLabelHook) return;
    window.__stremioCustomTrackLabelHook = true;

    if (window.chrome?.webview && !window.chrome.webview.__stremioCustomTrackLabelPatched) {
      window.chrome.webview.__stremioCustomTrackLabelPatched = true;
      const listeners = window.chrome.webview.__stremioTrackLabelWrappedListeners || new WeakMap();
      window.chrome.webview.__stremioTrackLabelWrappedListeners = listeners;
      const originalAdd = window.chrome.webview.addEventListener.bind(window.chrome.webview);
      window.chrome.webview.addEventListener = function (type, listener, options) {
        if (type === 'message' && typeof listener === 'function') {
          let wrapped = listeners.get(listener);
          if (!wrapped) {
            wrapped = wrapListener(listener);
            listeners.set(listener, wrapped);
          }
          return originalAdd(type, wrapped, options);
        }
        return originalAdd(type, listener, options);
      };
    }

    const transport = window.qt?.webChannelTransport;
    if (transport && !transport.__stremioCustomTrackLabelHooked) {
      transport.__stremioCustomTrackLabelHooked = true;
      const original = transport.onmessage;
      transport.onmessage = function (ev) {
        try {
          const patched = patchPayload(ev?.data);
          if (patched !== ev?.data) {
            return typeof original === 'function'
              ? original.call(this, { ...ev, data: patched })
              : undefined;
          }
        } catch (_) {}
        if (typeof original === 'function') return original.call(this, ev);
      };
    }
  }

  let domTimer = null;
  function scheduleDomPatch() {
    if (domTimer) return;
    domTimer = window.setTimeout(() => {
      domTimer = null;
      patchDomText();
    }, 80);
  }

  hookIncomingTrackList();

  window.addEventListener('hashchange', scheduleDomPatch);
  document.addEventListener('stremio-custom-bootstrap-ready', scheduleDomPatch);
  document.addEventListener('stremio-custom-stream-started', scheduleDomPatch);

  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(scheduleDomPatch);
    const startObserver = () => {
      const root = document.querySelector('[class*="player-container"]');
      if (!root) return;
      observer.observe(root, { childList: true, subtree: true, characterData: true });
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startObserver);
    } else {
      startObserver();
    }
    window.addEventListener('hashchange', () => window.setTimeout(startObserver, 200));
  }

  window.__stremioCustomTrackLabelFixEnsure = scheduleDomPatch;
  window.__stremioSanitizeTrackList = sanitizeTrackList;
  console.info('[StremioCustom] Track label mojibake fix ready.');
})();
