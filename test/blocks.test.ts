import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  blocksToMarkdown, blocksToText, emptyBlock, hasChildren, hiddenBlockIds,
  markdownToBlocks, matchShortcut, orderedIndex,
} from '../src/lib/blocks.ts'
import { decorateInline, toggleMark } from '../src/lib/inline.ts'
import type { Block, Note, Reminder } from '../src/types.ts'
import { noteToMarkdown, remindersToText, shareFilename } from '../src/lib/share.ts'
import { canDropPage, noteTree, reorderedSiblings } from '../src/lib/notes.ts'
import {
  DRAG_SLOP, SENSITIVITY, SWIPE_COMMIT, SWIPE_SLOP, TOUCH_HOLD_MS, TOUCH_SLOP,
} from '../src/lib/gestures.ts'

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

test('every branch starts folded, and opens only when named', () => {
  const notes = [page('a'), page('a1', 'a'), page('a1x', 'a1'), page('b')]

  // Nothing expands on its own: the top level, and the fact that there is more.
  const shut = noteTree(notes, new Set())
  assert.deepEqual(shut.map((r) => [r.note.id, r.depth]), [['a', 0], ['b', 0]])
  assert.deepEqual(shut.map((r) => r.hasChildren), [true, false])

  // Opening one tier shows that tier and no further.
  const one = noteTree(notes, new Set(['a']))
  assert.deepEqual(one.map((r) => [r.note.id, r.depth]), [['a', 0], ['a1', 1], ['b', 0]])

  const two = noteTree(notes, new Set(['a', 'a1']))
  assert.deepEqual(two.map((r) => [r.note.id, r.depth]), [['a', 0], ['a1', 1], ['a1x', 2], ['b', 0]])
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
  const rows = noteTree(chain, new Set(ids), 3)
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
  const ids = noteTree(notes, new Set(['a', 'a1'])).map((r) => r.note.id)
  assert.equal(ids.length, notes.length)
  assert.equal(new Set(ids).size, notes.length)
})

test('folding hides children without the cycle guard bringing them back', () => {
  const notes = [page('a'), page('a1', 'a'), page('a1x', 'a1'), page('b')]
  // The guard exists to rescue unreachable pages, not to leak folded ones.
  assert.deepEqual(noteTree(notes, new Set()).map((r) => r.note.id), ['a', 'b'])
  assert.deepEqual(noteTree(notes, new Set(['a'])).map((r) => r.note.id), ['a', 'a1', 'b'])
})

/* Tables ------------------------------------------------------------ */

const table = (rows: string[][], caption = ''): Block => ({ ...emptyBlock('table'), rows, text: caption })

test('a new table starts with a header and two rows', () => {
  const fresh = emptyBlock('table')
  assert.equal(fresh.rows?.length, 3)
  assert.equal(fresh.rows?.[0].length, 3)
})

test('a table copies out as a markdown table', () => {
  const md = blocksToMarkdown([table([['Name', 'Qty'], ['Rope', '2'], ['Torch', '1']])])
  assert.equal(md, ['| Name | Qty |', '| --- | --- |', '| Rope | 2 |', '| Torch | 1 |'].join('\n'))
})

test('a ragged table is squared off rather than emitted broken', () => {
  const md = blocksToMarkdown([table([['A', 'B', 'C'], ['1']])])
  assert.equal(md, ['| A | B | C |', '| --- | --- | --- |', '| 1 |   |   |'].join('\n'))
})

test('a pipe in a cell is escaped, so it cannot break the row', () => {
  const md = blocksToMarkdown([table([['a|b'], ['c']])])
  assert.match(md, /\| a\\\|b \|/)
})

test('a caption follows the table', () => {
  const md = blocksToMarkdown([table([['A'], ['1']], 'Kit list')])
  assert.equal(md.split('\n').at(-1), 'Kit list')
})

/* Sharing ----------------------------------------------------------- */

test('a page shares as markdown with its title as the heading', () => {
  const note = { ...page('n1'), blocks: [
    { ...emptyBlock('h2'), text: 'Kit' },
    { ...emptyBlock('todo'), text: 'Rope', checked: true },
    { ...emptyBlock('bullet'), text: 'Torch' },
  ] }
  assert.equal(
    noteToMarkdown(note, 'Trip planning'),
    '# Trip planning\n\n## Kit\n- [x] Rope\n- Torch\n',
  )
})

test('a list shares as a checklist with its dates', () => {
  const task = (over: Partial<Reminder>): Reminder => ({
    id: 't', listId: 'l', title: 'Task', completed: false, flagged: false, priority: 0,
    tags: [], subtasks: [], props: {}, createdAt: '', updatedAt: '', sortIndex: 0, ...over,
  })
  const text = remindersToText(
    [task({ title: 'Call the plumber', priority: 2 }), task({ title: 'Done thing', completed: true })],
    'Home',
  )
  assert.equal(text, '# Home\n\n- [ ] Call the plumber !!\n- [x] Done thing\n')
})

