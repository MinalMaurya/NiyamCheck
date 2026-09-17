/**
 * Registers the Service Worker in supporting environments.
 */

export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[NiyamCheck PWA] Service worker registered successfully:', reg.scope);
        })
        .catch((err) => {
          console.warn('[NiyamCheck PWA] Service worker registration failed:', err);
        });
    });
  }
}

export function unregisterServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((err) => {
        console.error(err.message);
      });
  }
}
