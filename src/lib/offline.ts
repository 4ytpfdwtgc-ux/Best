/**
 * Register the offline shell.
 *
 * Only in a built app: in development the worker would serve a stale bundle
 * and make every change look like it had not taken. The scope is derived from
 * the page's own directory so a Pages subpath works without configuration.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    const url = new URL('sw.js', document.baseURI).href
    navigator.serviceWorker.register(url, { scope: './' }).catch(() => {
      // A refused registration (private mode, an insecure origin) costs only
      // offline support; the app still works.
    })
  })
}

/**
 * Ask the browser to keep this site's storage.
 *
 * Everything is held locally, and Safari evicts the storage of a site left
 * unopened for about a week. An installed app is usually granted this without
 * a prompt; a tab is usually refused, which is not an error worth reporting.
 */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
