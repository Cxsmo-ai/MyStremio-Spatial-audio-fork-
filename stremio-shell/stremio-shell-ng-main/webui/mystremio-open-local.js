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

      // Simulate a drag-and-drop event to trick Stremio into playing the local file
      try {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(files[0]);

        const dropEvent = new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer: dataTransfer
        });
        
        // Dispatch to document, which bubbles to window where Stremio's drop listener lives
        document.dispatchEvent(dropEvent);
      } catch (err) {
        console.error('[StremioCustom] Failed to dispatch drop event', err);
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
