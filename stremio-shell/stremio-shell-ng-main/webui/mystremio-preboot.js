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

  sanitizeHeroCache();
  disableServiceWorker();
  installCrashRecovery();
  window.__MYSTREMIO_REACT_HERO__ = true;

  // MPV Stats Overlay Shortcut (Ctrl+O)
  let mpvMsgId = 20000;
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      if (!window.chrome?.webview?.postMessage) return;
      mpvMsgId++;
      try {
        window.chrome.webview.postMessage(JSON.stringify({
          id: mpvMsgId,
          args: ['mpv-command', ['script-binding', 'stats/display-stats-toggle']]
        }));
      } catch (err) {}
    }
  });
})();
