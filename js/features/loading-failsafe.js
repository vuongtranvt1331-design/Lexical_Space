window.__spaceLoaderFailsafe = window.setTimeout(function () {
      var loader = document.getElementById('space-loader');
      if (loader) loader.remove();
    }, 30000);
