// Recovery only: normal startup ends immediately on lexicalspace:ready.
(() => {
  function showStartupProblem(message) {
    if (window.__lexicalSpaceReady) return;
    window.clearTimeout(window.__spaceLoaderFailsafe);
    if (window.SpaceLoader) window.SpaceLoader.finish();
    else { document.getElementById('space-loader')?.remove(); document.body?.removeAttribute('aria-busy'); }
    const status = document.getElementById('login-status');
    if (status) {
      status.hidden = false;
      status.textContent = location.protocol === 'file:'
        ? 'Open LexicalSpace with its local launcher. The browser cannot start it directly from this file.'
        : message;
    }
    const reload = document.getElementById('link-startup-reload');
    if (reload && location.protocol !== 'file:') reload.hidden = false;
  }
  window.__spaceLoaderFailsafe = window.setTimeout(() => {
    showStartupProblem('LexicalSpace is taking longer than expected. Reload the page to try again.');
  }, 8000);
  document.addEventListener('error', event => {
    if (event.target?.id !== 'lexicalspace-app') return;
    showStartupProblem('A required LexicalSpace file could not load. If you use the local launcher, restart it and reload this page.');
  }, true);
})();
