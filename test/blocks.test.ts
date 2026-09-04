import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  blocksToMarkdown, blocksToText, emptyBlock, hasChildren, hiddenBlockIds,
  markdownToBlocks, matchShortcut, orderedIndex,
} from '../src/lib/blocks.ts'
import { decorateInline, toggleMark } from '../src/lib/inline.ts'
import type { Block, Note } from '../src/types.ts'
import { noteTree } from '../src/lib/notes.ts'

const block = (type: Block['type'], text: string, indent = 0, extra: Partial<Block> = {}): Block => ({
  ...emptyBlock(type, indent),
  text,
  ...extra,
})

test('markdown shortcuts fire on the marker plus a space', () => {
  assert.equal(matchShortcut('# '), 'h1')
  assert.equal(matchShortcut('## '), 'h2')
  assert.equal(matchShortcut('- '), 'bullet')
  assert.equal(matchShortcut('1. '), 'numbered')
  assert.equal(matchShortcut('[] '), 'todo')
  assert.equal(matchShortcut('> '), 'quote')
  assert.equal(matchShortcut('```'), 'code')
  // Not a shortcut until the space, and never mid-sentence.
  assert.equal(matchShortcut('#'), null)
  assert.equal(matchShortcut('a # '), null)
})

test('a collapsed toggle hides exactly its own nested run', () => {
  const blocks = [
    block('toggle', 'Parent', 0, { collapsed: true }),
    block('text', 'Child A', 1),
    block('text', 'Grandchild', 2),
    block('text', 'Sibling', 0),
  ]
  const hidden = hiddenBlockIds(blocks)
  assert.equal(hidden.size, 2)
  assert.ok(hidden.has(blocks[1].id))
  assert.ok(hidden.has(blocks[2].id))
  assert.ok(!hidden.has(blocks[3].id))
})

test('an expanded toggle hides nothing', () => {
  const blocks = [block('toggle', 'Parent', 0, { collapsed: false }), block('text', 'Child', 1)]
  assert.equal(hiddenBlockIds(blocks).size, 0)
})

test('hasChildren looks at nesting, not block type', () => {
  const blocks = [block('toggle', 'Parent'), block('text', 'Child', 1), block('toggle', 'Lonely')]
  assert.equal(hasChildren(blocks, 0), true)
  assert.equal(hasChildren(blocks, 2), false)
})

test('ordered lists number within their own run and level', () => {
  const blocks = [
    block('numbered', 'one'),
    block('numbered', 'two'),
    block('numbered', 'nested', 1),
    block('numbered', 'three'),
    block('text', 'break'),
    block('numbered', 'restarted'),
  ]
  assert.equal(orderedIndex(blocks, 0), 1)
  assert.equal(orderedIndex(blocks, 1), 2)
  assert.equal(orderedIndex(blocks, 2), 1)
  assert.equal(orderedIndex(blocks, 3), 3)
  assert.equal(orderedIndex(blocks, 5), 1)
})

test('markdown parses into the block types it came from', () => {
  const blocks = markdownToBlocks(
    ['# Title', '', 'A paragraph', '- [x] done', '- [ ] todo', '- bullet', '1. first', '> quoted', '---'].join('\n'),
  )
  assert.deepEqual(
    blocks.map((b) => b.type),
    ['h1', 'text', 'todo', 'todo', 'bullet', 'numbered', 'quote', 'divider'],
  )
  assert.equal(blocks[2].checked, true)
  assert.equal(blocks[3].checked, false)
  assert.equal(blocks[0].text, 'Title')
})

test('a fenced code block survives the round trip', () => {
  const blocks = markdownToBlocks(['```', 'const a = 1', 'const b = 2', '```'].join('\n'))
  assert.equal(blocks.length, 1)
  assert.equal(blocks[0].type, 'code')
  assert.equal(blocks[0].text, 'const a = 1\nconst b = 2')
})

test('parsing an empty body still yields one editable block', () => {
  const blocks = markdownToBlocks('')
  assert.equal(blocks.length, 1)
  assert.equal(blocks[0].type, 'text')
})

test('indentation survives the round trip through markdown', () => {
  const blocks = markdownToBlocks(['- parent', '  - child'].join('\n'))
  assert.deepEqual(blocks.map((b) => b.indent), [0, 1])
  assert.match(blocksToMarkdown(blocks), /^- parent\n {2}- child$/)
})

test('plain text skips dividers and empty blocks', () => {
  const blocks = [block('h1', 'Title'), block('divider', ''), block('text', ''), block('text', 'Body')]
  assert.equal(blocksToText(blocks), 'Title Body')
})

/* ---------------------------------------------------------------- */
/* Inline marks                                                      */
/* ---------------------------------------------------------------- */

test('decorated inline markup keeps the plain text intact', () => {
  const text = 'a **bold** and *italic* and `code`'
  const html = decorateInline(text)
  const stripped = html.replace(/<[^>]+>/g, '')
  assert.equal(stripped, text, 'textContent must be unchanged so caret offsets survive')
  assert.ok(html.includes('<strong>bold</strong>'))
  assert.ok(html.includes('<em>italic</em>'))
  assert.ok(html.includes('<code>code</code>'))
})

test('decoration escapes markup in the source text', () => {
  const html = decorateInline('<script>alert(1)</script>')
  assert.ok(!html.includes('<script>'))
  assert.ok(html.includes('&lt;script&gt;'))
})

