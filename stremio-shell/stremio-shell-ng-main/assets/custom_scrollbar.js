(function () {
  'use strict';

  if (window.__stremioCustomScrollbar) return;
  window.__stremioCustomScrollbar = true;

  const STYLE_ID = 'stremio-custom-scrollbar-style';
  const TRACK_ID = 'stremio-custom-scrollbar-track';
  const THUMB_ID = 'stremio-custom-scrollbar-thumb';
  const HOST_CLASS = 'stremio-custom-scroll-host';

  const TRACK_WIDTH = 14;
  const THUMB_WIDTH = 5;
  const MIN_THUMB = 40;

  let activeScrollEl = null;
  let dragState = null;
  let rafId = 0;
  let trackEngaged = false;

  function setTrackEngaged(value) {
    trackEngaged = value;
    const track = document.getElementById(TRACK_ID);
    if (track) track.classList.toggle('engaged', value);
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${HOST_CLASS} {
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
      }
      .${HOST_CLASS}::-webkit-scrollbar {
        width: 0 !important;
        height: 0 !important;
        display: none !important;
      }

      #${TRACK_ID} {
        position: fixed;
        top: 0;
        right: 0;
        width: ${TRACK_WIDTH}px;
        z-index: 120;
        pointer-events: auto;
        opacity: 1;
        visibility: visible;
        background: rgba(255, 255, 255, 0.035);
        transition: background 180ms ease;
      }

      #${TRACK_ID}.hidden {
        display: none !important;
      }

      #${TRACK_ID}:hover {
        background: rgba(255, 255, 255, 0.055);
      }

      #${TRACK_ID}.engaged {
        background: rgba(255, 255, 255, 0.07);
      }

      #${THUMB_ID} {
        position: absolute;
        top: 0;
        left: 50%;
        width: ${THUMB_WIDTH}px;
        transform: translateX(-50%);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.14);
        opacity: 0.55;
        cursor: grab;
        min-height: ${MIN_THUMB}px;
        transition:
          background 180ms ease,
          opacity 180ms ease,
          width 180ms ease;
      }

      #${TRACK_ID}:hover #${THUMB_ID},
      #${THUMB_ID}:hover {
        background: rgba(255, 255, 255, 0.3);
        opacity: 0.82;
      }

      #${TRACK_ID}.engaged #${THUMB_ID},
      #${THUMB_ID}.dragging {
        width: ${THUMB_WIDTH + 1}px;
        background: rgba(255, 255, 255, 0.62);
        opacity: 1;
        cursor: grabbing;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function getScrollEl() {
    const board = document.querySelector('[class*="board-container"]');
    if (board) {
      const candidates = board.querySelectorAll('[class*="board-content"]');
      for (const el of candidates) {
        const overflowY = window.getComputedStyle(el).overflowY;
        if (overflowY === 'auto' || overflowY === 'scroll') {
          return el;
        }
      }
    }

    const selectors = [
      '[class*="discover-content"] [class*="catalog-container"]',
      '[class*="library-content"]',
      '[class*="addons-list-container"]',
      '[class*="calendar-content"] [class*="content"]',
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) continue;
      const overflowY = window.getComputedStyle(el).overflowY;
      if (overflowY === 'auto' || overflowY === 'scroll') {
        return el;
      }
    }

    return null;
  }

  function ensureTrack() {
    injectStyles();
    let track = document.getElementById(TRACK_ID);
    if (!track) {
      track = document.createElement('div');
      track.id = TRACK_ID;
      const thumb = document.createElement('div');
      thumb.id = THUMB_ID;
      track.appendChild(thumb);
      document.body.appendChild(track);

      thumb.addEventListener('mousedown', (event) => {
        if (!activeScrollEl) return;
        event.preventDefault();
        setTrackEngaged(true);
        dragState = {
          startY: event.clientY,
          startScrollTop: activeScrollEl.scrollTop,
          trackHeight: track.clientHeight,
          thumbHeight: thumb.clientHeight,
          maxScroll: activeScrollEl.scrollHeight - activeScrollEl.clientHeight,
        };
        thumb.classList.add('dragging');
      });

      track.addEventListener('mousedown', (event) => {
        if (!activeScrollEl) return;
        setTrackEngaged(true);
        if (event.target.id === THUMB_ID) return;
        const thumb = document.getElementById(THUMB_ID);
        if (!thumb) return;
        const trackRect = track.getBoundingClientRect();
        const thumbRect = thumb.getBoundingClientRect();
        const clickY = event.clientY;
        const page = activeScrollEl.clientHeight * 0.85;
        if (clickY < thumbRect.top) {
          activeScrollEl.scrollTop -= page;
        } else if (clickY > thumbRect.bottom) {
          activeScrollEl.scrollTop += page;
        } else {
          const offset = clickY - trackRect.top - thumb.clientHeight / 2;
          const maxThumbTravel = track.clientHeight - thumb.clientHeight;
          const ratio = maxThumbTravel > 0 ? offset / maxThumbTravel : 0;
          activeScrollEl.scrollTop = ratio * (activeScrollEl.scrollHeight - activeScrollEl.clientHeight);
        }
        syncThumb();
      });
    }
    return track;
  }

  function syncTrackGeometry() {
    const track = document.getElementById(TRACK_ID);
    if (!track || !activeScrollEl) return;

    const rect = activeScrollEl.getBoundingClientRect();
    const navSize = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--horizontal-nav-bar-size')
    ) || 88;

    track.style.top = `${Math.max(rect.top, navSize)}px`;
    track.style.height = `${Math.max(0, rect.bottom - Math.max(rect.top, navSize))}px`;
    track.style.right = '0px';
    track.style.width = `${TRACK_WIDTH}px`;
  }

  function syncThumb() {
    const track = document.getElementById(TRACK_ID);
    const thumb = document.getElementById(THUMB_ID);
    if (!track || !thumb || !activeScrollEl) return;

    const scrollable = activeScrollEl.scrollHeight - activeScrollEl.clientHeight;
    if (scrollable <= 0) {
      track.classList.add('hidden');
      return;
    }

    track.classList.remove('hidden');
    syncTrackGeometry();

    const trackHeight = track.clientHeight;
    const ratio = activeScrollEl.clientHeight / activeScrollEl.scrollHeight;
    const thumbHeight = Math.max(MIN_THUMB, Math.round(trackHeight * ratio));
    const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
    const thumbTop = (activeScrollEl.scrollTop / scrollable) * maxThumbTop;

    thumb.style.height = `${thumbHeight}px`;
    thumb.style.top = `${thumbTop}px`;
  }

  function detachHost(el) {
    if (!el) return;
    el.classList.remove(HOST_CLASS);
    el.removeEventListener('scroll', onScroll);
  }

  function onScroll() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(syncThumb);
  }

  function bindScrollEl(el) {
    if (activeScrollEl === el) {
      syncThumb();
      return;
    }

    detachHost(activeScrollEl);
    activeScrollEl = el;

    if (!el) {
      const track = document.getElementById(TRACK_ID);
      if (track) track.classList.add('hidden');
      return;
    }

    el.classList.add(HOST_CLASS);
    el.addEventListener('scroll', onScroll, { passive: true });
    ensureTrack();
    syncThumb();
  }

  function refresh() {
    const el = getScrollEl();
    bindScrollEl(el);
  }

  function onMouseMove(event) {
    if (!dragState || !activeScrollEl) return;
    const deltaY = event.clientY - dragState.startY;
    const maxThumbTravel = dragState.trackHeight - dragState.thumbHeight;
    if (maxThumbTravel <= 0 || dragState.maxScroll <= 0) return;
    const scrollDelta = (deltaY / maxThumbTravel) * dragState.maxScroll;
    activeScrollEl.scrollTop = dragState.startScrollTop + scrollDelta;
    syncThumb();
  }

  function onMouseUp() {
    const thumb = document.getElementById(THUMB_ID);
    if (thumb) thumb.classList.remove('dragging');
    dragState = null;
    setTrackEngaged(false);
  }

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('resize', refresh);
  window.addEventListener('hashchange', () => setTimeout(refresh, 60));
  document.addEventListener('stremio-custom-bootstrap-ready', () => setTimeout(refresh, 120));
  document.addEventListener('stremio-custom-hero-layout-changed', () => setTimeout(refresh, 60));

  const observer = new MutationObserver(() => {
    if (window.__stremioCustomScrollbarTimer) return;
    window.__stremioCustomScrollbarTimer = setTimeout(() => {
      window.__stremioCustomScrollbarTimer = null;
      refresh();
    }, 120);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.__stremioCustomScrollbarEnsure = refresh;

  injectStyles();
  refresh();
  setInterval(refresh, 1500);

  console.info('[StremioCustom] Persistent content scrollbar ready.');
})();
