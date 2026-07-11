(function () {
  'use strict';

  /**
   * Runs before bundled main.js. Desktop shell serves the UI locally; the PWA
   * service worker only causes stale main.js after updates and provokes hero crashes.
   */
  if (window.__stremioCustomPreboot) return;
  window.__stremioCustomPreboot = true;

  const HERO_CACHE_KEY = 'mystremio_hero_titles_v1';
  const RELOAD_GUARD_KEY = 'mystremio_hero_crash_reload_v1';

  function sanitizeHeroCache() {
    try {
      const raw = localStorage.getItem(HERO_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        localStorage.removeItem(HERO_CACHE_KEY);
        return;
      }
      const valid = parsed.filter(
        (item) =>
          item &&
          typeof item === 'object' &&
          typeof item.id === 'string' &&
          item.id.length > 0 &&
          item.id !== 'tt0903747'
      );
      if (!valid.length || valid.length !== parsed.length) {
        if (valid.length) localStorage.setItem(HERO_CACHE_KEY, JSON.stringify(valid));
        else localStorage.removeItem(HERO_CACHE_KEY);
      }
    } catch (_) {
      localStorage.removeItem(HERO_CACHE_KEY);
    }
  }

  function disableServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    const blocked = function () {
      console.info('[StremioCustom] Service worker registration blocked (desktop shell)');
      return Promise.resolve({
        unregister: () => Promise.resolve(true),
        update: () => Promise.resolve(),
        active: null,
        installing: null,
        waiting: null,
        addEventListener: () => {},
        removeEventListener: () => {},
      });
    };
    try {
      navigator.serviceWorker.register = blocked;
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      }).catch(() => {});
    } catch (_) {}
    if (window.caches && typeof caches.keys === 'function') {
      caches.keys().then((keys) => keys.forEach((key) => caches.delete(key))).catch(() => {});
    }
  }

  function installCrashRecovery() {
    if (window.__stremioCustomPrebootCrashHook) return;
    window.__stremioCustomPrebootCrashHook = true;

    window.addEventListener('error', (event) => {
      const message = String(event?.message || '');
      if (!/reading 'year'|DynamicHero/i.test(message)) return;
      try {
        localStorage.removeItem(HERO_CACHE_KEY);
        if (sessionStorage.getItem(RELOAD_GUARD_KEY) === '1') return;
        sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
        console.warn('[StremioCustom] Hero crash detected, clearing cache and reloading once');
        window.location.reload();
      } catch (_) {}
    });

    window.addEventListener('unhandledrejection', (event) => {
      const reason = String(event?.reason?.message || event?.reason || '');
      if (!/reading 'year'|DynamicHero/i.test(reason)) return;
      try {
        localStorage.removeItem(HERO_CACHE_KEY);
        if (sessionStorage.getItem(RELOAD_GUARD_KEY) === '1') return;
        sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
        console.warn('[StremioCustom] Hero promise rejection, clearing cache and reloading once');
        window.location.reload();
      } catch (_) {}
    });
  }

  function loadTidalTab() {
    if (window.__MYSTREMIO_DISABLE_TIDAL__) return;
    if (document.getElementById('mystremio-tidal-tab-script')) return;
    // WebView2 can finish the bundled app bootstrap before a dynamically
    // appended relative script executes. Insert a synchronous parser script
    // while this preboot file is still being parsed, then keep the fallback.
    if (document.readyState === 'loading' && typeof document.write === 'function') {
      document.write('<script id="mystremio-tidal-tab-script" src="mystremio-tidal-tab.js?v=20260709-3"><' + '/script>');
      return;
    }
    const script = document.createElement('script');
    script.id = 'mystremio-tidal-tab-script';
    script.src = 'mystremio-tidal-tab.js?v=20260709-3';
    script.async = false;
    (document.head || document.documentElement).appendChild(script);
  }

  function installTidalFallback() {
    if (window.__MYSTREMIO_DISABLE_TIDAL__) return;
    if (document.getElementById('mystremio-tidal-tab') || document.getElementById('mystremio-tidal-fallback')) return;
    if (!document.body) return;
    const fallback = document.createElement('button');
    fallback.id = 'mystremio-tidal-fallback';
    fallback.textContent = 'TIDAL';
    fallback.title = 'Open TIDAL';
    fallback.style.cssText = 'position:fixed;left:18px;top:50%;z-index:2147483647;transform:translateY(-50%);padding:12px 10px;border:1px solid rgba(255,255,255,.25);border-radius:14px;background:#191a20;color:#fff;font-weight:800;writing-mode:vertical-rl;letter-spacing:.12em;cursor:pointer;box-shadow:0 12px 36px #0008';
    fallback.addEventListener('click', () => {
      fallback.remove();
      const retry = document.createElement('script');
      retry.src = 'mystremio-tidal-tab.js?v=20260709-5';
      (document.head || document.documentElement).appendChild(retry);
    });
    document.body.appendChild(fallback);
  }

  sanitizeHeroCache();
  disableServiceWorker();
  installCrashRecovery();
  loadTidalTab();
  window.setTimeout(installTidalFallback, 2500);
  window.__MYSTREMIO_REACT_HERO__ = true;

  // MPV Stats Overlay Shortcut (Ctrl+I)
  let mpvMsgId = 20000;
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      e.stopPropagation();
      if (!window.chrome?.webview?.postMessage) return;
      
      try {
        mpvMsgId++;
        window.chrome.webview.postMessage(JSON.stringify({
          id: mpvMsgId,
          args: ['mpv-command', ['script-binding', 'stats/display-stats-toggle']]
        }));
        
        mpvMsgId++;
        window.chrome.webview.postMessage(JSON.stringify({
          id: mpvMsgId,
          args: ['mpv-command', ['show-text', 'Decoder: ${ad} | Input: ${audio-codec-name} ${audio-params/channel-count}ch | Mode: ${ad-orender-channel-render-mode}', '5000']]
        }));
      } catch (err) {}
    }
  }, true);
})();
