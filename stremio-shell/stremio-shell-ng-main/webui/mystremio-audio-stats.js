(function () {
  'use strict';

  if (window.__stremioCustomAudioStats) return;
  window.__stremioCustomAudioStats = true;

  const BTN_ID = 'mystremio-audio-stats-btn';
  const STYLE_ID = 'mystremio-audio-stats-styles';
  const ICON_SIZE = '2.0rem';
  let shellMsgId = 21000;
  let ensureTimer = null;
  let layoutObserver = null;

  function isPlayerRoute() {
    return /#\/player/.test(location.hash || '');
  }

  function sendStatsCommand() {
    if (!window.chrome?.webview?.postMessage) return;
    try {
      shellMsgId++;
      window.chrome.webview.postMessage(JSON.stringify({
        id: shellMsgId,
        args: ['mpv-command', ['script-binding', 'stats/display-stats-toggle']]
      }));
      shellMsgId++;
      window.chrome.webview.postMessage(JSON.stringify({
        id: shellMsgId,
        args: ['mpv-command', ['show-text', 'Decoder: ${ad} | Input: ${audio-codec-name} ${audio-params/channel-count}ch | Mode: ${ad-orender-channel-render-mode}', '5000']]
      }));
    } catch (_) {}
  }

  function findRightBarInsertPoint() {
    const controlBar = document.querySelector('[class*="player-container"] [class*="control-bar-container"]');
    if (!controlBar) return null;
    const buttonsContainer = controlBar.querySelector('[class*="control-bar-buttons-container"]');
    if (!buttonsContainer) return null;
    
    // Insert before the smart-vibrance button if it exists, otherwise before subtitle button
    const vibranceButton = buttonsContainer.querySelector('#mystremio-smart-vibrance-btn');
    if (vibranceButton?.parentNode) {
      return { parent: vibranceButton.parentNode, before: vibranceButton };
    }
    const subtitleButton = buttonsContainer.querySelector('[title*="subtitle" i], [aria-label*="subtitle" i]');
    if (subtitleButton?.parentNode) {
      return { parent: subtitleButton.parentNode, before: subtitleButton };
    }
    return { parent: buttonsContainer, before: null };
  }

  function getButtonTemplate() {
    const container = document.querySelector('[class*="player-container"] [class*="control-bar-buttons-container"]');
    if (!container) return null;
    return container.querySelector('[class*="control-bar-button"]:not([class*="menu"])');
  }

  function buildInfoIconSvg(className) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    if (className) svg.setAttribute('class', className);

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '12');
    circle.setAttribute('r', '10');
    svg.appendChild(circle);
    
    const iPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    iPath.setAttribute('d', 'M12 16v-4 M12 8h.01');
    svg.appendChild(iPath);
    
    return svg;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BTN_ID} {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        margin: 0 !important;
        padding: 0 !important;
        flex: none !important;
        position: relative !important;
        z-index: 2 !important;
        pointer-events: auto !important;
        color: #fff !important;
      }
      #${BTN_ID} [class*="button-container"] { display: none !important; }
      #${BTN_ID} [class*="icon"], #${BTN_ID} svg {
        display: flex !important; align-items: center !important; justify-content: center !important;
        width: ${ICON_SIZE} !important; height: ${ICON_SIZE} !important;
        min-width: ${ICON_SIZE} !important; min-height: ${ICON_SIZE} !important;
        margin: 0 !important; padding: 0 !important; line-height: 0 !important;
      }
      #${BTN_ID} svg {
        flex: none !important; fill: none !important; stroke: currentColor !important; pointer-events: none !important;
      }
      #${BTN_ID}:hover { color: #ffe68a !important; }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function placeButton(button, insertPoint) {
    if (!button || !insertPoint) return;
    if (button.parentNode === insertPoint.parent && button.nextElementSibling === insertPoint.before) return;
    insertPoint.parent.insertBefore(button, insertPoint.before || null);
  }

  function ensureButton() {
    if (!isPlayerRoute()) {
      document.getElementById(BTN_ID)?.remove();
      return;
    }
    injectStyles();
    const insertPoint = findRightBarInsertPoint();
    if (!insertPoint) return;

    let button = document.getElementById(BTN_ID);
    if (!button) {
      const template = getButtonTemplate();
      if (template) {
        button = template.cloneNode(true);
        button.classList.remove('disabled');
        button.removeAttribute('tabindex');
        button.querySelectorAll('[class*="button-container"]').forEach((el) => el.remove());
      } else {
        button = document.createElement('button');
        button.type = 'button';
      }
      button.id = BTN_ID;
      button.title = 'Audio / Omniphony Stats';
      button.setAttribute('aria-label', button.title);
      
      const iconWrap = button.querySelector('[class*="icon"]');
      const refSvg = button.querySelector('svg');
      const svgClass = refSvg?.getAttribute('class') || '';
      const svg = buildInfoIconSvg(svgClass);
      
      if (iconWrap) iconWrap.replaceChildren(svg);
      else if (refSvg) refSvg.replaceWith(svg);
      else button.appendChild(svg);
      
      button.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        sendStatsCommand();
      });
    }
    placeButton(button, insertPoint);
  }

  function scheduleEnsure() {
    if (ensureTimer) window.clearTimeout(ensureTimer);
    ensureTimer = window.setTimeout(() => { ensureTimer = null; ensureButton(); }, 150);
  }

  function bindLayoutObserver() {
    if (layoutObserver) return;
    const target = document.querySelector('[class*="player-container"]') || document.documentElement;
    layoutObserver = new MutationObserver(scheduleEnsure);
    layoutObserver.observe(target, { childList: true, subtree: true });
  }

  ensureButton();
  bindLayoutObserver();
  window.addEventListener('hashchange', () => { scheduleEnsure(); window.setTimeout(ensureButton, 700); });
  document.addEventListener('stremio-custom-playback-route', scheduleEnsure);
  document.addEventListener('stremio-custom-bootstrap-ready', scheduleEnsure);
  document.addEventListener('stremio-custom-stream-started', () => window.setTimeout(ensureButton, 450));
  
  let ticks = 0;
  const timer = window.setInterval(() => {
    ticks++; ensureButton();
    if (ticks >= 15) window.clearInterval(timer);
  }, 1000);
})();
