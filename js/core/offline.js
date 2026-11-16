if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost','127.0.0.1'].includes(location.hostname))) {
  navigator.serviceWorker.register(window.SpaceSuite ? new URL('service-worker.js', window.SpaceSuite.base).href : './service-worker.js').catch(error => console.warn('Offline cache unavailable:', error));
}
