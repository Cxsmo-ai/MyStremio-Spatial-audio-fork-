(function () {
  'use strict';

  if (window.StremioCustomFavoriteLanguagesPage) return;

  // Favorite language settings are rendered natively in React.
  function buildFavoriteLanguagesPageScript() {
    return '(function(){})();';
  }

  window.StremioCustomFavoriteLanguagesPage = { buildFavoriteLanguagesPageScript };
})();
