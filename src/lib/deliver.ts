/**
 * Hand a generated file to the operating system.
 *
 * On iOS the share sheet is the useful route: it offers Calendar directly, so
 * a .ics goes straight into "Add to Calendar" instead of landing in Downloads.
 * Everywhere else, and whenever sharing is unavailable or declined, fall back
 * to an ordinary download.
 */
export async function shareOrDownload(
  filename: string,
  contents: string,
  mimeType = 'text/calendar;charset=utf-8',
): Promise<'shared' | 'downloaded'> {
  const blob = new Blob([contents], { type: mimeType })

  if (typeof File === 'function' && navigator.share && navigator.canShare) {
    const file = new File([blob], filename, { type: blob.type })
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] })
        return 'shared'
      } catch (error) {
        // A cancelled share is a choice, not a failure — don't then force a
        // download the user just declined.
        if (error instanceof DOMException && error.name === 'AbortError') return 'shared'
      }
    }
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
  // Revoke on the next turn of the event loop, once the download has started.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}
