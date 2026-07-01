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

  // Stremio MetaItem uses nativeEvent.selectPrevented to skip card navigation.
  document.addEventListener(
    'click',
    (event) => {
      if (!findPlayLayer(event.target) && !findDismissLayer(event.target)) return;
      markSelectPrevented(event);
    },
    true
  );

  // Let React handle play first; fall back if we still did not reach the player route.
  document.addEventListener(
    'click',
    (event) => {
      const playLayer = findPlayLayer(event.target);
      if (!playLayer) return;

      const container = playLayer.closest('[class*="meta-item-container"]');
      if (!container) return;

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
