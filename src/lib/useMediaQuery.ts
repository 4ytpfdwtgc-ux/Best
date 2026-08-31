import { useSyncExternalStore } from 'react'

/** Subscribe a component to a CSS media query. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Phone-width layout: a single column, bottom tab bar, sheets instead of panes. */
export const PHONE_QUERY = '(max-width: 700px)'

export function useIsPhone(): boolean {
  return useMediaQuery(PHONE_QUERY)
}
