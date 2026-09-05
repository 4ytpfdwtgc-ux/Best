import { useEffect, useRef, useState } from 'react'
import type { Block } from '../../types'
import { useAssetURL } from '../../lib/useAssetURL'
import { Icon } from '../ui/Icon'

/**
 * The container the browser will record into.
 *
 * Safari records MPEG-4 and nothing else; Chrome and Firefox record WebM. The
 * first supported one wins, so an iPhone produces a file it -- and everything
 * else Apple makes -- can play back.
 */
const CONTAINERS: { mime: string; ext: string }[] = [
  { mime: 'audio/mp4', ext: 'm4a' },
  { mime: 'audio/webm;codecs=opus', ext: 'webm' },
  { mime: 'audio/webm', ext: 'webm' },
  { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
]

function pickContainer(): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === 'undefined') return null
  for (const c of CONTAINERS) {
    if (!MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(c.mime)) return c
  }
  return null
}

/**
 * A voice memo: the recorder before there is one, the player after.
 *
 * The recording itself goes to the asset store like a picture does, so it
 * never touches the saved state, travels in a backup, and is swept when the
 * block that held it is gone.
 */
export function AudioBlock({
  block,
  autoStart,
  busy,
  error,
  onRecorded,
  onRetry,
}: {
  block: Block
  /** Chosen from the attach menu, so the recording starts without a second tap. */
  autoStart?: boolean
  busy: boolean
  error?: string
  onRecorded: (file: File, seconds: number) => void
  onRetry: () => void
}) {
  const url = useAssetURL(block.assetId)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [failure, setFailure] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const startedRef = useRef(false)

  /** Let go of the microphone: the browser shows it as in use until we do. */
  const release = () => {
    const recorder = recorderRef.current
    recorderRef.current = null
    recorder?.stream.getTracks().forEach((track) => track.stop())
  }

  useEffect(() => () => release(), [])

  useEffect(() => {
    if (!recording) return
    const started = Date.now()
    const timer = window.setInterval(() => setSeconds((Date.now() - started) / 1000), 200)
    return () => window.clearInterval(timer)
  }, [recording])

  async function start() {
    if (recorderRef.current) return
    setFailure(null)
    const container = pickContainer()
    if (!navigator.mediaDevices?.getUserMedia || !container) {
      setFailure('This browser cannot record audio.')
      return
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      // Denied, dismissed, or no microphone: all of them look the same here.
      setFailure('No microphone. Allow access in Settings, then try again.')
      return
    }

    const recorder = new MediaRecorder(stream, { mimeType: container.mime })
    recorderRef.current = recorder
    const chunks: Blob[] = []
    const startedAt = Date.now()

    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    recorder.onstop = () => {
      const length = (Date.now() - startedAt) / 1000
      release()
      setRecording(false)
      setSeconds(0)
      if (!chunks.length) return
      const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const file = new File([new Blob(chunks, { type: container.mime })], `Voice memo ${stamp}.${container.ext}`, {
        type: container.mime,
      })
      onRecorded(file, length)
    }

    recorder.start()
    setSeconds(0)
    setRecording(true)
  }

  function stop() {
    recorderRef.current?.stop()
  }

  useEffect(() => {
    if (!autoStart || startedRef.current || block.assetId) return
    startedRef.current = true
    void start()
    // Only ever once, on the block the attach menu just made.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, block.assetId])

  if (block.assetId) {
    return (
      <div className="audio" contentEditable={false}>
        <span className="audio__icon"><Icon name="music" size={16} /></span>
        {url ? (
          <audio className="audio__player" src={url} controls preload="metadata" />
        ) : (
          <span className="audio__missing">Loading…</span>
        )}
      </div>
    )
  }

  const message = failure ?? error

  return (
    <div className={`audio audio--empty${recording ? ' is-recording' : ''}`} contentEditable={false}>
      {recording ? (
        <>
          <span className="audio__pulse" aria-hidden="true" />
          <span className="audio__len audio__len--live">{clock(seconds)}</span>
          <button type="button" className="btn btn--danger" onClick={stop}>
            Stop
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="audio__record"
            onClick={() => {
              if (message) onRetry()
              void start()
            }}
            disabled={busy}
          >
            <span className="audio__dot" aria-hidden="true" />
            {busy ? 'Saving…' : message ? 'Try again' : 'Record'}
          </button>
          {message && <span className="audio__error">{message}</span>}
        </>
      )}
    </div>
  )
}

/** m:ss, which is how long a voice memo is ever worth showing. */
function clock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}
