(function () {
  'use strict';

  if (window.__stremioCustomHeroLoading) return;
  window.__stremioCustomHeroLoading = true;

  const STYLE_ID = 'mystremio-hero-loading-style';

  function isBoardRoute() {
    const hash = location.hash || '#/';
    return hash === '#/' || hash === '#/board' || /^#\/board(?:\/|$|\?|#)/.test(hash);
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      [class*="hero-slot"][data-state="loading"] [class*="hero-container"],
      [class*="hero-slot"][data-state="loading"] [class*="hero-overlay"],
      [class*="hero-slot"][data-state="loading"] [class*="hero-image-stack"],
      [class*="hero-slot"][data-state="loading"] [class*="hero-controls"],
      [class*="hero-slot"][data-state="loading"] [class*="hero-indicators"] {
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      [class*="hero-slot"][data-state="loading"] [class*="hero-slot-loader"] {
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 1rem !important;
        min-height: 18rem !important;
        width: 100% !important;
        opacity: 1 !important;
        visibility: visible !important;
      }

      [class*="hero-slot"][data-state="loading"] [class*="hero-slot-loader"]::after {
        content: '' !important;
        display: block !important;
        width: min(320px, 70%) !important;
        height: 4px !important;
        border-radius: 999px !important;
        background: rgba(255, 255, 255, 0.12) !important;
        overflow: hidden !important;
        position: relative !important;
      }

      [class*="hero-slot"][data-state="loading"] [class*="hero-slot-loader"]::before {
        content: '' !important;
        position: absolute !important;
        width: min(320px, 70%) !important;
        height: 4px !important;
        border-radius: 999px !important;
        background: linear-gradient(
          90deg,
          rgba(255, 255, 255, 0) 0%,
          rgba(255, 255, 255, 0.85) 50%,
          rgba(255, 255, 255, 0) 100%
        ) !important;
        animation: mystremio-hero-bar 1.2s ease-in-out infinite !important;
      }

      @keyframes mystremio-hero-bar {
        0% { transform: translateX(-120%); }
        100% { transform: translateX(120%); }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function markLoadingSlots() {
    if (!isBoardRoute()) return;
    document.querySelectorAll('[class*="hero-slot"]').forEach((slot) => {
      if (slot.dataset.state === 'loading') return;
      const hasHero = slot.querySelector('[class*="hero-container"]');
      if (!hasHero) return;
      slot.dataset.state = 'loading';
    });
  }

  function clearLoadingWhenReady() {
    document.querySelectorAll('[class*="hero-slot"][data-state="loading"]').forEach((slot) => {
      const img = slot.querySelector('[class*="hero-container"] img[src]');
      const src = img?.getAttribute('src') || img?.src || '';
      if (!src || /stremio_symbol|anonymous\.png|placeholder/i.test(src)) return;
      delete slot.dataset.state;
    });
  }

  function tick() {
    if (!isBoardRoute()) return;
    ensureStyles();
    markLoadingSlots();
    clearLoadingWhenReady();
  }

  window.__stremioCustomHeroLoadingEnsure = tick;

  tick();
  window.addEventListener('hashchange', () => window.setTimeout(tick, 50));
  document.addEventListener('DOMContentLoaded', tick);
  window.addEventListener('load', tick);
  if (!window.__stremioCustomHeroLoadingInterval) {
    window.__stremioCustomHeroLoadingInterval = window.setInterval(tick, 400);
  }
})();
