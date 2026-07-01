(function () {
  'use strict';

  if (window.StremioCustomAutoskip?.__nativeReactSettings) return;

  // Phase 2: Autoskip settings are now native React controls.
  window.StremioCustomAutoskip = {
    ...(window.StremioCustomAutoskip || {}),
    __nativeReactSettings: true,
    tryInjectAutoskipSettings: function () {
      return true;
    },
    injectAutoskipOption: function () {
      return true;
    },
    createAutoskipDropdown: function () {
      return null;
    },
    updateAutoskipSummary: function () {},
  };
})();
