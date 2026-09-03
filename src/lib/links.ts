/**
 * Link cards.
 *
 * iOS builds its cards from the page's own Open Graph tags, which it can read
 * because it fetches the page itself. This app is static — there is no server
 * to fetch through, and a browser is refused by CORS on very nearly every site
 * it would want to read. So a card is built from what the address itself gives
 * away: the site, a readable title, and the site's own favicon, which loads as
 * an ordinary image and so is not subject to CORS. The title stays editable,
 * because a guess from a URL is only ever a starting point.
 */

/** Only these ever reach an href. `javascript:` in a link is an XSS hole. */
const SAFE_PROTOCOLS = ['http:', 'https:']

/**
 * Turn what someone typed or pasted into a URL, or return null.
 * A bare `example.com/x` is assumed to be https, the way a browser bar does.
 */
export function normalizeURL(raw: string): string | null {
  const text = raw.trim()
  if (!text || /\s/.test(text)) return null

  let parsed: URL
  try {
    parsed = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`)
  } catch {
    return null
  }

  if (!SAFE_PROTOCOLS.includes(parsed.protocol)) return null
  // A host with no dot is a intranet name or a typo, not something to link to.
  if (!parsed.hostname.includes('.') || parsed.hostname.endsWith('.')) return null
  return parsed.href
}

/** True when the whole string is one address — what paste-detection needs. */
export function isURL(text: string): boolean {
  return normalizeURL(text) !== null
}

/** The site, without the `www.` nobody reads. */
export function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * A readable title from the address alone: the last meaningful path segment,
 * de-slugged, or the site itself when the path says nothing.
 */
export function linkTitleFromURL(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
  }

  const segments = parsed.pathname.split('/').filter(Boolean)
  const last = segments[segments.length - 1] ?? ''
  // Trailing ids and file extensions are noise in a title.
  const slug = last.replace(/\.\w{1,5}$/, '').replace(/^\d{4,}[-_]?/, '')

  if (!slug || /^\d+$/.test(slug)) return linkHost(parsed.href)
  const words = slug.replace(/[-_+]+/g, ' ').replace(/%[0-9a-f]{2}/gi, ' ').trim()
  if (!words) return linkHost(parsed.href)
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * The site's own icon. Requested straight from the site rather than through an
 * icon service, so no third party is told which links are saved here.
 */
export function faviconURL(url: string): string | null {
  try {
    const parsed = new URL(url)
    return `${parsed.origin}/favicon.ico`
  } catch {
    return null
  }
}

const MONOGRAM_TINTS = ['blue', 'green', 'orange', 'purple', 'pink', 'red', 'brown', 'yellow'] as const

/** A stable colour per site, for the monogram shown when there is no favicon. */
export function monogramTint(url: string): (typeof MONOGRAM_TINTS)[number] {
  const host = linkHost(url)
  let hash = 0
  for (let i = 0; i < host.length; i++) hash = (hash * 31 + host.charCodeAt(i)) >>> 0
  return MONOGRAM_TINTS[hash % MONOGRAM_TINTS.length]
}
