import { useEffect, useState } from 'react'
import { imageURL } from './assets.ts'

/**
 * The displayable URL for a stored picture.
 *
 * Reading from IndexedDB is asynchronous, so a block renders its reserved space
 * first and the picture arrives a frame or two later. `undefined` while loading,
 * `null` once it is known to be missing.
 */
export function useAssetURL(assetId: string | undefined): string | undefined | null {
  const [url, setURL] = useState<string | undefined | null>(assetId ? undefined : null)

  useEffect(() => {
    if (!assetId) {
      setURL(null)
      return
    }
    let live = true
    setURL(undefined)
    imageURL(assetId).then((found) => {
      if (live) setURL(found ?? null)
    })
    return () => void (live = false)
  }, [assetId])

  return url
}
