(function () {
  'use strict';

  /**
   * Continue Watching board helper.
   *
   * Play icon: LibItem.onPlayClick navigates via React Router to deepLinks.player.
   * The card wrapper also opens metaDetails on click — we set selectPrevented on
   * play clicks so that detail navigation is skipped, without replacing Stremio's
   * native player route (no raw location.hash unless fallback is needed).
   */

  if (window.__StremioContinueWatchingPlay) return;
  window.__StremioContinueWatchingPlay = true;

  const SESSION_HINT_KEY = 'stremio-cw-playback-hint';

  function inContinueWatchingContext(element) {
    if (!element) return false;
    if (element.closest('[class*="continue-watching-row"], [class*="continue-watching"]')) {
      return true;
    }
    return /#\/continuewatching(?:\/|$|\?|#)/i.test(window.location.hash || '');
  }

  function findPlayLayer(target) {
    if (!(target instanceof Element)) return null;
    const playLayer = target.closest('[class*="play-icon-layer"]');
    if (!playLayer || !inContinueWatchingContext(playLayer)) return null;
    return playLayer;
  }

  function findDismissLayer(target) {
    if (!(target instanceof Element)) return null;
    const dismissLayer = target.closest('[class*="dismiss-icon-layer"]');
    if (!dismissLayer || !inContinueWatchingContext(dismissLayer)) return null;
    return dismissLayer;
  }

  function markSelectPrevented(event) {
    event.selectPrevented = true;
    if (event.nativeEvent) {
      event.nativeEvent.selectPrevented = true;
    }
  }

  function getCardIndex(root) {
    const list = root.closest('[class*="meta-items-container"]');
    if (!list) return -1;

    const card = root.closest('[class*="meta-item"]');
    if (card && list.contains(card)) {
      const cards = Array.from(list.querySelectorAll(':scope > [class*="meta-item"]'));
      const index = cards.indexOf(card);
      if (index >= 0) return index;
    }

    const container = root.closest('[class*="meta-item-container"]');
    if (container) {
      const containers = Array.from(list.querySelectorAll('[class*="meta-item-container"]'));
      return containers.indexOf(container);
    }

    return -1;
  }

  function deepLinkToHash(link) {
    if (!link || typeof link !== 'string') return null;
    if (link.startsWith('#/')) return link;
    if (link.startsWith('stremio:///')) return `#/${link.slice('stremio:///'.length)}`;
    if (link.startsWith('/')) return `#${link}`;
    return null;
  }

  function extractImdbId(value) {
    if (!value || typeof value !== 'string') return null;
    const match = value.match(/tt\d{7,8}/i);
    return match ? match[0] : null;
  }

  function metahubArtwork(imdbId) {
    if (!imdbId) return null;
    return {
      id: imdbId,
      background: `https://images.metahub.space/background/large/${imdbId}/img`,
      logo: `https://images.metahub.space/logo/medium/${imdbId}/img`,
    };
  }

  async function getCoreState(model) {
    try {
      if (window.services?.core?.transport?.getState) {
        return await window.services.core.transport.getState(model);
      }
    } catch {
      // Try fallback API.
    }

    try {
      if (window.core?.getState) {
        return await window.core.getState(model);
      }
    } catch {
      // Unavailable.
    }

    return null;
  }

  function itemsFromCoreState(state) {
    if (!state) return [];
    if (Array.isArray(state.items) && state.items.length) return state.items;
    if (Array.isArray(state.catalog) && state.catalog.length) return state.catalog;
    const nested = state.catalog?.content?.content;
    if (Array.isArray(nested) && nested.length) return nested;
    return [];
  }

  function readStyleWidthRatio(element) {
    if (!element) return null;
    const inline = element.getAttribute('style') || '';
    const inlineMatch = inline.match(/width:\s*([\d.]+)%/);
    if (inlineMatch) {
      const ratio = Number(inlineMatch[1]) / 100;
      if (Number.isFinite(ratio) && ratio > 0.004 && ratio < 0.996) return ratio;
    }
    try {
      const computed = window.getComputedStyle(element);
      const width = parseFloat(computed.width);
      const parent = element.parentElement;
      const parentWidth = parent ? parseFloat(window.getComputedStyle(parent).width) : NaN;
      if (Number.isFinite(width) && Number.isFinite(parentWidth) && parentWidth > 0) {
        const ratio = width / parentWidth;
        if (Number.isFinite(ratio) && ratio > 0.004 && ratio < 0.996) return ratio;
      }
    } catch (_) {}
    return null;
  }

  function readProgressFromCardDom(container) {
    if (!container) return null;
    const progressLayer = container.querySelector('[class*="progress-bar-layer"]');
    const trackBefore =
      progressLayer?.querySelector('[class*="track-before"]') ||
      container.querySelector('[class*="progress-bar-layer"] [class*="track-before"]');
    const ratio = readStyleWidthRatio(trackBefore);
    return ratio != null ? ratio : null;
  }

  function persistPlaybackHint(hint) {
    if (!hint || !Number.isFinite(hint.duration) || hint.duration <= 0) return;
    try {
      sessionStorage.setItem(
        SESSION_HINT_KEY,
        JSON.stringify({
          duration: hint.duration,
          progress: hint.progress,
          watched: hint.watched,
          at: Date.now(),
        })
      );
    } catch (_) {}
  }

  function extractPlaybackHint(item) {
    if (!item || typeof item !== 'object') return null;
    const content = item.content && typeof item.content === 'object' ? item.content : item;
    const state = item.state || item.libraryItem?.state || content.state || {};
    const progress = Number(state.progress ?? item.progress ?? content.progress);
    const watched = Number(
      state.time ?? state.watched ?? item.watched ?? content.watched ?? content.time
    );
    const runtime = Number(
      content.runtime ??
        content.duration ??
        item.runtime ??
        item.duration ??
        state.duration ??
        state.runtime
    );

    let duration = null;
    if (Number.isFinite(runtime) && runtime > 0) {
      duration = runtime;
    } else if (
      Number.isFinite(progress) &&
      progress > 0.01 &&
      progress < 0.995 &&
      Number.isFinite(watched) &&
      watched > 0
    ) {
      duration = watched / progress;
    }

    if (!Number.isFinite(duration) || duration <= 0) return null;
    return { duration, progress, watched };
  }

  function emitPlaybackHint(hint) {
    if (!hint || !Number.isFinite(hint.duration) || hint.duration <= 0) return;
    window.__stremioPlaybackDurationHint = hint.duration;
    if (Number.isFinite(hint.progress) && hint.progress > 0) {
      window.__stremioPlaybackProgressHint = hint.progress;
    }
    persistPlaybackHint(hint);
    document.dispatchEvent(
      new CustomEvent('stremio-custom-duration-hint', {
        detail: hint,
      })
    );
    document.dispatchEvent(
      new CustomEvent('stremio-custom-duration', {
        detail: { duration: hint.duration, source: 'continue-watching' },
      })
    );
  }

  function hintFromCardDom(container) {
    const progress = readProgressFromCardDom(container);
    if (progress == null) return null;
    return { progress, watched: null, duration: null };
  }

  function mergeCardDomHint(hint, container) {
    const domProgress = readProgressFromCardDom(container);
    if (domProgress == null) return hint;
    if (!hint) return { progress: domProgress, watched: null, duration: null };
    return { ...hint, progress: hint.progress ?? domProgress };
  }

  async function prefetchPlaybackHint(container) {
    const index = getCardIndex(container);
    if (index < 0) return null;

    for (const model of ['continue_watching', 'continue_watching_preview']) {
      const state = await getCoreState(model);
      const items = itemsFromCoreState(state);
      if (!items[index]) continue;
      const hint = mergeCardDomHint(extractPlaybackHint(items[index]), container);
      if (hint?.duration) {
        emitPlaybackHint(hint);
        return hint;
      }
    }
    const domOnly = hintFromCardDom(container);
    if (domOnly?.progress) {
      window.__stremioPlaybackProgressHint = domOnly.progress;
    }
    return null;
  }

  async function resolvePlayerHash(container) {
    const index = getCardIndex(container);
    if (index < 0) return null;

    for (const model of ['continue_watching', 'continue_watching_preview']) {
      const state = await getCoreState(model);
      const items = itemsFromCoreState(state);
      if (!items[index]) continue;
      const links = items[index].deepLinks || items[index].deep_links || {};
      const hash = deepLinkToHash(links.player || links.Player);
      if (hash) return hash;
    }

    return null;
  }

  function schedulePlayerFallback(container, startHash) {
    window.setTimeout(async () => {
      if (/#\/player/.test(location.hash || '')) return;
      if ((location.hash || '') !== (startHash || '')) return;
      const hash = await resolvePlayerHash(container);
      if (!hash || location.hash === hash) return;
      location.hash = hash;
    }, 60);
  }

  function extractArtworkFromItem(item) {
    if (!item || typeof item !== 'object') return null;
    const content = item.content && typeof item.content === 'object' ? item.content : item;
    const idHint = item.id || content.id || null;
    const imdbId = extractImdbId(String(idHint || ''));

    if (imdbId) return metahubArtwork(imdbId);

    let background = content.background || item.background || null;
    let logo = content.logo || item.logo || null;
    if (!background && !logo) return null;
    return { id: idHint, background, logo };
  }

  function artworkFromCardDom(container) {
    if (!container) return null;

    const posterImg = container.querySelector('img[class*="poster-image"]');
    const cardLink = container.querySelector('a[href*="imdb"], a[href*="tt"]');
    const imdbId =
      posterImg?.dataset?.imdbId ||
      extractImdbId(posterImg?.getAttribute('src') || posterImg?.src || '') ||
      extractImdbId(cardLink?.getAttribute('href') || '') ||
      extractImdbId(container.getAttribute('data-id') || '');

    if (imdbId) return metahubArtwork(imdbId);

    const logoImg = container.querySelector('.enhanced-logo-overlay, img[class*="logo"]');
    const logoSrc = logoImg?.getAttribute('src') || logoImg?.src || '';
    if (logoSrc && /images\.metahub\.space\/logo\//.test(logoSrc)) {
      return { background: null, logo: logoSrc };
    }

    return null;
  }

  function emitArtworkHint(artwork) {
    if (!artwork || (!artwork.background && !artwork.logo)) return;
    window.StremioCustomPlayerSplash?.cacheArtwork?.(artwork);
    document.dispatchEvent(new CustomEvent('stremio-custom-player-artwork', { detail: artwork }));
  }

  function prefetchSplashArtworkSync(container) {
    const artwork = artworkFromCardDom(container);
    if (artwork) emitArtworkHint(artwork);
    return artwork;
  }

  async function prefetchSplashArtworkAsync(container) {
    const index = getCardIndex(container);
    let artwork = null;

    if (index >= 0) {
      for (const model of ['continue_watching', 'continue_watching_preview']) {
        const state = await getCoreState(model);
        const items = itemsFromCoreState(state);
        if (!items[index]) continue;
        const fromItem = extractArtworkFromItem(items[index]);
        if (fromItem) {
          artwork = fromItem;
          break;
        }
      }
    }

    if (!artwork) artwork = artworkFromCardDom(container);
    if (artwork) emitArtworkHint(artwork);
  }

  function prefetchForPlay(container) {
    if (!container) return;
    prefetchSplashArtworkSync(container);
    const domProgress = readProgressFromCardDom(container);
    if (domProgress != null) {
      window.__stremioPlaybackProgressHint = domProgress;
    }
    void prefetchSplashArtworkAsync(container);
    void prefetchPlaybackHint(container);
  }

  document.addEventListener(
    'click',
    (event) => {
      const playLayer = findPlayLayer(event.target);
      const dismissLayer = findDismissLayer(event.target);

      if (playLayer) {
        markSelectPrevented(event);
        const container = playLayer.closest('[class*="meta-item-container"]');
        if (container) {
          const startHash = location.hash || '';
          prefetchForPlay(container);
          schedulePlayerFallback(container, startHash);
        }
        return;
      }

      if (dismissLayer) {
        markSelectPrevented(event);
      }
    },
    true
  );

  document.addEventListener(
    'pointerdown',
    (event) => {
      const playLayer = findPlayLayer(event.target);
      if (!playLayer) return;
      const container = playLayer.closest('[class*="meta-item-container"]');
      if (container) prefetchForPlay(container);
    },
    true
  );

  document.addEventListener(
    'mouseenter',
    (event) => {
      const playLayer = findPlayLayer(event.target);
      if (!playLayer) return;
      const container = playLayer.closest('[class*="meta-item-container"]');
      if (container) {
        prefetchSplashArtworkSync(container);
        void prefetchPlaybackHint(container);
      }
    },
    true
  );

  console.log('[ContinueWatchingPlay] Ready (play → player via Stremio, detail click blocked on play icon).');
})();
