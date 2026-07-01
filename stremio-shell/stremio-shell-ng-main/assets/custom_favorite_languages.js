(function () {
  'use strict';

  if (window.StremioCustomFavoriteLanguages) return;

  // Phase 2: Favorite language controls are now native React settings.
  function noop() {}

  window.StremioCustomFavoriteLanguages = {
    KEYS: {
  FAV_AUDIO: 'stremio-custom-fav-audio',
  ACTIVE_AUDIO: 'stremio-custom-active-audio',
  FAV_SUBS: 'stremio-custom-fav-subs',
  ACTIVE_SUBS: 'stremio-custom-active-subs',
    },
    removePlayerLanguageBars: noop,
    injectFavoriteHeartsRuntime: noop,
    injectPlayerLanguageSettings: () => true,
    tryInjectPlayerLanguageSettings: noop,
    isLanguageUiComplete: () => true,
};
})();
