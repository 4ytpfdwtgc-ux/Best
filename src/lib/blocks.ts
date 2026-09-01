import type { Block, BlockType, TintName } from '../types.ts'
import { uid } from './id.ts'

/** Blocks that carry an inline marker and continue on Enter. */
export const LIST_TYPES: BlockType[] = ['todo', 'bullet', 'numbered', 'toggle']

export function emptyBlock(type: BlockType = 'text', indent = 0): Block {
  const block: Block = { id: uid('blk'), type, text: '', indent }
  if (type === 'todo') block.checked = false
  if (type === 'toggle') block.collapsed = false
  if (type === 'callout') {
    block.tint = 'gray'
    block.icon = '💡'
  }
  return block
}

/** What the slash menu offers, in Notion's order. */
export const BLOCK_MENU: {
  type: BlockType
  label: string
  hint: string
  keywords: string[]
  glyph: string
}[] = [
  { type: 'text', label: 'Text', hint: 'Just start writing with plain text.', keywords: ['text', 'plain', 'paragraph'], glyph: 'Aa' },
  { type: 'h1', label: 'Heading 1', hint: 'Big section heading.', keywords: ['h1', 'heading', 'title', 'big'], glyph: 'H1' },
  { type: 'h2', label: 'Heading 2', hint: 'Medium section heading.', keywords: ['h2', 'heading', 'subtitle'], glyph: 'H2' },
  { type: 'h3', label: 'Heading 3', hint: 'Small section heading.', keywords: ['h3', 'heading', 'subheading'], glyph: 'H3' },
  { type: 'todo', label: 'To-do list', hint: 'Track tasks with a checkbox.', keywords: ['todo', 'task', 'checkbox', 'check'], glyph: '☑' },
  { type: 'bullet', label: 'Bulleted list', hint: 'Create a simple bulleted list.', keywords: ['bullet', 'list', 'unordered'], glyph: '•' },
  { type: 'numbered', label: 'Numbered list', hint: 'Create a list with numbering.', keywords: ['number', 'ordered', 'list'], glyph: '1.' },
  { type: 'toggle', label: 'Toggle list', hint: 'Hide and show content inside.', keywords: ['toggle', 'collapse', 'fold', 'details'], glyph: '▸' },
  { type: 'quote', label: 'Quote', hint: 'Capture a quote.', keywords: ['quote', 'blockquote', 'citation'], glyph: '❝' },
  { type: 'callout', label: 'Callout', hint: 'Make writing stand out.', keywords: ['callout', 'note', 'info', 'aside'], glyph: '💡' },
  { type: 'divider', label: 'Divider', hint: 'Visually divide blocks.', keywords: ['divider', 'line', 'separator', 'hr'], glyph: '—' },
  { type: 'code', label: 'Code', hint: 'Capture a code snippet.', keywords: ['code', 'snippet', 'monospace'], glyph: '{}' },
]

export function blockLabel(type: BlockType): string {
  return BLOCK_MENU.find((b) => b.type === type)?.label ?? 'Text'
}

/**
 * Markdown shortcuts that convert as you type, the way Notion's do: the
 * trigger is typing the marker followed by a space at the start of a block.
 */