test('an empty list says so rather than sharing a bare heading', () => {
  assert.match(remindersToText([], 'Today'), /Nothing here\./)
})

test('a filename is slugged, dated, and never empty', () => {
  const on = new Date(2026, 8, 4)
  assert.equal(shareFilename('Trip planning!', 'md', on), 'trip-planning-2026-09-04.md')
  assert.equal(shareFilename('   ', 'md', on), 'cadence-2026-09-04.md')
  assert.equal(shareFilename('#!?', 'md', on), 'cadence-2026-09-04.md')
})

test('the sensitivity knob makes every gesture ask for more', () => {
  // The point of the shared constants: one number moves all of them together.
  assert.equal(SENSITIVITY, 0.7)
  assert.equal(SWIPE_SLOP, 11)
  assert.equal(SWIPE_COMMIT, 103)
  assert.equal(DRAG_SLOP, 6)
  assert.equal(TOUCH_SLOP, 11)
  // A hold is less sensitive when it is longer, so it scales the other way.
  assert.equal(TOUCH_HOLD_MS, 500)
})

test('a gesture asks for roughly a third more than it used to', () => {
  const before = { slop: 8, commit: 72, drag: 4, hold: 350 }
  const ratio = (now: number, was: number) => now / was
  for (const [now, was] of [
    [SWIPE_SLOP, before.slop],
    [SWIPE_COMMIT, before.commit],
    [DRAG_SLOP, before.drag],
    [TOUCH_HOLD_MS, before.hold],
  ] as const) {
    const r = ratio(now, was)
    assert.ok(r > 1.35 && r < 1.55, `expected about 1.43x, got ${r.toFixed(2)}`)
  }
})

/* Dragging a page --------------------------------------------------- */

test('a page can be dropped into another, or out to the top level', () => {
  const notes = [page('a'), page('b'), page('b1', 'b')]
  assert.equal(canDropPage(notes, 'a', 'b'), true)
  assert.equal(canDropPage(notes, 'a', 'b1'), true)
  assert.equal(canDropPage(notes, 'b1', undefined), true)
})

test('a page cannot be dropped inside itself or its own descendants', () => {
  // Either would cut the branch off the tree and make it unreachable.
  const notes = [page('a'), page('a1', 'a'), page('a1x', 'a1')]
  assert.equal(canDropPage(notes, 'a', 'a'), false)
  assert.equal(canDropPage(notes, 'a', 'a1'), false)
  assert.equal(canDropPage(notes, 'a', 'a1x'), false)
})

test('dropping a page where it already is offers nothing', () => {
  const notes = [page('a'), page('a1', 'a'), page('top')]
  assert.equal(canDropPage(notes, 'a1', 'a'), false)
  assert.equal(canDropPage(notes, 'top', undefined), false)
})

test('a page that is not there cannot be dragged, nor dropped on', () => {
  const notes = [page('a')]
  assert.equal(canDropPage(notes, 'ghost', undefined), false)
  assert.equal(canDropPage(notes, 'a', 'ghost'), false)
  assert.equal(canDropPage(notes, '', undefined), false)
})

/* Manual ordering --------------------------------------------------- */

test('a page is placed before the one it was dropped above', () => {
  const siblings = [page('a'), page('b'), page('c')]
  assert.deepEqual(reorderedSiblings(siblings, 'c', 'b'), ['a', 'c', 'b'])
  assert.deepEqual(reorderedSiblings(siblings, 'a', 'c'), ['b', 'a', 'c'])
})

test('dropped past the end, it goes last', () => {
  const siblings = [page('a'), page('b'), page('c')]
  assert.deepEqual(reorderedSiblings(siblings, 'a', undefined), ['b', 'c', 'a'])
})

test('a page arriving from another level joins the order', () => {
  // It is not among the siblings yet, so nothing is removed on the way in.
  const siblings = [page('a'), page('b')]
  assert.deepEqual(reorderedSiblings(siblings, 'newcomer', 'b'), ['a', 'newcomer', 'b'])
  assert.deepEqual(reorderedSiblings(siblings, 'newcomer', undefined), ['a', 'b', 'newcomer'])
})

test('dropping a page on itself leaves the order alone', () => {
  const siblings = [page('a'), page('b'), page('c')]
  assert.deepEqual(reorderedSiblings(siblings, 'b', 'b'), ['a', 'c', 'b'])
})

test('a target that is not there puts the page last rather than losing it', () => {
  const siblings = [page('a'), page('b')]
  assert.deepEqual(reorderedSiblings(siblings, 'a', 'ghost'), ['b', 'a'])
})

test('the order follows the rows as drawn, across folders', () => {
  // All Notes shows every folder together, so ordering is over what is on the
  // screen rather than over one folder's contents.
  const shown = [
    { ...page('work'), folderId: 'f1' },
    { ...page('ideas'), folderId: 'f2' },
    { ...page('notes'), folderId: 'f3' },
  ]
  assert.deepEqual(reorderedSiblings(shown, 'notes', 'work'), ['notes', 'work', 'ideas'])
})
