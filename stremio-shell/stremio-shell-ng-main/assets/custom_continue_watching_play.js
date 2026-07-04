(function () {
  'use strict';

  if (window.__StremioContinueWatchingPlay) return;
  window.__StremioContinueWatchingPlay = true;

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

  function extractPlayerHash(item) {
    if (!item) return null;
    const links = item.deepLinks || item.deep_links || {};
    return deepLinkToHash(links.player || links.Player);
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
      for (const model of ['continue_watching_preview', 'continue_watching']) {
        const state = await getCoreState(model);
        const items = state?.items || state?.catalog?.content?.content || [];
        if (!Array.isArray(items) || !items[index]) continue;
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

  async function resolvePlayerHash(container) {
    const index = getCardIndex(container);
    if (index < 0) return null;

    for (const model of ['continue_watching_preview', 'continue_watching']) {
      const state = await getCoreState(model);
      const items = state?.items || state?.catalog?.content?.content || [];
      if (!Array.isArray(items) || !items[index]) continue;
      const hash = extractPlayerHash(items[index]);
      if (hash) return hash;
    }

    return null;
  }

  function navigateToPlayer(hash) {
    if (!hash || window.location.hash === hash) return;
    window.location.hash = hash;
  }

  async function ensurePlayerNavigation(container) {
    const hash = await resolvePlayerHash(container);
    if (hash) {
      navigateToPlayer(hash);
      return true;
    }

    console.warn('[ContinueWatchingPlay] No player deep link for card index', getCardIndex(container));
    return false;
  }

  document.addEventListener(
    'click',
    (event) => {
      const playLayer = findPlayLayer(event.target);
      const dismissLayer = findDismissLayer(event.target);
      if (!playLayer && !dismissLayer) return;
      markSelectPrevented(event);

      if (!playLayer) return;
      const container = playLayer.closest('[class*="meta-item-container"]');
      if (!container) return;
      prefetchSplashArtworkSync(container);
    },
    true
  );

  document.addEventListener(
    'click',
    (event) => {
      const playLayer = findPlayLayer(event.target);
      if (!playLayer) return;

      const container = playLayer.closest('[class*="meta-item-container"]');
      if (!container) return;

      void prefetchSplashArtworkAsync(container);

      const hashBefore = window.location.hash;
      window.setTimeout(async () => {
        if (/#\/player\//i.test(window.location.hash) && window.location.hash !== hashBefore) {
          return;
        }
        await ensurePlayerNavigation(container);
      }, 0);
    },
    false
  );

  console.log('[ContinueWatchingPlay] Ready');
})();
