(function () {
  'use strict';

  /**
   * MyStremio Player Loader
   *
   * Uses Stremio's native player loading layers (poster + pulsing logo).
   * We only: (1) brand them with series artwork, (2) hold the video gate
   * until MPV is genuinely playing, then (3) let Stremio hide loading itself.
   */

  if (window.__stremioCustomPlayerLoading) return;
  window.__stremioCustomPlayerLoading = true;

  const STYLE_ID = 'stremio-custom-player-loader-style';
  const PRESENTING_CLASS = 'stremio-custom-video-presenting';
  const APP_LOADING_STYLE_ID = 'stremio-custom-app-loading-style';
  const APP_LOADING_MASK_ID = 'stremio-custom-app-loading-mask';
  const TOP_SEAM_FIX_STYLE_ID = 'stremio-custom-top-seam-fix';
  const SCROLLBAR_FIX_STYLE_ID = 'stremio-custom-scrollbar-fix';

  const MIN_LOAD_MS = 3000;
  const MAX_LOAD_MS = 14000;
  const GATE_OPEN_DELAY_MS = 600;
  const MPV_SETTLE_MS = 1200;
  const MPV_FRESH_MS = 4000;
  const MPV_MIN_POSITION = 1.5;
  const MPV_MIN_SPAN = 1.0;
  const MPV_TICKS_REQUIRED = 5;
  const MPV_MIN_CACHE_AHEAD = 0.35;
  const ARTWORK_RETRY_MAX = 14;
  const ARTWORK_RETRY_MS = 450;

  let artwork = { background: null, logo: null, imdbId: null };
  let loading = false;
  let loadStartedAt = 0;
  let mpvTicks = 0;
  let lastMpvPosition = -1;
  let firstMpvPosition = -1;
  let mpvReadySince = 0;
  let minTimer = null;
  let maxTimer = null;
  let artworkRetryTimer = null;
  let artworkRetryCount = 0;
  let artworkFetch = null;
  let brandObserver = null;
  let containerWatch = null;
  let pendingLoad = false;

  function isPlayerRoute() {
    return /#\/player/.test(location.hash || '');
  }

  function isUsableImageSrc(src) {
    return Boolean(src && typeof src === 'string' && !/^data:,?$/.test(src));
  }

  function isStremioDefaultLogo(src) {
    return Boolean(src && /stremio_symbol|\/logo\.png/i.test(src));
  }

  function extractImdbId(value) {
    if (!value || typeof value !== 'string') return null;
    const match = value.match(/tt\d{7,8}/i);
    return match ? match[0] : null;
  }

  function metahubFromId(id) {
    const imdbId = extractImdbId(id);
    if (!imdbId) return null;
    return {
      background: `https://images.metahub.space/background/large/${imdbId}/img`,
      logo: `https://images.metahub.space/logo/medium/${imdbId}/img`,
    };
  }

  function backgroundRank(src) {
    if (!isUsableImageSrc(src)) return 0;
    if (/\/background\/large\//.test(src)) return 100;
    if (/\/background\/medium\//.test(src)) return 80;
    if (/images\.metahub\.space\/background\//.test(src)) return 70;
    if (/images\.metahub\.space\/poster\//.test(src)) return 25;
    return 10;
  }

  function logoRank(src) {
    if (!isUsableImageSrc(src)) return 0;
    if (/images\.metahub\.space\/logo\//.test(src)) return 100;
    return 10;
  }

  function enrichArtwork(background, logo, idHint) {
    const imdbFromHint = extractImdbId(String(idHint || ''));
    const imdbFromBg = extractImdbId(background || '');
    const metahub = metahubFromId(imdbFromHint || imdbFromBg || '');
    let bg = background || null;
    let lg = logo || null;

    if (metahub) {
      if (backgroundRank(metahub.background) >= backgroundRank(bg)) bg = metahub.background;
      if (!lg || logoRank(metahub.logo) > logoRank(lg)) lg = metahub.logo;
    }

    if (bg && /\/poster\//.test(bg) && metahub) bg = metahub.background;

    if (!isUsableImageSrc(bg) && !isUsableImageSrc(lg)) return null;
    const imdbId = imdbFromHint || imdbFromBg || extractImdbId(bg || '') || null;
    return { background: bg || null, logo: lg || null, imdbId };
  }

  function resolveBackgroundUrl() {
    const hub = metahubFromId(artwork.imdbId || extractImdbId(artwork.background || ''));
    if (hub?.background) return hub.background;
    return artwork.background;
  }

  function resolveLogoUrl() {
    const hub = metahubFromId(artwork.imdbId || extractImdbId(artwork.background || ''));
    if (hub?.logo) return hub.logo;
    return artwork.logo;
  }

  function injectLoaderStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      [class*="player-container"] [class*="background-layer"] [class*="image"] {
        opacity: 0.6 !important;
        object-fit: cover !important;
      }
      [class*="player-container"] [class*="buffering-layer"] [class*="logo"],
      [class*="player-container"] [class*="buffering-layer"] img[class*="logo"] {
        max-width: 15rem !important;
        max-height: 15rem !important;
      }
      [class*="player-container"] [class*="buffering-layer"] img[src*="stremio_symbol"],
      [class*="player-container"] [class*="buffering-layer"] img[src*="/logo.png"] {
        display: none !important;
      }
      html.${PRESENTING_CLASS} [class*="player-container"] [class*="background-layer"],
      html.${PRESENTING_CLASS} [class*="player-container"] [class*="buffering-layer"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function injectAppLoadingStyles() {
    if (document.getElementById(APP_LOADING_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = APP_LOADING_STYLE_ID;
    style.textContent = `
      #${APP_LOADING_MASK_ID} {
        position: fixed;
        inset: 0;
        z-index: 119;
        background: rgb(20, 20, 20);
        opacity: 0;
        display: none;
        pointer-events: none;
        transition: opacity 120ms ease;
      }
      #${APP_LOADING_MASK_ID}.content-only {
        top: var(--horizontal-nav-bar-size, 5.5rem);
      }
      #${APP_LOADING_MASK_ID}.visible {
        display: block;
        opacity: 1;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function ensureAppLoadingMask() {
    injectAppLoadingStyles();
    let mask = document.getElementById(APP_LOADING_MASK_ID);
    if (!mask) {
      mask = document.createElement('div');
      mask.id = APP_LOADING_MASK_ID;
      document.body.appendChild(mask);
    }
    return mask;
  }

  function ensureTopSeamFix() {
    if (document.getElementById(TOP_SEAM_FIX_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = TOP_SEAM_FIX_STYLE_ID;
    style.textContent = `
      html, body, #app,
      [class*="hero-container"], [class*="hero-slot"],
      [class*="main-nav-bars-container"], [class*="nav-content-container"],
      #app nav[class*="horizontal-nav-bar"] {
        border-top: 0 !important;
        margin-top: 0 !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function ensureScrollbarFix() {
    if (document.getElementById(SCROLLBAR_FIX_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = SCROLLBAR_FIX_STYLE_ID;
    style.textContent = `
      html { color-scheme: dark; }
      #app [class*="main-nav-bars-container"] {
        margin-left: 0 !important;
        margin-right: 0 !important;
        width: 100% !important;
      }
      [class*="hero-slot"] {
        position: relative !important;
        margin-left: -1rem !important;
        margin-right: -1rem !important;
        width: calc(100% + 2rem) !important;
        max-width: none !important;
      }
      #app [class*="board-content-container"] > [class*="board-content"],
      #app [class*="discover-content"] [class*="catalog-container"],
      #app [class*="library-content"],
      #app [class*="addons-list-container"],
      #app [class*="calendar-content"] [class*="content"] {
        overflow-x: hidden !important;
        scrollbar-width: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
    window.__stremioCustomScrollbarEnsure?.();
  }

  let appMaskTimer = null;
  function showAppLoadingMask(ms = 220, options = {}) {
    const mask = ensureAppLoadingMask();
    if (!mask) return;
    mask.classList.toggle('content-only', Boolean(options.contentOnly));
    mask.style.display = 'block';
    mask.classList.add('visible');
    if (appMaskTimer) clearTimeout(appMaskTimer);
    appMaskTimer = setTimeout(() => {
      mask.classList.remove('visible');
      setTimeout(() => {
        if (!mask.classList.contains('visible')) mask.style.display = 'none';
      }, 140);
    }, ms);
  }

  function showBootLoadingMaskUntilReady() {
    if (!document.body) return;
    showAppLoadingMask(1400);
    document.addEventListener(
      'stremio-custom-bootstrap-ready',
      () => {
        setTimeout(() => {
          document.getElementById(APP_LOADING_MASK_ID)?.classList.remove('visible');
        }, 60);
      },
      { once: true }
    );
  }

  function extractArtworkFromRecord(record) {
    if (!record || typeof record !== 'object') return null;
    const content = record.content && typeof record.content === 'object' ? record.content : record;
    const meta = record.metaItem?.content && typeof record.metaItem.content === 'object' ? record.metaItem.content : null;
    let background =
      content.background ||
      meta?.background ||
      content.poster ||
      meta?.poster ||
      record.background ||
      record.poster ||
      null;
    let logo = content.logo || meta?.logo || record.logo || null;
    const idHint = record.id || content.id || meta?.id || record.imdb_id || content.imdb_id || null;

    return enrichArtwork(background, logo, idHint);
  }

  function mergeArtwork(patch) {
    if (!patch || typeof patch !== 'object') return false;
    const idHint = patch.id || patch.imdb_id || patch.imdbId || artwork.imdbId || null;
    const enriched = enrichArtwork(
      patch.background || artwork.background,
      patch.logo || artwork.logo,
      idHint
    );
    if (!enriched) return false;

    let changed = false;
    if (isUsableImageSrc(enriched.background) && backgroundRank(enriched.background) >= backgroundRank(artwork.background)) {
      if (artwork.background !== enriched.background) {
        artwork.background = enriched.background;
        changed = true;
      }
    }
    if (isUsableImageSrc(enriched.logo) && logoRank(enriched.logo) >= logoRank(artwork.logo)) {
      if (artwork.logo !== enriched.logo) {
        artwork.logo = enriched.logo;
        changed = true;
      }
    }
    if (enriched.imdbId && artwork.imdbId !== enriched.imdbId) {
      artwork.imdbId = enriched.imdbId;
      changed = true;
    }
    if (changed) applySeriesBranding();
    return changed;
  }

  function hasArtwork() {
    return isUsableImageSrc(artwork.background) || isUsableImageSrc(artwork.logo);
  }

  async function getCoreState(model) {
    try {
      const transport = window.services?.core?.transport;
      if (transport?.getState) return await transport.getState(model);
    } catch (_) {}
    try {
      if (window.core?.getState) return await window.core.getState(model);
    } catch (_) {}
    return null;
  }

  async function fetchArtworkFromCore() {
    const playerState = await getCoreState('player');
    const fromPlayer = extractArtworkFromRecord(playerState?.metaItem || playerState);
    if (fromPlayer) return fromPlayer;

    const metaDetails = await getCoreState('meta_details');
    const fromMeta = extractArtworkFromRecord(metaDetails?.metaItem || metaDetails);
    if (fromMeta) return fromMeta;

    for (const model of ['continue_watching_preview', 'continue_watching']) {
      const state = await getCoreState(model);
      const items = state?.items || state?.catalog?.content?.content || [];
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        const fromItem = extractArtworkFromRecord(item);
        if (fromItem) return fromItem;
      }
    }
    return null;
  }

  function scheduleArtworkRetry() {
    if (!loading) return;
    if (hasArtwork()) return;
    if (artworkRetryCount >= ARTWORK_RETRY_MAX) return;
    if (artworkRetryTimer) return;
    artworkRetryTimer = window.setTimeout(() => {
      artworkRetryTimer = null;
      artworkRetryCount += 1;
      if (loading) refreshArtwork();
    }, ARTWORK_RETRY_MS);
  }

  function refreshArtwork() {
    if (artworkFetch) return artworkFetch;
    artworkFetch = fetchArtworkFromCore()
      .then((resolved) => {
        if (resolved) mergeArtwork(resolved);
        if (loading && !hasArtwork()) scheduleArtworkRetry();
        return resolved;
      })
      .finally(() => {
        artworkFetch = null;
      });
    return artworkFetch;
  }

  function clearLoadTimers() {
    if (minTimer) {
      window.clearTimeout(minTimer);
      minTimer = null;
    }
    if (maxTimer) {
      window.clearTimeout(maxTimer);
      maxTimer = null;
    }
    if (artworkRetryTimer) {
      window.clearTimeout(artworkRetryTimer);
      artworkRetryTimer = null;
    }
  }

  function playerRoot() {
    return document.querySelector('[class*="player-container"]');
  }

  function applySeriesBranding() {
    const root = playerRoot();
    if (!root) return;

    const bgUrl = resolveBackgroundUrl();
    if (isUsableImageSrc(bgUrl)) {
      const poster = root.querySelector(
        '[class*="background-layer"] img[class*="image"], [class*="background-layer"] img'
      );
      if (poster) {
        poster.setAttribute('src', bgUrl);
        if (poster.src !== bgUrl) poster.src = bgUrl;
      }
    }

    const logoUrl = resolveLogoUrl();
    if (isUsableImageSrc(logoUrl)) {
      const logos = root.querySelectorAll(
        '[class*="buffering-layer"] img[class*="logo"], [class*="buffering-layer"] img'
      );
      for (const logo of logos) {
        if (isStremioDefaultLogo(logo.getAttribute('src') || logo.src)) {
          logo.setAttribute('src', logoUrl);
          logo.src = logoUrl;
          logo.style.display = '';
          continue;
        }
        logo.setAttribute('src', logoUrl);
        if (logo.src !== logoUrl) logo.src = logoUrl;
        logo.style.display = '';
      }
    }
  }

  let brandRefreshTimer = null;

  function startBrandRefresh() {
    if (brandRefreshTimer) return;
    brandRefreshTimer = window.setInterval(() => {
      if (!loading) {
        stopBrandRefresh();
        return;
      }
      applySeriesBranding();
    }, 280);
  }

  function stopBrandRefresh() {
    if (!brandRefreshTimer) return;
    window.clearInterval(brandRefreshTimer);
    brandRefreshTimer = null;
  }

  function startBrandObserver() {
    if (brandObserver) return;
    const root = playerRoot();
    if (!root) return;
    brandObserver = new MutationObserver(() => {
      if (!loading) return;
      applySeriesBranding();
    });
    brandObserver.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'class'],
    });
    startBrandRefresh();
  }

  function stopBrandObserver() {
    if (!brandObserver) return;
    brandObserver.disconnect();
    brandObserver = null;
    stopBrandRefresh();
  }

  function stopContainerWatch() {
    if (!containerWatch) return;
    containerWatch.disconnect();
    containerWatch = null;
  }

  function watchForPlayerContainer() {
    if (containerWatch || playerRoot()) return;
    containerWatch = new MutationObserver(() => {
      if (!isPlayerRoute() || !loading) {
        stopContainerWatch();
        return;
      }
      if (playerRoot()) {
        stopContainerWatch();
        ensureLoadingPresentation();
      }
    });
    containerWatch.observe(document.body, { childList: true, subtree: true });
  }

  function ensureLoadingPresentation() {
    if (!isPlayerRoute() || !loading) return;
    injectLoaderStyles();
    window.__stremioCustomPlayerTransparencyEnsure?.();
    document.documentElement.classList.remove(PRESENTING_CLASS);
    startBrandObserver();
    applySeriesBranding();
    if (!hasArtwork()) refreshArtwork();
  }

  function resetArtwork() {
    artwork = { background: null, logo: null, imdbId: null };
    artworkRetryCount = 0;
    if (artworkRetryTimer) {
      window.clearTimeout(artworkRetryTimer);
      artworkRetryTimer = null;
    }
  }

  function beginLoading() {
    loading = true;
    loadStartedAt = Date.now();
    mpvTicks = 0;
    lastMpvPosition = -1;
    firstMpvPosition = -1;
    mpvReadySince = 0;
    pendingLoad = false;

    clearLoadTimers();
    window.StremioCustomPlayback?.closeVideoGate?.();

    minTimer = window.setTimeout(tryCompleteLoading, MIN_LOAD_MS);
    maxTimer = window.setTimeout(() => completeLoading('timeout'), MAX_LOAD_MS);

    ensureLoadingPresentation();
    if (!playerRoot()) watchForPlayerContainer();
  }

  function completeLoading(reason) {
    if (!loading && reason !== 'leave') return;
    clearLoadTimers();
    stopBrandObserver();

    const openGate = () => {
      loading = false;
      mpvReadySince = 0;
      window.StremioCustomPlayback?.openVideoGate?.();
      window.setTimeout(() => window.StremioCustomPlayback?.nudgePlayback?.(), 180);
      window.setTimeout(() => window.StremioCustomPlayback?.nudgePlayback?.(), 520);
    };

    if (reason === 'ready') {
      window.setTimeout(openGate, GATE_OPEN_DELAY_MS);
      return;
    }

    openGate();
  }

  function tryCompleteLoading() {
    if (!loading) return;

    const snap = window.StremioCustomPlayback?.getMpvSnapshot?.();
    if (!snap?.hasStream) {
      mpvReadySince = 0;
      return;
    }
    if (snap.buffering) {
      mpvReadySince = 0;
      return;
    }
    if (!snap.timeFresh) {
      mpvReadySince = 0;
      return;
    }
    if (snap.position < MPV_MIN_POSITION) {
      mpvReadySince = 0;
      return;
    }
    if (snap.cacheObserved && snap.cacheAhead < MPV_MIN_CACHE_AHEAD && snap.position < 2.5) {
      mpvReadySince = 0;
      return;
    }
    if (mpvTicks < MPV_TICKS_REQUIRED) {
      mpvReadySince = 0;
      return;
    }
    if (firstMpvPosition >= 0 && snap.position - firstMpvPosition < MPV_MIN_SPAN) {
      mpvReadySince = 0;
      return;
    }

    if (!mpvReadySince) mpvReadySince = Date.now();
    if (Date.now() - mpvReadySince < MPV_SETTLE_MS) return;

    completeLoading('ready');
  }

  function onMpvTime(event) {
    if (!loading) return;
    const pos = Number(event?.detail?.time);
    if (!Number.isFinite(pos)) return;
    if (pos > lastMpvPosition) {
      if (firstMpvPosition < 0 && Date.now() - loadStartedAt >= MIN_LOAD_MS) {
        firstMpvPosition = pos;
      }
      lastMpvPosition = pos;
      mpvTicks += 1;
    }
    if (Date.now() - loadStartedAt >= MIN_LOAD_MS) {
      tryCompleteLoading();
    }
  }

  function onStreamStarted() {
    if (!isPlayerRoute()) {
      pendingLoad = true;
      window.StremioCustomPlayback?.closeVideoGate?.();
      return;
    }
    beginLoading();
  }

  function onPlayerEnter() {
    window.__stremioCustomPlayerTransparencyEnsure?.();

    if (window.StremioCustomPlayback?.isVideoGateOpen?.() && !pendingLoad && !loading) {
      document.documentElement.classList.add(PRESENTING_CLASS);
      return;
    }

    if (pendingLoad || !loading) {
      beginLoading();
      return;
    }

    ensureLoadingPresentation();
    if (!playerRoot()) watchForPlayerContainer();
  }

  function onPlayerLeave() {
    loading = false;
    pendingLoad = false;
    clearLoadTimers();
    stopBrandObserver();
    stopContainerWatch();
    resetArtwork();
    document.documentElement.classList.remove(PRESENTING_CLASS);
    window.StremioCustomPlayback?.closeVideoGate?.();
  }

  function onArtworkHint(event) {
    mergeArtwork(event?.detail);
  }

  window.StremioCustomPlayerSplash = {
    cacheArtwork: mergeArtwork,
  };

  window.__stremioCustomPlayerLoadingEnsure = () => {
    if (isPlayerRoute()) {
      if (!loading && !window.StremioCustomPlayback?.isVideoGateOpen?.()) {
        onPlayerEnter();
      } else {
        applySeriesBranding();
      }
    } else {
      onPlayerLeave();
    }
  };

  window.addEventListener('hashchange', () => {
    if (!isPlayerRoute()) {
      showAppLoadingMask(190, { contentOnly: true });
      onPlayerLeave();
      return;
    }
    onPlayerEnter();
  });

  document.addEventListener('stremio-custom-bootstrap-ready', () => {
    if (isPlayerRoute()) onPlayerEnter();
  });
  document.addEventListener('stremio-custom-stream-started', onStreamStarted);
  document.addEventListener('stremio-custom-mpv-time', onMpvTime);
  document.addEventListener('stremio-custom-player-artwork', onArtworkHint);

  injectLoaderStyles();
  ensureTopSeamFix();
  ensureScrollbarFix();
  showBootLoadingMaskUntilReady();
  if (isPlayerRoute()) onPlayerEnter();

  console.info('[StremioCustom] Native-branded player loader ready.');
})();