test('toggling a mark wraps the selection and reports the new range', () => {
  const result = toggleMark('hello world', 6, 11, '**')
  assert.equal(result.text, 'hello **world**')
  assert.equal(result.text.slice(result.start, result.end), 'world')
})

test('toggling an already-marked selection unwraps it', () => {
  const wrapped = toggleMark('hello world', 6, 11, '**')
  const undone = toggleMark(wrapped.text, wrapped.start, wrapped.end, '**')
  assert.equal(undone.text, 'hello world')
})

test('toggling an empty selection changes nothing', () => {
  assert.deepEqual(toggleMark('abc', 1, 1, '**'), { text: 'abc', start: 1, end: 1 })
})

test('a picture survives a copy out as a markdown image', () => {
  const picture = { ...emptyBlock('image'), text: 'Ferry at dusk', assetId: 'img_1' }
  assert.equal(blocksToMarkdown([picture]), '![Ferry at dusk](picture)')
  // Its caption is the block's words, so search and previews can still see it.
  assert.equal(blocksToText([picture]), 'Ferry at dusk')
})

test('an inline address becomes a link, with its markers still in the text', () => {
  const html = decorateInline('see [the docs](https://example.com/a) now')
  assert.match(html, /<a class="ln" data-href="https:\/\/example\.com\/a">the docs<\/a>/)
  // The markers stay visible, so textContent still equals what is stored.
  assert.match(html, /<span class="mk">\[<\/span>/)
  assert.match(html, /<span class="mk">\]\(https:\/\/example\.com\/a\)<\/span>/)
})

test('a link that could run code stays inert text', () => {
  for (const bad of ['javascript:alert(1)', 'data:text/html,<script>', 'vbscript:x']) {
    const html = decorateInline(`[click](${bad})`)
    assert.doesNotMatch(html, /<a /, `expected ${bad} not to become a link`)
  }
})

test('a wiki link carries the page name for the click to resolve', () => {
  const html = decorateInline('planned in [[Weekend projects]] already')
  assert.match(html, /<a class="ln ln--wiki" data-wiki="Weekend projects">Weekend projects<\/a>/)
  assert.match(html, /<span class="mk">\[\[<\/span>/)
})

test('a wiki link is not read as an ordinary link', () => {
  // [[Page]] would otherwise match as a link labelled "[Page".
  const html = decorateInline('[[Page]]')
  assert.match(html, /ln--wiki/)
  assert.equal(html.includes('data-href'), false)
})

test('link text is escaped, so a page name cannot inject markup', () => {
  const html = decorateInline('[[<img src=x onerror=alert(1)>]]')
  assert.doesNotMatch(html, /<img/)
  assert.match(html, /&lt;img/)
})

test('marks still work alongside links', () => {
  const html = decorateInline('**bold** and [a](https://example.com) and `code`')
  assert.match(html, /<strong>bold<\/strong>/)
  assert.match(html, /<a class="ln"/)
  assert.match(html, /<code>code<\/code>/)
})

/* Nested pages ------------------------------------------------------ */

const page = (id: string, parentId?: string): Note => ({
  id, folderId: 'f1', parentId, title: id, blocks: [], pinned: false, locked: false,
  tags: [], createdAt: '', updatedAt: '',
})

test('pages nest, and a folded page hides what is inside it', () => {
  const notes = [page('a'), page('a1', 'a'), page('a1x', 'a1'), page('b')]
  const open = noteTree(notes, new Set())
  assert.deepEqual(open.map((r) => [r.note.id, r.depth]), [['a', 0], ['a1', 1], ['a1x', 2], ['b', 0]])
  assert.deepEqual(open.map((r) => r.hasChildren), [true, true, false, false])

  const folded = noteTree(notes, new Set(['a']))
  assert.deepEqual(folded.map((r) => r.note.id), ['a', 'b'])
})

test('a page whose parent is filtered out is shown rather than hidden', () => {
  // Searching shows the matches; a child must not vanish because its parent
  // did not match.
  const rows = noteTree([page('a1', 'a')], new Set())
  assert.deepEqual(rows.map((r) => [r.note.id, r.depth]), [['a1', 0]])
})

test('depth is capped so a deep chain cannot indent off the side', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
  const chain = ids.map((id, i) => page(id, i ? ids[i - 1] : undefined))
  const rows = noteTree(chain, new Set(), 3)
  assert.deepEqual(rows.map((r) => r.depth), [0, 1, 2, 3, 3, 3, 3])
})

test('a page in a cycle is still shown, rather than vanishing', () => {
  // Not reachable through the UI, but a hand-edited backup could carry one.
  // Every page in the ring has a parent, so none of them is a root.
  const rows = noteTree([page('a', 'b'), page('b', 'a')], new Set())
  assert.deepEqual(rows.map((r) => r.note.id).sort(), ['a', 'b'])
})

test('every visible page appears exactly once, whatever the parent links say', () => {
  const notes = [page('a'), page('a1', 'a'), page('orphan', 'gone'), page('b', 'a1')]
  const ids = noteTree(notes, new Set()).map((r) => r.note.id)
  assert.equal(ids.length, notes.length)
  assert.equal(new Set(ids).size, notes.length)
})

test('folding hides children without the cycle guard bringing them back', () => {
  const notes = [page('a'), page('a1', 'a'), page('a1x', 'a1'), page('b')]
  assert.deepEqual(noteTree(notes, new Set(['a'])).map((r) => r.note.id), ['a', 'b'])
  assert.deepEqual(noteTree(notes, new Set(['a1'])).map((r) => r.note.id), ['a', 'a1', 'b'])
})
