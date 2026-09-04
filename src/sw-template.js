/* eslint-env serviceworker */
/**
 * Offline shell.
 *
 * The app's data has always been local, but the app itself was not: with no
 * signal, an installed Home-screen icon opened a blank page. This caches the
 * built shell so the app starts from the device.
 *
 * The two placeholders below are substituted at build time with the real
 * hashed filenames, which is why this is a template rather than a plain
 * worker: nothing written by hand can know what Vite is going to call them.
 */

const VERSION = '__VERSION__'
const CACHE = `cadence-${VERSION}`
const PRECACHE = __PRECACHE__

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // One missing file must not fail the whole install, so each is added
      // separately and a failure is tolerated.
      .then((cache) => Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Only ever serve this app's own origin. A link card's favicon, for one,
  // must go to the network and must not be cached here.
  if (url.origin !== self.location.origin) return

  /*
   * Navigations are network-first so a deploy is picked up on the next launch
   * with a signal, and fall back to the cached shell when there is none.
   */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(indexURL(), copy))
          return response
        })
        .catch(() => caches.match(indexURL()).then((cached) => cached ?? offlineResponse())),
    )
    return
  }

  /*
   * Everything else is cache-first: the built assets carry a content hash in
   * their name, so a cached one is never stale.
   */
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        }),
    ),
  )
})

/** The shell's address, whatever subpath the app was deployed to. */
function indexURL() {
  return new URL('./index.html', self.registration.scope).href
}

function offlineResponse() {
  return new Response(
    '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
      '<p style="font:16px system-ui;margin:12vh auto;max-width:28rem;padding:0 1.5rem">' +
      'Cadence has not been opened online yet, so there is nothing stored to open. ' +
      'Connect once and it will work offline afterwards.</p>',
    { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } },
  )
}
