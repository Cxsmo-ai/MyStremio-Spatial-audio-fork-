(function () {
  'use strict';

  if (window.__stremioCustomOpenLocal) return;
  window.__stremioCustomOpenLocal = true;

  let ensureTimer = null;
  let layoutObserver = null;
  const BTN_ID = 'mystremio-open-local-btn';

  function injectOpenLocalButton() {
    // Find the left menu by looking for the Discover or Board link
    const discoverLink = document.querySelector('a[href="#/discover"], a[href="#/board"]');
    if (!discoverLink) return;

    const menuContainer = discoverLink.parentNode;
    if (document.getElementById(BTN_ID)) return; // Already exists

    // Clone the discover link to inherit native styling
    const newBtn = discoverLink.cloneNode(true);
    newBtn.id = BTN_ID;
    newBtn.href = 'javascript:void(0)';
    newBtn.classList.remove('active');

    // Change text label
    const textElements = newBtn.querySelectorAll('div, span');
    for (const el of textElements) {
      if (el.textContent && (el.textContent.includes('Discover') || el.textContent.includes('Board'))) {
        el.textContent = 'Open File';
        break;
      }
    }

    // Change SVG icon to a Folder
    const svg = newBtn.querySelector('svg');
    if (svg) {
      svg.innerHTML = '<path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" fill="currentColor"/>';
    }

    // Create a native file input that overlays the entire button (bulletproof)
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'video/*,audio/*,.mkv,.mp4,.avi,.m2ts';
    fileInput.style.position = 'absolute';
    fileInput.style.top = '0';
    fileInput.style.left = '0';
    fileInput.style.width = '100%';
    fileInput.style.height = '100%';
    fileInput.style.opacity = '0';
    fileInput.style.cursor = 'pointer';
    fileInput.style.zIndex = '10';

    newBtn.style.position = 'relative';
    newBtn.style.overflow = 'hidden';

    fileInput.addEventListener('change', (e) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      try {
        // 1. Force Stremio to open the Player and initialize MPV using a dummy HTTP stream
        const dummyStream = {
          url: "http://127.0.0.1:11470/ping", // Fake URL to force MPV initialization
          name: "Omniphony Local",
          title: files[0].name
        };
        // Navigate the Stremio React Router to the dummy stream
        window.location.hash = '#/player/movie/local/local?stream=' + encodeURIComponent(JSON.stringify(dummyStream));

        // 2. Wait for MPV to boot up, then hijack it with the actual local file!
        setTimeout(() => {
          const msgId = Math.floor(Math.random() * 100000);
          
          // Command MPV to drop the dummy URL and load the real local file
          window.chrome.webview.postMessage(JSON.stringify({
            id: msgId,
            args: ['mpv-command', ['loadfile', files[0].path]]
          }));
          
          // Hide Stremio's React UI (the buffering screen) so the MPV video is fully visible
          const appDiv = document.getElementById('app');
          if (appDiv) {
            appDiv.style.transition = 'opacity 0.4s ease';
            appDiv.style.opacity = '0';
            appDiv.style.pointerEvents = 'none'; // Allows mouse clicks to pass through to MPV!
          }
          
          // Create a 'Close Local Movie' button overlay
          let closeBtn = document.getElementById('mystremio-close-local-btn');
          if (!closeBtn) {
            closeBtn = document.createElement('button');
            closeBtn.id = 'mystremio-close-local-btn';
            closeBtn.innerText = 'Stop Local Movie';
            closeBtn.style.position = 'fixed';
            closeBtn.style.top = '25px';
            closeBtn.style.right = '25px';
            closeBtn.style.zIndex = '999999';
            closeBtn.style.padding = '12px 24px';
            closeBtn.style.background = 'rgba(0, 0, 0, 0.8)';
            closeBtn.style.color = '#fff';
            closeBtn.style.border = '2px solid rgba(255,255,255,0.3)';
            closeBtn.style.borderRadius = '8px';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.fontSize = '16px';
            closeBtn.style.fontWeight = 'bold';
            closeBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
            
            closeBtn.addEventListener('click', () => {
              // Stop MPV playback
              window.chrome.webview.postMessage(JSON.stringify({
                id: msgId + 1,
                args: ['mpv-command', ['stop']]
              }));
              
              // Restore Stremio UI
              if (appDiv) {
                appDiv.style.opacity = '1';
                appDiv.style.pointerEvents = 'auto';
              }
              // Navigate back to board to clear the player state
              window.location.hash = '#/board';
              closeBtn.style.display = 'none';
            });
            
            closeBtn.addEventListener('mouseenter', () => closeBtn.style.background = 'rgba(40,40,40,0.9)');
            closeBtn.addEventListener('mouseleave', () => closeBtn.style.background = 'rgba(0,0,0,0.8)');
            
            document.body.appendChild(closeBtn);
          }
          closeBtn.style.display = 'block';
        }, 1200); // Wait 1.2s for Stremio to mount the player

      } catch (err) {
        console.error('[StremioCustom] Failed to launch local stream via MPV hijack', err);
      }

      // Reset the input so the same file can be opened again
      fileInput.value = '';
    });

    newBtn.appendChild(fileInput);

    // Append to the bottom of the menu
    menuContainer.appendChild(newBtn);
  }

  function scheduleEnsure() {
    if (ensureTimer) window.clearTimeout(ensureTimer);
    ensureTimer = window.setTimeout(() => { ensureTimer = null; injectOpenLocalButton(); }, 500);
  }

  function bindLayoutObserver() {
    if (layoutObserver) return;
    layoutObserver = new MutationObserver(scheduleEnsure);
    layoutObserver.observe(document.body, { childList: true, subtree: true });
  }

  scheduleEnsure();
  bindLayoutObserver();
  window.addEventListener('hashchange', scheduleEnsure);
})();
