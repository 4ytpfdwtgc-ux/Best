import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getState, useApp } from '../../state/store'
import type { Block, BlockType, NoteFont, Note, TintName } from '../../types'
import {
  emptyBlock, hiddenBlockIds, LIST_TYPES, matchShortcut,
} from '../../lib/blocks'
import {
  focusBlock, getCaretOffset, isCaretAtEnd, isCaretAtStart, selectBlockRange, selectionRange,
} from '../../lib/caret'
import { AssetError, putFile, putImage } from '../../lib/assets'
import { linkTitleFromURL, normalizeURL } from '../../lib/links'
import { DRAG_SLOP, suppressSelection } from '../../lib/gestures'
import { hasMark, MARKERS, toggleMark, type MarkName } from '../../lib/inline'
import { addNote, noteTitle, setBlocks, setSelectedNote, updateNote } from '../../state/actions'
import { backlinksTo, findNoteByTitle } from '../../state/selectors'
import { Icon, isIconName } from '../ui/Icon'
import { IconPicker } from '../ui/IconPicker'
import { BlockRow } from './BlockRow'
import { FormatBar } from './FormatBar'
import type { AttachAction } from './AttachMenu'
import { SlashMenu } from './SlashMenu'
import { BlockMenu } from './BlockMenu'

/** ⌘B and friends. Shift is spelled out so ⌘⇧H can differ from ⌘H. */
const SHORTCUT_MARKS: Record<string, MarkName | undefined> = {
  b: 'bold',
  i: 'italic',
  u: 'underline',
  e: 'code',
  'shift+x': 'strike',
  'shift+h': 'highlight',
}

interface DragState {
  id: string
  overIndex: number
  after: boolean
}

