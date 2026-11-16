/**
 * Legacy module retained for old cached references.
 * assets/space-loader.js now owns loading choreography and initialization.
 * It starts independently of application imports so app failures cannot trap
 * the visitor behind the overlay. This adapter never starts a second loader.
 */
export function initLoadingScreen() {
  const overlay = document.querySelector('[data-space-loader]');
  return overlay ? window.SpaceLoader?.mount(overlay) : undefined;
}
