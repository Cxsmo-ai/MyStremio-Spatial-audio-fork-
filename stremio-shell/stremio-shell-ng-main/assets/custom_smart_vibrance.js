(function () {
  'use strict';

  if (window.__stremioCustomSmartVibrance) return;
  window.__stremioCustomSmartVibrance = true;

  const BTN_ID = 'mystremio-smart-vibrance-btn';
  const STYLE_ID = 'mystremio-smart-vibrance-styles';
  const STORAGE_KEY = 'mystremio-smart-vibrance-plus-enabled';
  const SHADER_PATH = '~~/shaders/Smart_Vibrance_Plus.glsl';
  const ICON_SIZE = '2.0rem';

  let shellMsgId = 19000;
  let ensureTimer = null;
  let layoutObserver = null;
  let lastApplied = null;

  function isPlayerRoute() {
    return /#\/player/.test(location.hash || '');
  }

  function readEnabled() {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  function writeEnabled(enabled) {
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
    } catch (_) {}
  }

  function sendMpvCommand(args) {
    if (!window.chrome?.webview?.postMessage || !Array.isArray(args) || !args.length) return false;
    try {
      shellMsgId += 1;
      window.chrome.webview.postMessage(
        JSON.stringify({
          id: shellMsgId,
          args: ['mpv-command', args],
        })
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  function applySmartVibrance(enabled) {
    const removed = sendMpvCommand(['change-list', 'glsl-shaders', 'remove', SHADER_PATH]);
    const ok = enabled
      ? sendMpvCommand(['change-list', 'glsl-shaders', 'append', SHADER_PATH])
      : removed;
    if (ok) lastApplied = Boolean(enabled);
    updateButtonState();
    return ok;
  }

  function toggleSmartVibrance() {
    const next = !readEnabled();
    writeEnabled(next);
    applySmartVibrance(next);
  }

  function findRightBarInsertPoint() {
    const controlBar = document.querySelector('[class*="player-container"] [class*="control-bar-container"]');
    if (!controlBar) return null;

    const buttonsContainer = controlBar.querySelector('[class*="control-bar-buttons-container"]');
    if (!buttonsContainer) return null;

    const subtitleButton =
      buttonsContainer.querySelector('[title*="subtitle" i], [aria-label*="subtitle" i]') ||
      buttonsContainer.querySelector('[title*="captions" i], [aria-label*="captions" i]');
    if (subtitleButton?.parentNode) {
      return { parent: subtitleButton.parentNode, before: subtitleButton };
    }

    const menuButton =
      buttonsContainer.querySelector('[title*="more" i], [aria-label*="more" i]') ||
      buttonsContainer.lastElementChild;
    if (menuButton?.parentNode) {
      return { parent: menuButton.parentNode, before: menuButton };
    }

    return { parent: buttonsContainer, before: null };
  }

  function getButtonTemplate() {
    const container = document.querySelector(
      '[class*="player-container"] [class*="control-bar-buttons-container"]'
    );
    if (!container) return null;
    return container.querySelector('[class*="control-bar-button"]:not([class*="menu"])');
  }

  function buildBulbIconSvg(className) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.65');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    if (className) svg.setAttribute('class', className);

    const paths = [
      'M9 18h6',
      'M10 22h4',
      'M8.25 14.75c-1.35-1.18-2.25-2.76-2.25-4.75a6 6 0 1 1 12 0c0 1.99-.9 3.57-2.25 4.75-.75.66-1.25 1.35-1.25 2.25h-5c0-.9-.5-1.59-1.25-2.25Z',
      'M12 2v1.25',
      'M4.9 4.9l.9.9',
      'M19.1 4.9l-.9.9',
    ];
    for (const d of paths) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      svg.appendChild(path);
    }
    return svg;
  }

  function replaceButtonIcon(button) {
    const iconWrap = button.querySelector('[class*="icon"]');
    const refSvg = button.querySelector('svg');
    const svgClass = refSvg?.getAttribute('class') || '';
    const svg = buildBulbIconSvg(svgClass);

    if (iconWrap) {
      iconWrap.replaceChildren(svg);
      return;
    }
    if (refSvg) {
      refSvg.replaceWith(svg);
      return;
    }
    button.appendChild(svg);
  }

  function injectStyles() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }
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
      }
      #${BTN_ID} [class*="button-container"] {
        display: none !important;
      }
      #${BTN_ID} [class*="icon"],
      #${BTN_ID} svg {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: ${ICON_SIZE} !important;
        height: ${ICON_SIZE} !important;
        min-width: ${ICON_SIZE} !important;
        min-height: ${ICON_SIZE} !important;
        margin: 0 !important;
        padding: 0 !important;
        line-height: 0 !important;
      }
      #${BTN_ID} svg {
        flex: none !important;
        fill: none !important;
        stroke: currentColor !important;
        pointer-events: none !important;
      }
      #${BTN_ID}.active {
        color: #ffe68a !important;
        background: rgba(255, 214, 94, 0.16) !important;
        box-shadow: inset 0 0 0 1px rgba(255, 224, 128, 0.16) !important;
      }
    `;
  }

  function isButtonCorrectlyPlaced(button) {
    const insertPoint = findRightBarInsertPoint();
    if (!button || !insertPoint) return true;
    return button.parentNode === insertPoint.parent && button.nextElementSibling === insertPoint.before;
  }

  function placeButton(button, insertPoint) {
    if (!button || !insertPoint) return false;
    if (isButtonCorrectlyPlaced(button)) return true;
    insertPoint.parent.insertBefore(button, insertPoint.before || null);
    return true;
  }

  function updateButtonState() {
    const button = document.getElementById(BTN_ID);
    if (!button) return;
    const enabled = readEnabled();
    button.classList.toggle('active', enabled);
    button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    button.title = enabled ? 'Smart Vibrance Plus: On' : 'Smart Vibrance Plus: Off';
    button.setAttribute('aria-label', button.title);
  }

  function bindButton(button) {
    if (!button || button.dataset.mystremioSmartVibranceBound === '1') return;
    button.dataset.mystremioSmartVibranceBound = '1';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleSmartVibrance();
    });
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
    if (button && (!button.isConnected || !insertPoint.parent.contains(button))) {
      button.remove();
      button = null;
    }

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
      replaceButtonIcon(button);
      placeButton(button, insertPoint);
    } else if (!isButtonCorrectlyPlaced(button)) {
      placeButton(button, insertPoint);
    }

    bindButton(button);
    updateButtonState();
    if (lastApplied !== readEnabled()) applySmartVibrance(readEnabled());
  }

  function scheduleEnsure() {
    if (ensureTimer) window.clearTimeout(ensureTimer);
    ensureTimer = window.setTimeout(() => {
      ensureTimer = null;
      ensureButton();
    }, 150);
  }

  function bindLayoutObserver() {
    if (layoutObserver) return;
    const target = document.querySelector('[class*="player-container"]') || document.documentElement;
    layoutObserver = new MutationObserver(scheduleEnsure);
    layoutObserver.observe(target, { childList: true, subtree: true });
  }

  window.__stremioCustomSmartVibranceEnsure = ensureButton;

  ensureButton();
  bindLayoutObserver();
  window.addEventListener('hashchange', () => {
    lastApplied = null;
    scheduleEnsure();
    window.setTimeout(ensureButton, 700);
  });
  document.addEventListener('stremio-custom-playback-route', scheduleEnsure);
  document.addEventListener('stremio-custom-bootstrap-ready', scheduleEnsure);
  document.addEventListener('stremio-custom-stream-started', () => {
    lastApplied = null;
    window.setTimeout(() => applySmartVibrance(readEnabled()), 150);
    window.setTimeout(ensureButton, 450);
  });

  let ticks = 0;
  const timer = window.setInterval(() => {
    ticks += 1;
    ensureButton();
    if (ticks >= 15) window.clearInterval(timer);
  }, 1000);

  console.info('[StremioCustom] Smart Vibrance Plus module ready.');
})();