/** The page body: a title, an optional icon, and a list of blocks. */
export function BlockEditor({ note }: { note: Note }) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [slash, setSlash] = useState<{ blockId: string; start: number; top: number; left: number } | null>(null)
  const [menu, setMenu] = useState<{ blockId: string; top: number; left: number } | null>(null)
  const [iconAnchor, setIconAnchor] = useState<DOMRect | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  // Pictures are read, shrunk and stored off the main thread of the edit, so a
  // block has to be able to say it is working and that it failed.
  const [busyBlocks, setBusyBlocks] = useState<ReadonlySet<string>>(new Set())
  const [imageErrors, setImageErrors] = useState<Record<string, string>>({})
  const [dropping, setDropping] = useState(false)
  /**
   * What is selected right now, so the format bar can light up the marks the
   * words already carry. Kept from `selectionchange` rather than from React's
   * events, which never fire for a drag across text or a double-click.
   */
  const [range, setRange] = useState<{ blockId: string; start: number; end: number } | null>(null)
  // The pointer handlers read the live value here; `drag` only drives rendering.
  const dragRef = useRef<DragState | null>(null)
  const blocksRef = useRef(note.blocks)
  blocksRef.current = note.blocks

  const hidden = useMemo(() => hiddenBlockIds(note.blocks), [note.blocks])

  useEffect(() => {
    const read = () => {
      const node = window.getSelection()?.anchorNode ?? null
      const host = (node instanceof HTMLElement ? node : node?.parentElement)?.closest<HTMLElement>(
        '.blk__text',
      )
      const blockId = host?.closest<HTMLElement>('[data-block-id]')?.dataset.blockId
      const at = host && blockId ? selectionRange(host) : null
      setRange((current) => {
        if (!at || !blockId) return current === null ? current : null
        if (current && current.blockId === blockId && current.start === at.start && current.end === at.end) {
          return current
        }
        return { blockId, start: at.start, end: at.end }
      })
    }
    document.addEventListener('selectionchange', read)
    return () => document.removeEventListener('selectionchange', read)
  }, [])

  const commit = useCallback(
    (next: Block[]) => {
      blocksRef.current = next
      setBlocks(note.id, next)
    },
    [note.id],
  )

  const patchBlock = useCallback(
    (id: string, patch: Partial<Block>) =>
      commit(blocksRef.current.map((b) => (b.id === id ? { ...b, ...patch } : b))),
    [commit],
  )

  /* ---------------------------------------------------------------- */
  /* Formatting                                                        */
  /* ---------------------------------------------------------------- */

  /**
   * The block the format bar is about.
   *
   * Not simply the focused one: the bar's own buttons refuse the pointer so
   * focus never leaves the text, but a tap on the page's blank space does move
   * it, and the bar should not blink out of existence for that. It goes when
   * focus lands somewhere else entirely, or on Escape.
   */
  const [barId, setBarId] = useState<string | null>(null)
  /** The block the attach menu just made, so its recorder starts by itself. */
  const [recordingId, setRecordingId] = useState<string | null>(null)
  /** Shown after Scan Text, which is a thing iOS does and the page cannot. */
  const [hint, setHint] = useState<string | null>(null)
  const pickerRef = useRef<HTMLInputElement>(null)
  const pickModeRef = useRef<'auto' | 'image' | 'file'>('auto')
  const barBlock = note.blocks.find((b) => b.id === barId) ?? null

  useEffect(() => setBarId(null), [note.id])

  useEffect(() => {
    const onFocusOut = (e: FocusEvent) => {
      const to = e.relatedTarget as HTMLElement | null
      if (!to || to.closest('.page') || to.closest('.fmt')) return
      setBarId(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBarId(null)
    }
    document.addEventListener('focusout', onFocusOut)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  /** Which marks the selection already carries, for the bar's pressed states. */
  const marks = useMemo(() => {
    const on = new Set<MarkName>()
    if (!barBlock || range?.blockId !== barBlock.id) return on
    for (const [name, marker] of Object.entries(MARKERS)) {
      if (hasMark(barBlock.text, range.start, range.end, marker)) on.add(name as MarkName)
    }
    return on
  }, [barBlock, range])

  /** Mark the selection, and keep it, so bold and then italic reach the same words. */
  function applyMark(name: MarkName) {
    if (!barBlock || range?.blockId !== barBlock.id || range.start === range.end) return
    const result = toggleMark(barBlock.text, range.start, range.end, MARKERS[name])
    patchBlock(barBlock.id, { text: result.text })
    selectBlockRange(barBlock.id, result.start, result.end)
    setRange({ blockId: barBlock.id, start: result.start, end: result.end })
  }

  /**
   * Change a block's type, keeping what still applies.
   *
   * Its colour and background survive -- they belong to the writing rather
   * than to the shape of it -- but a checkbox, a fold or a table's grid are
   * the new type's to seed.
   */
  const turnInto = useCallback(
    (block: Block, type: BlockType) => {
      const fresh = emptyBlock(type, block.indent)
      commit(
        blocksRef.current.map((b) =>
          b.id === block.id
            ? {
                ...b,
                type,
                checked: fresh.checked,
                collapsed: fresh.collapsed,
                tint: type === 'callout' ? (b.tint ?? fresh.tint) : b.tint,
                icon: type === 'callout' ? (b.icon ?? fresh.icon) : undefined,
                rows: fresh.rows,
              }
            : b,
        ),
      )
    },
    [commit],
  )

  /** Indent one level, within the same rule the Tab key follows. */
  function indentBy(delta: 1 | -1) {
    if (!barBlock) return
    const blocks = blocksRef.current
    const index = blocks.findIndex((b) => b.id === barBlock.id)
    const previous = blocks[index - 1]
    if (delta === -1) {
      if (barBlock.indent > 0) patchBlock(barBlock.id, { indent: barBlock.indent - 1 })
    } else if (previous && barBlock.indent <= previous.indent) {
      patchBlock(barBlock.id, { indent: barBlock.indent + 1 })
    }
    focusBlock(barBlock.id, range?.end ?? 'end')
  }

  /* ---------------------------------------------------------------- */
  /* Attaching                                                         */
  /* ---------------------------------------------------------------- */

  /**
   * One file input, reconfigured per action.
   *
   * `capture` is what turns a picker into the camera on a phone, and it has to
   * be absent rather than false for the library to be offered at all -- so the
   * attributes are set on the element instead of rendered.
   */
  function pick(accept: string, mode: 'auto' | 'image' | 'file', opts: { camera?: boolean; multiple?: boolean } = {}) {
    const el = pickerRef.current
    if (!el) return
    el.accept = accept
    el.multiple = opts.multiple ?? true
    if (opts.camera) el.setAttribute('capture', 'environment')
    else el.removeAttribute('capture')
    pickModeRef.current = mode
    // Cleared, or choosing the same photo twice in a row fires nothing.
    el.value = ''
    el.click()
  }

  /** Put a fresh block after the one being edited, and hand it back. */
  function appendBlock(type: BlockType = 'text'): Block {
    const blocks = blocksRef.current
    const anchor = blocks.find((b) => b.id === barId) ?? blocks[blocks.length - 1]
    const fresh = emptyBlock(type, anchor?.indent ?? 0)
    const next = [...blocks]
    next.splice(anchor ? next.findIndex((b) => b.id === anchor.id) + 1 : next.length, 0, fresh)
    commit(next)
    return fresh
  }

  function runAttach(action: AttachAction) {
    setHint(null)
    switch (action) {
      case 'photos':
        return pick('image/*', 'image')
      case 'camera':
        return pick('image/*', 'image', { camera: true, multiple: false })
      case 'scan':
        // iOS keeps its own document scanner to itself, so this is the camera,
        // one page at a time, with the shrink and the storage already in place.
        return pick('image/*', 'image', { camera: true })
      case 'scanText': {
        /*
         * There is no OCR in a browser worth shipping. iOS has an excellent
         * one built into every text field, so the page makes somewhere for the
         * words to land and says how to fetch them.
         */
        const fresh = appendBlock('text')
        focusBlock(fresh.id)
        setHint("Touch and hold in the new line, then choose Scan Text.")
        window.setTimeout(() => setHint(null), 9000)
        return
      }
      case 'audio': {
        const fresh = appendBlock('audio')
        setRecordingId(fresh.id)
        return
      }
      case 'file':
        return pick('*/*', 'file')
      case 'table':
      case 'link': {
        const fresh = appendBlock(action)
        focusBlock(fresh.id)
        return
      }
    }
  }

  /** A finished recording is stored exactly as a file attachment is. */
  async function saveRecording(block: Block, file: File, seconds: number) {
    setRecordingId(null)
    setBusy(block.id, true)
    clearImageError(block.id)
    try {
      const stored = await putFile(file)
      patchBlock(block.id, {
        assetId: stored.id,
        duration: Math.round(seconds),
        text: block.text || (stored.name ?? file.name).replace(/\.[a-z0-9]+$/i, ''),
      })
    } catch (error) {
      setImageErrors((c) => ({
        ...c,
        [block.id]: error instanceof AssetError ? error.message : 'That recording could not be saved.',
      }))
    } finally {
      setBusy(block.id, false)
    }
  }

  /* ---------------------------------------------------------------- */
  /* Typing                                                            */
  /* ---------------------------------------------------------------- */

  function onChange(block: Block, text: string) {
    // A markdown prefix converts the block instead of staying as text.
    const shortcut = matchShortcut(text)
    if (shortcut && block.type !== 'code') {
      const converted: Partial<Block> =
        shortcut === 'divider'
          ? { type: 'divider', text: '' }
          : { type: shortcut, text: '', ...(shortcut === 'todo' ? { checked: false } : {}) }
      patchBlock(block.id, converted)
      if (shortcut === 'divider') {
        const fresh = emptyBlock('text', block.indent)
        const next = [...blocksRef.current]
        next.splice(next.findIndex((b) => b.id === block.id) + 1, 0, fresh)
        commit(next)
        focusBlock(fresh.id)
      } else {
        focusBlock(block.id, 0)
      }
      return
    }

    patchBlock(block.id, { text })

    if (slash?.blockId === block.id) {
      // A space right after the slash means they meant a slash, not a command.
      const after = text.slice(slash.start + 1)
      if (text[slash.start] !== '/' || after.startsWith(' ')) setSlash(null)
    }
  }

  function insertAfter(block: Block, type: BlockType = 'text'): Block {
    const fresh = emptyBlock(type, block.indent)
    const next = [...blocksRef.current]
    next.splice(next.findIndex((b) => b.id === block.id) + 1, 0, fresh)
    commit(next)
    focusBlock(fresh.id)
    return fresh
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>, el: HTMLElement, block: Block, index: number) {
    const blocks = blocksRef.current
    const meta = e.metaKey || e.ctrlKey

    const shortcut = meta ? SHORTCUT_MARKS[`${e.shiftKey ? 'shift+' : ''}${e.key.toLowerCase()}`] : undefined
    if (shortcut) {
      e.preventDefault()
      const at = selectionRange(el)
      if (!at || at.start === at.end) return
      const result = toggleMark(block.text, at.start, at.end, MARKERS[shortcut])
      patchBlock(block.id, { text: result.text })
      selectBlockRange(block.id, result.start, result.end)
      return
    }

    if (e.key === '/' && !slash) {
      const rect = caretRect(el)
      setSlash({ blockId: block.id, start: getCaretOffset(el), top: rect.bottom + 6, left: rect.left })
      return
    }

    if (e.key === 'Escape') {
      setSlash(null)
      return
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (slash) return

      // Enter on an empty list item lifts it out of the list, as Notion does.
      if (LIST_TYPES.includes(block.type) && !block.text) {
        if (block.indent > 0) patchBlock(block.id, { indent: block.indent - 1 })
        else patchBlock(block.id, { type: 'text' })
        return
      }

      const offset = getCaretOffset(el)
      const before = block.text.slice(0, offset)
      const after = block.text.slice(offset)
      const carryType = LIST_TYPES.includes(block.type) && block.type !== 'toggle' ? block.type : 'text'
      const fresh: Block = { ...emptyBlock(carryType, block.indent), text: after }
      const next = [...blocks]
      next[index] = { ...block, text: before }
      next.splice(index + 1, 0, fresh)
      commit(next)
      focusBlock(fresh.id, 0)
      return
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      const previous = blocks[index - 1]
      if (e.shiftKey) {
        if (block.indent > 0) patchBlock(block.id, { indent: block.indent - 1 })
      } else if (previous && block.indent <= previous.indent) {
        patchBlock(block.id, { indent: block.indent + 1 })
      }
      focusBlock(block.id, getCaretOffset(el))
      return
    }

    if (e.key === 'Backspace' && isCaretAtStart(el)) {
      if (block.indent > 0) {
        e.preventDefault()
        patchBlock(block.id, { indent: block.indent - 1 })
        focusBlock(block.id, 0)
        return
      }
      if (block.type !== 'text') {
        e.preventDefault()
        patchBlock(block.id, { type: 'text', checked: undefined, icon: undefined })
        focusBlock(block.id, 0)
        return
      }
      const previous = blocks[index - 1]
      if (!previous) return
      e.preventDefault()
      if (previous.type === 'divider') {
        commit(blocks.filter((b) => b.id !== previous.id))
        focusBlock(block.id, 0)
        return
      }
      const offset = previous.text.length
      const next = blocks
        .map((b) => (b.id === previous.id ? { ...b, text: previous.text + block.text } : b))
        .filter((b) => b.id !== block.id)
      commit(next)
      focusBlock(previous.id, offset)
      return
    }

    if (e.key === 'ArrowUp' && isCaretAtStart(el)) {
      const previous = visible[visible.findIndex((b) => b.id === block.id) - 1]
      if (previous) {
        e.preventDefault()
        focusBlock(previous.id)
      }
      return
    }

    if (e.key === 'ArrowDown' && isCaretAtEnd(el)) {
      const next = visible[visible.findIndex((b) => b.id === block.id) + 1]
      if (next) {
        e.preventDefault()
        focusBlock(next.id, 0)
      }
    }
  }

  /** Replace the slash command with the chosen block type. */
  function pickBlockType(type: BlockType) {
    if (!slash) return
    const block = blocksRef.current.find((b) => b.id === slash.blockId)
    if (!block) return setSlash(null)

    const text = block.text.slice(0, slash.start) + block.text.slice(slash.start).replace(/^\/[^\s]*/, '')
    setSlash(null)

    if (type === 'divider') {
      const next = [...blocksRef.current]
      const index = next.findIndex((b) => b.id === block.id)
      next[index] = { ...block, type: 'divider', text: '' }
      const fresh = emptyBlock('text', block.indent)
      next.splice(index + 1, 0, fresh)
      commit(next)
      focusBlock(fresh.id)
      return
    }

    const fresh = emptyBlock(type, block.indent)
    patchBlock(block.id, {
      type,
      text,
      checked: fresh.checked,
      collapsed: fresh.collapsed,
      tint: fresh.tint,
      icon: fresh.icon,
      // Whatever else the type seeds — a table's starting grid, say.
      rows: fresh.rows,
    })
    focusBlock(block.id, slash.start)
  }

  /* ---------------------------------------------------------------- */
  /* Drag to reorder                                                   */
  /* ---------------------------------------------------------------- */

  function startDrag(e: React.PointerEvent, block: Block) {
    e.preventDefault()
    const origin = { x: e.clientX, y: e.clientY }
    let moved = false
    const release = suppressSelection()

    const onMove = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) < DRAG_SLOP) return
      moved = true
      const target = document
        .elementFromPoint(ev.clientX, ev.clientY)
        ?.closest<HTMLElement>('[data-block-index]')
      if (!target) return
      const rect = target.getBoundingClientRect()
      dragRef.current = {
        id: block.id,
        overIndex: Number(target.dataset.blockIndex),
        after: ev.clientY > rect.top + rect.height / 2,
      }
      setDrag(dragRef.current)
    }

    const onUp = () => {
      release()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      const current = dragRef.current
      dragRef.current = null
      setDrag(null)
      if (moved && current) applyDrop(block.id, current)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  /* ---------------------------------------------------------------- */
  /* Pictures                                                          */
  /* ---------------------------------------------------------------- */

  const setBusy = useCallback((id: string, busy: boolean) => {
    setBusyBlocks((current) => {
      if (current.has(id) === busy) return current
      const next = new Set(current)
      if (busy) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const clearImageError = useCallback(
    (id: string) =>
      setImageErrors((current) => {
        if (!(id in current)) return current
        const next = { ...current }
        delete next[id]
        return next
      }),
    [],
  )

  /**
   * Put pictures into the page. The first fills `target` and the rest become
   * their own blocks after it, so picking several photos at once reads as one
   * action rather than needing a slash command each.
   *
   * A replaced picture's bytes are not deleted here: a duplicated block shares
   * the key, so only a sweep that can see the whole page list may reclaim them.
   */
  /**
   * Put files into the page.
   *
   * The mode is the caller's, not the block's: a picture block's own picker
   * only takes pictures, a file block's takes anything, and a drop or a paste
   * decides per file — so one drop of a photo and a PDF makes a picture and an
   * attachment rather than two of whichever the first one was.
   */
  async function addAttachments(target: Block, files: File[], mode: 'auto' | 'image' | 'file') {
    const usable = mode === 'image' ? files.filter((f) => f.type.startsWith('image/')) : files
    if (!usable.length) {
      setImageErrors((c) => ({ ...c, [target.id]: 'That file is not a picture.' }))
      return
    }

    clearImageError(target.id)
    setBusy(target.id, true)
    let anchorId = target.id

    try {
      for (const [i, file] of usable.entries()) {
        const asPicture = mode === 'image' || (mode === 'auto' && file.type.startsWith('image/'))
        const stored = asPicture ? await putImage(file) : await putFile(file)
        const patch: Partial<Block> = asPicture
          ? {
              type: 'image',
              assetId: stored.id,
              imageWidth: stored.width,
              imageHeight: stored.height,
            }
          : { type: 'file', assetId: stored.id, text: stored.name ?? file.name }
        if (i === 0) {
          patchBlock(target.id, patch)
        } else {
          const fresh = { ...emptyBlock(patch.type ?? 'image', target.indent), ...patch }
          const next = [...blocksRef.current]
          next.splice(next.findIndex((b) => b.id === anchorId) + 1, 0, fresh)
          commit(next)
          anchorId = fresh.id
        }
      }
    } catch (error) {
      setImageErrors((c) => ({
        ...c,
        [target.id]: error instanceof AssetError ? error.message : 'That picture could not be added.',
      }))
    } finally {
      setBusy(target.id, false)
    }
  }

  /** Files pasted or dropped on a block: they go after it, not over its text. */
  function pasteFiles(block: Block, files: File[], mode: 'auto' | 'image' | 'file' = 'auto') {
    // An empty block has nothing worth keeping, so the first file lands in it.
    if (!block.text && block.type === 'text') return void addAttachments(block, files, mode)
    // A plain block to start from; each file then decides what it becomes.
    const fresh = emptyBlock('text', block.indent)
    const next = [...blocksRef.current]
    next.splice(next.findIndex((b) => b.id === block.id) + 1, 0, fresh)
    commit(next)
    void addAttachments(fresh, files, mode)
  }

  /* ---------------------------------------------------------------- */
  /* Links                                                             */
  /* ---------------------------------------------------------------- */

  /** Give a card its destination, and a title to start from. */
  function setLinkURL(block: Block, url: string) {
    patchBlock(block.id, {
      type: 'link',
      url,
      text: block.text || linkTitleFromURL(url),
    })
  }

  /**
   * An address pasted into an empty block becomes a card. Pasted into writing
   * it stays writing, so a URL can still be quoted mid-sentence.
   */
  function pasteURL(block: Block, pasted: string): boolean {
    if (block.text || (block.type !== 'text' && block.type !== 'link')) return false
    const url = normalizeURL(pasted)
    if (!url) return false
    setLinkURL(block, url)
    // The caret belongs in the title, which is the one thing worth editing.
    focusBlock(block.id)
    return true
  }

  /**
   * Follow a link written in the text.
   *
   * A `[[Page]]` that names nothing yet creates that page, rather than being a
   * dead end — writing the link is usually how a page comes to exist.
   */
  function followLink({ href, wiki }: { href?: string; wiki?: string }) {
    if (href) {
      window.open(href, '_blank', 'noopener,noreferrer')
      return
    }
    if (!wiki) return
    const existing = findNoteByTitle(getState(), wiki)
    if (existing) return setSelectedNote(existing.id)
    const created = addNote(note.folderId)
    updateNote(created.id, { title: wiki.trim() })
    setSelectedNote(created.id)
  }

  /** Files dropped on the page land after whichever block they were dropped on. */
  function dropPictures(e: React.DragEvent) {
    const files = [...e.dataTransfer.files]
    setDropping(false)
    if (!files.length) return
    e.preventDefault()

    const over = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-block-id]')
    const blocks = blocksRef.current
    const onto = blocks.find((b) => b.id === over?.dataset.blockId) ?? blocks[blocks.length - 1]
    if (!onto) return
    pasteFiles(onto, files)
  }

  function applyDrop(id: string, state: DragState) {
    const blocks = blocksRef.current
    const from = blocks.findIndex((b) => b.id === id)
    if (from === -1) return

    // A block carries whatever is nested under it.
    let end = from + 1
    while (end < blocks.length && blocks[end].indent > blocks[from].indent) end++
    const moving = blocks.slice(from, end)
    if (state.overIndex >= from && state.overIndex < end) return

    const rest = [...blocks.slice(0, from), ...blocks.slice(end)]
    const anchor = blocks[state.overIndex]
    const target = rest.findIndex((b) => b.id === anchor?.id)
    const at = target === -1 ? rest.length : target + (state.after ? 1 : 0)
    rest.splice(at, 0, ...moving)
    commit(rest)
  }

  const visible = note.blocks.filter((b) => !hidden.has(b.id))
  const menuBlock = menu ? note.blocks.find((b) => b.id === menu.blockId) : null

  return (
    <div
      className={`page note-font--${note.font ?? 'system'}`}
      style={{ '--note-scale': note.fontScale ?? 1 } as React.CSSProperties}
    >
      <div className="page__header">
        <button
          type="button"
          className="page__icon"
          onClick={(e) => setIconAnchor(e.currentTarget.getBoundingClientRect())}
          aria-label="Change page icon"
        >
          {isIconName(note.icon ?? 'note')
            ? <Icon name={note.icon ?? 'note'} size={38} strokeWidth={1.3} />
            : note.icon}
        </button>
        <input
          className="page__title"
          value={note.title}
          placeholder="Untitled"
          aria-label="Page title"
          onChange={(e) => updateNote(note.id, { title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || (e.key === 'ArrowDown' && note.blocks[0])) {
              e.preventDefault()
              focusBlock(note.blocks[0].id, 0)
            }
          }}
        />
      </div>

      <div
        className={`page__blocks${dropping ? ' is-dropping' : ''}`}
        onDragOver={(e) => {
          if (![...e.dataTransfer.types].includes('Files')) return
          e.preventDefault()
          setDropping(true)
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false)
        }}
        onDrop={dropPictures}
      >
        {visible.map((block) => {
          const index = note.blocks.findIndex((b) => b.id === block.id)
          const showLine = drag && drag.overIndex === index && drag.id !== block.id
          return (
            <div key={block.id} className="blk__slot">
              {showLine && !drag!.after && <div className="blk__dropline" />}
              <BlockRow
                block={block}
                index={index}
                blocks={note.blocks}
                active={activeId === block.id}
                dragging={drag?.id === block.id}
                onChange={(text) => onChange(block, text)}
                onKeyDown={(e, el) => onKeyDown(e, el, block, index)}
                onFocus={() => {
                  setActiveId(block.id)
                  setBarId(block.id)
                }}
                // Focus moving to another block sets its id straight after.
                onBlur={() => setActiveId((current) => (current === block.id ? null : current))}
                onToggleCheck={() => patchBlock(block.id, { checked: !block.checked })}
                onToggleCollapse={() => patchBlock(block.id, { collapsed: !block.collapsed })}
                onInsertAfter={() => insertAfter(block)}
                onOpenMenu={(rect) => setMenu({ blockId: block.id, top: rect.bottom + 6, left: rect.left })}
                onDragStart={(e) => startDrag(e, block)}
                onPickImage={(files) =>
                  void addAttachments(block, files, block.type === 'file' ? 'file' : 'image')
                }
                onClearImageError={() => clearImageError(block.id)}
                onPasteImages={(files) => pasteFiles(block, files)}
                recordNow={recordingId === block.id}
                onRecorded={(file, seconds) => void saveRecording(block, file, seconds)}
                onPasteURL={(pasted) => pasteURL(block, pasted)}
                onSetURL={(url) => setLinkURL(block, url)}
                onSetRows={(rows) => patchBlock(block.id, { rows })}
                onFollowLink={followLink}
                imageBusy={busyBlocks.has(block.id)}
                imageError={imageErrors[block.id]}
              />
              {showLine && drag!.after && <div className="blk__dropline" />}
            </div>
          )
        })}

        <button
          type="button"
          className="page__tail"
          onClick={() => {
            const last = note.blocks[note.blocks.length - 1]
            if (last && !last.text && last.type === 'text') focusBlock(last.id)
            else if (last) insertAfter(last)
          }}
          aria-label="Add a block"
        >
          Click here to continue writing…
        </button>
      </div>

      {barBlock && (
        <FormatBar
          note={note}
          block={barBlock}
          marks={marks}
          onMark={applyMark}
          onStyle={(type) => {
            turnInto(barBlock, type)
            focusBlock(barBlock.id, range?.end ?? 'end')
          }}
          onIndent={indentBy}
          onColor={(color) => patchBlock(barBlock.id, { color })}
          onBackground={(tint) => patchBlock(barBlock.id, { tint })}
          onFont={(font: NoteFont) => updateNote(note.id, { font })}
          onScale={(fontScale) => updateNote(note.id, { fontScale })}
          onAttach={runAttach}
        />
      )}

      {hint && <p className="page__hint" role="status">{hint}</p>}

      <input
        ref={pickerRef}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          if (!files.length) return
          const blocks = blocksRef.current
          const anchor = blocks.find((b) => b.id === barId) ?? blocks[blocks.length - 1]
          if (anchor) pasteFiles(anchor, files, pickModeRef.current)
        }}
      />

      <Backlinks note={note} />

      {iconAnchor && (
        <IconPicker
          value={note.icon}
          anchor={iconAnchor}
          onPick={(icon) => {
            updateNote(note.id, { icon })
            setIconAnchor(null)
          }}
          onClear={() => {
            updateNote(note.id, { icon: undefined })
            setIconAnchor(null)
          }}
          onClose={() => setIconAnchor(null)}
        />
      )}

      {slash && (
        <SlashMenu
          query={
            (note.blocks.find((b) => b.id === slash.blockId)?.text ?? '')
              .slice(slash.start + 1)
              .split(' ')[0]
          }
          position={{ top: slash.top, left: slash.left }}
          onPick={pickBlockType}
          onClose={() => setSlash(null)}
        />
      )}

      {menu && menuBlock && (
        <BlockMenu
          block={menuBlock}
          position={{ top: menu.top, left: menu.left }}
          onClose={() => setMenu(null)}
          onTurnInto={(type) => {
            turnInto(menuBlock, type)
            setMenu(null)
          }}
          onTint={(tint: TintName) => {
            patchBlock(menuBlock.id, { tint })
            setMenu(null)
          }}
          onDuplicate={() => {
            const next = [...blocksRef.current]
            const index = next.findIndex((b) => b.id === menuBlock.id)
            next.splice(index + 1, 0, { ...menuBlock, id: emptyBlock().id })
            commit(next)
            setMenu(null)
          }}
          onDelete={() => {
            commit(blocksRef.current.filter((b) => b.id !== menuBlock.id))
            setMenu(null)
          }}
        />
      )}
    </div>
  )
}

function caretRect(fallback: HTMLElement): DOMRect {
  const selection = window.getSelection()
  if (selection && selection.rangeCount) {
    const rect = selection.getRangeAt(0).getBoundingClientRect()
    if (rect.width || rect.height || rect.top) return rect
  }
  return fallback.getBoundingClientRect()
}

/**
 * Pages that link here.
 *
 * The point of a wiki link is that it works both ways: writing `[[Groceries]]`
 * on one page should make this page findable from there without anyone having
 * to maintain a second list.
 */
function Backlinks({ note }: { note: Note }) {
  const state = useApp()
  const linked = useMemo(() => backlinksTo(state, note), [state, note])
  if (!linked.length) return null

  return (
    <section className="backlinks" aria-label="Linked mentions">
      <h2 className="backlinks__head">
        <Icon name="link" size={12} />
        {linked.length} linked {linked.length === 1 ? 'mention' : 'mentions'}
      </h2>
      <ul className="backlinks__list">
        {linked.map((other) => (
          <li key={other.id}>
            <button type="button" className="backlinks__item" onClick={() => setSelectedNote(other.id)}>
              {isIconName(other.icon ?? 'note') ? (
                <Icon name={other.icon ?? 'note'} size={14} />
              ) : (
                <span aria-hidden="true">{other.icon}</span>
              )}
              {noteTitle(other)}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
