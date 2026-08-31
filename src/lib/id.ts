/** Short, collision-resistant ids. Uses `crypto.randomUUID` when available. */
export function uid(prefix = ''): string {
  const c = globalThis.crypto as Crypto | undefined
  const raw =
    c && 'randomUUID' in c
      ? c.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
  return prefix ? `${prefix}_${raw}` : raw
}
