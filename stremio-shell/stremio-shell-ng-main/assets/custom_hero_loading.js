(function () {
  'use strict';

  if (window.__stremioCustomHeroLoading) return;
  window.__stremioCustomHeroLoading = true;

  const STYLE_ID = 'mystremio-hero-loading-style';
  const FALLBACK_HERO_ID = 'tt0903747';
  const PLACEHOLDER_SRC = /stremio_symbol|anonymous\.png|placeholder/i;

  function isBoardRoute() {
    const hash = location.hash || '#/';
    return hash === '#/' || hash === '#/board' || /^#\/board(?:\/|$|\?|#)/.test(hash);
  }

  function isFallbackHeroContent(slot) {
    const imgs = slot.querySelectorAll('[class*="hero-container"] img[src], [class*="hero-image-stack"] img[src]');
    for (const img of imgs) {
      const src = img.getAttribute('src') || img.src || '';
      if (src && (src.includes(FALLBACK_HERO_ID) || /breaking[\s_-]?bad/i.test(src))) {
        return true;
      }
    }

    const titleNode = slot.querySelector('[class*="hero-title"], [class*="hero-overlay"] h1, [class*="hero-overlay"] h2');
    const title = String(titleNode?.textContent || '').trim();
    if (/^breaking bad$/i.test(title)) return true;

    return false;
  }

  function hasRealHeroImage(slot) {
    const img = slot.querySelector('[class*="hero-container"] img[src], [class*="hero-image-stack"] img[src]');
    const src = img?.getAttribute('src') || img?.src || '';
    if (!src || PLACEHOLDER_SRC.test(src)) return false;
    if (src.includes(FALLBACK_HERO_ID) || /breaking[\s_-]?bad/i.test(src)) return false;
    return true;
  }

  function ensureSlotLoader(slot) {
    if (slot.querySelector('[class*="hero-slot-loader"]')) return;
    const loader = document.createElement('div');
    loader.className = 'mystremio-hero-slot-loader';
    loader.setAttribute('aria-hidden', 'true');
    const spinner = document.createElement('div');
    spinner.className = 'mystremio-hero-slot-spinner';
    loader.appendChild(spinner);
    slot.appendChild(loader);
  }

  function setSlotLoading(slot) {
    ensureSlotLoader(slot);
    slot.dataset.state = 'loading';
  }

  function clearSlotLoading(slot) {
    if (slot.dataset.state !== 'loading') return;
    delete slot.dataset.state;
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

      [class*="hero-slot"][data-state="loading"] [class*="hero-slot-loader"],
      [class*="hero-slot"][data-state="loading"] .mystremio-hero-slot-loader {
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 1rem !important;
        position: absolute !important;
        inset: 0 !important;
        z-index: 5 !important;
        min-height: 18rem !important;
        width: 100% !important;
        opacity: 1 !important;
        visibility: visible !important;
        background: linear-gradient(135deg, #0c0c0c 0%, #1a1a1a 50%, #0c0c0c 100%) !important;
      }

      [class*="hero-slot"][data-state="loading"] [class*="hero-slot-spinner"],
      [class*="hero-slot"][data-state="loading"] .mystremio-hero-slot-spinner {
        width: 42px !important;
        height: 42px !important;
        border-radius: 50% !important;
        border: 3px solid rgba(255, 255, 255, 0.12) !important;
        border-top-color: rgba(255, 255, 255, 0.85) !important;
        animation: mystremio-hero-spin 0.9s linear infinite !important;
      }

      @keyframes mystremio-hero-spin {
        to { transform: rotate(360deg); }
      }

      [class*="hero-slot"][data-state="loading"] [class*="hero-slot-loader"]::after,
      [class*="hero-slot"][data-state="loading"] .mystremio-hero-slot-loader::after {
        content: '' !important;
        display: block !important;
        width: min(320px, 70%) !important;
        height: 4px !important;
        border-radius: 999px !important;
        background: rgba(255, 255, 255, 0.12) !important;
        overflow: hidden !important;
        position: relative !important;
      }

      [class*="hero-slot"][data-state="loading"] [class*="hero-slot-loader"]::before,
      [class*="hero-slot"][data-state="loading"] .mystremio-hero-slot-loader::before {
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
      if (isFallbackHeroContent(slot)) {
        setSlotLoading(slot);
        return;
      }
      if (hasRealHeroImage(slot)) return;
      const hasHero = slot.querySelector('[class*="hero-container"], [class*="hero-image-stack"]');
      if (!hasHero) return;
      setSlotLoading(slot);
    });
  }

  function clearLoadingWhenReady() {
    document.querySelectorAll('[class*="hero-slot"][data-state="loading"]').forEach((slot) => {
      if (isFallbackHeroContent(slot)) return;
      if (!hasRealHeroImage(slot)) return;
      clearSlotLoading(slot);
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
