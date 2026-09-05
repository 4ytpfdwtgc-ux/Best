/**
 * Bringing notes in from somewhere else — Apple Notes, in practice.
 *
 * iOS gives third parties no way to read Notes, and a web page especially so.
 * What it does give is Shortcuts, which can walk every note and write each one
 * out as a file. So the app's side of this is to accept whatever that produces
 * and be generous about the shape it arrives in: one file per note, a single
 * file with all of them run together, or the JSON a "Get Contents" step emits.
 */

export interface ImportedNote {
  title: string
  /** Markdown-ish body; the block parser turns it into blocks. */
  body: string
  /** The folder it came from, when the export bothered to say. */
  folder?: string
}

export class ImportError extends Error {}

/**
 * The separator the recipe in Settings writes between notes.
 *
 * Deliberately something no one types by accident, and matched loosely enough
 * that a stray blank line or a different dash count still splits correctly.
 */
export const NOTE_SEPARATOR = '--- CADENCE NOTE ---'
const SEPARATOR_RE = /^-{2,}\s*CADENCE NOTE\s*-{2,}$/im

/** `Title:` and `Folder:` lines, when the recipe wrote a header block. */
const HEADER_RE = /^(title|folder)\s*:\s*(.*)$/i

/**
 * Read one exported file into notes.
 *
 * `name` is the filename, which is the only title a plain text export carries.
 */
export function parseImportFile(name: string, text: string): ImportedNote[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  // A JSON export: an array of notes, or a single one.
  if (/\.json$/i.test(name) || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const fromJson = parseJson(trimmed)
    if (fromJson) return fromJson
  }

  // Several notes run together by the recipe's separator.
  if (SEPARATOR_RE.test(trimmed)) {
    return trimmed
      .split(/^-{2,}\s*CADENCE NOTE\s*-{2,}$/im)
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => withHeaders(chunk, ''))
      .filter((note) => note.title || note.body)
  }

  // One file, one note. The filename is the title Apple Notes gave it.
  return [withHeaders(trimmed, filenameTitle(name))]
}

export function parseImportFiles(files: { name: string; text: string }[]): ImportedNote[] {
  return files.flatMap((f) => parseImportFile(f.name, f.text))
}

/* ------------------------------------------------------------------ */

function parseJson(text: string): ImportedNote[] | null {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return null
  }

  const items = Array.isArray(value) ? value : [value]
  const notes: ImportedNote[] = []
  for (const item of items) {
    if (typeof item === 'string') {
      const note = withHeaders(item.trim(), '')
      if (note.title || note.body) notes.push(note)
      continue
    }
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    // Shortcuts calls them name/body; other exporters use title/content/text.
    const title = str(row.title ?? row.name ?? row.subject)
    const body = str(row.body ?? row.content ?? row.text ?? row.note)
    const folder = str(row.folder ?? row.folderName)
    if (!title && !body) continue
    notes.push({ title: title || firstLine(body), body: stripLeadingTitle(body, title), folder: folder || undefined })
  }
  return notes.length ? notes : null
}

/**
 * Pull `Title:` and `Folder:` off the front of a chunk if they are there,
 * otherwise treat the first line as the title — which is what Apple Notes
 * does, and what anyone reading the file would assume.
 */
function withHeaders(chunk: string, fallbackTitle: string): ImportedNote {
  const lines = chunk.split('\n')
  let title = ''
  let folder = ''
  let i = 0

  while (i < lines.length) {
    const match = lines[i].match(HEADER_RE)
    if (!match) break
    if (match[1].toLowerCase() === 'title') title = match[2].trim()
    else folder = match[2].trim()
    i++
  }

  // A blank line after the headers is part of the header block, not the body.
  if (i > 0) while (i < lines.length && !lines[i].trim()) i++

  const body = lines.slice(i).join('\n').trim()
  // An explicit header wins, and the body under it is already separate.
  if (title) return { title, body: stripLeadingTitle(body, title), folder: folder || undefined }
  /*
   * The filename is the title. A file named after its note usually repeats it
   * as the first heading, and showing it twice on the page is not what anyone
   * exported.
   */
  if (fallbackTitle) {
    return { title: fallbackTitle, body: stripLeadingTitle(body, fallbackTitle), folder: folder || undefined }
  }

  // No title anywhere: take the first line, as Apple Notes titles a note.
  return { title: firstLine(body), body: stripLeadingTitle(body, firstLine(body)), folder: folder || undefined }
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function firstLine(body: string): string {
  const line = body.split('\n').find((l) => l.trim()) ?? ''
  // A leading markdown heading is a title written in markdown.
  return line.replace(/^#{1,6}\s+/, '').trim().slice(0, 120)
}

/** Do not repeat the title as the body's first line. */
function stripLeadingTitle(body: string, title: string): string {
  if (!title) return body.trim()
  const lines = body.split('\n')
  const first = lines.findIndex((l) => l.trim())
  if (first === -1) return ''
  const candidate = lines[first].replace(/^#{1,6}\s+/, '').trim()
  if (candidate !== title.trim()) return body.trim()
  return lines.slice(first + 1).join('\n').trim()
}

/** `Packing list.txt` is a note called "Packing list". */
export function filenameTitle(name: string): string {
  return (
    name
      .replace(/\.[a-z0-9]{1,8}$/i, '')
      // Shortcuts numbers files when several share a name.
      .replace(/[ _-]*\(?\d+\)?$/, '')
      .replace(/[_]+/g, ' ')
      .trim()
      .slice(0, 120) || 'Untitled'
  )
}