const SHORTCUTS: { pattern: RegExp; type: BlockType }[] = [
  { pattern: /^# $/, type: 'h1' },
  { pattern: /^## $/, type: 'h2' },
  { pattern: /^### $/, type: 'h3' },
  { pattern: /^\[\] $|^\[ \] $/, type: 'todo' },
  { pattern: /^[-*+] $/, type: 'bullet' },
  { pattern: /^\d+\. $/, type: 'numbered' },
  { pattern: /^> $/, type: 'quote' },
  { pattern: /^" $/, type: 'quote' },
  { pattern: /^```$/, type: 'code' },
  { pattern: /^--- $|^\*\*\* $/, type: 'divider' },
  { pattern: /^\|> $/, type: 'toggle' },
]

/** The block type a just-typed prefix should convert to, if any. */
export function matchShortcut(text: string): BlockType | null {
  for (const { pattern, type } of SHORTCUTS) if (pattern.test(text)) return type
  return null
}

/**
 * Blocks a collapsed toggle hides: everything after it that is indented
 * deeper, up to the next block at the toggle's own level or shallower.
 */
export function hiddenBlockIds(blocks: Block[]): Set<string> {
  const hidden = new Set<string>()
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    if (block.type !== 'toggle' || !block.collapsed) continue
    for (let j = i + 1; j < blocks.length && blocks[j].indent > block.indent; j++) {
      hidden.add(blocks[j].id)
    }
  }
  return hidden
}

/** Whether a toggle currently has anything nested under it. */
export function hasChildren(blocks: Block[], index: number): boolean {
  const next = blocks[index + 1]
  return !!next && next.indent > blocks[index].indent
}

/** The number to show on an ordered-list block, counting its own run. */
export function orderedIndex(blocks: Block[], index: number): number {
  let n = 1
  for (let i = index - 1; i >= 0; i--) {
    const b = blocks[i]
    if (b.indent > blocks[index].indent) continue
    if (b.indent < blocks[index].indent || b.type !== 'numbered') break
    n++
  }
  return n
}

/** Plain text of a note, for search and list previews. */
export function blocksToText(blocks: Block[]): string {
  return blocks
    .filter((b) => b.type !== 'divider')
    .map((b) => b.text)
    .filter((t) => t.trim())
    .join(' ')
}

/** Markdown, for a note the user wants to copy out. */
export function blocksToMarkdown(blocks: Block[]): string {
  return blocks
    .map((b) => {
      const pad = '  '.repeat(b.indent)
      switch (b.type) {
        case 'h1': return `${pad}# ${b.text}`
        case 'h2': return `${pad}## ${b.text}`
        case 'h3': return `${pad}### ${b.text}`
        case 'todo': return `${pad}- [${b.checked ? 'x' : ' '}] ${b.text}`
        case 'bullet': return `${pad}- ${b.text}`
        case 'numbered': return `${pad}1. ${b.text}`
        case 'toggle': return `${pad}- ${b.text}`
        case 'quote': return `${pad}> ${b.text}`
        case 'callout': return `${pad}> ${b.icon ?? ''} ${b.text}`
        case 'divider': return `${pad}---`
        case 'code': return `${pad}\`\`\`\n${b.text}\n${pad}\`\`\``
        default: return `${pad}${b.text}`
      }
    })
    .join('\n')
}

/**
 * Parse the markdown-ish text the pre-block editor stored into blocks. Used
 * once, when migrating saved notes.
 */
export function markdownToBlocks(body: string): Block[] {
  const blocks: Block[] = []
  let inCode = false
  let codeLines: string[] = []

  for (const rawLine of body.split('\n')) {
    if (rawLine.trim().startsWith('```')) {
      if (inCode) {
        blocks.push({ ...emptyBlock('code'), text: codeLines.join('\n') })
        codeLines = []
      }
      inCode = !inCode
      continue
    }
    if (inCode) {
      codeLines.push(rawLine)
      continue
    }

    const indent = Math.min(3, Math.floor((rawLine.match(/^ */)?.[0].length ?? 0) / 2))
    const line = rawLine.trim()
    if (!line) continue

    const push = (type: BlockType, text: string, extra: Partial<Block> = {}) =>
      blocks.push({ ...emptyBlock(type, indent), text, ...extra })

    let m: RegExpMatchArray | null
    if (/^(---|\*\*\*)$/.test(line)) push('divider', '')
    else if ((m = line.match(/^###\s+(.*)$/))) push('h3', m[1])
    else if ((m = line.match(/^##\s+(.*)$/))) push('h2', m[1])
    else if ((m = line.match(/^#\s+(.*)$/))) push('h1', m[1])
    else if ((m = line.match(/^[-*]\s+\[([ xX])\]\s?(.*)$/))) push('todo', m[2], { checked: m[1].toLowerCase() === 'x' })
    else if ((m = line.match(/^[-*]\s+(.*)$/))) push('bullet', m[1])
    else if ((m = line.match(/^\d+[.)]\s+(.*)$/))) push('numbered', m[1])
    else if ((m = line.match(/^>\s?(.*)$/))) push('quote', m[1])
    else push('text', line)
  }

  if (inCode && codeLines.length) blocks.push({ ...emptyBlock('code'), text: codeLines.join('\n') })
  return blocks.length ? blocks : [emptyBlock('text')]
}

export const CALLOUT_TINTS: TintName[] = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red']
