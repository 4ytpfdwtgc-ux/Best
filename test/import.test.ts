import assert from 'node:assert/strict'
import { test } from 'node:test'
import { filenameTitle, parseImportFile, parseImportFiles } from '../src/lib/import.ts'

test('one file is one note, titled by its filename', () => {
  // The usual case: a Shortcut saved each note as its own file.
  assert.deepEqual(parseImportFile('Packing list.txt', 'Passport\nCharger\nAdapter'), [
    { title: 'Packing list', body: 'Passport\nCharger\nAdapter', folder: undefined },
  ])
})

test('a filename loses its extension and any number Shortcuts added', () => {
  assert.equal(filenameTitle('Packing list.txt'), 'Packing list')
  assert.equal(filenameTitle('Ideas 2.md'), 'Ideas')
  assert.equal(filenameTitle('Ideas (3).txt'), 'Ideas')
  assert.equal(filenameTitle('weekend_plans.txt'), 'weekend plans')
  assert.equal(filenameTitle('.txt'), 'Untitled')
})

test('a header block gives the title and folder, and is not part of the body', () => {
  const notes = parseImportFile(
    'export.txt',
    'Title: Trip planning\nFolder: Travel\n\nBook the flights\nRenew the passport',
  )
  assert.deepEqual(notes, [
    { title: 'Trip planning', body: 'Book the flights\nRenew the passport', folder: 'Travel' },
  ])
})

test('several notes in one file are split on the separator', () => {
  const combined = [
    '--- CADENCE NOTE ---',
    'Title: First',
    '',
    'One',
    '--- CADENCE NOTE ---',
    'Title: Second',
    '',
    'Two',
  ].join('\n')
  assert.deepEqual(parseImportFile('all.txt', combined), [
    { title: 'First', body: 'One', folder: undefined },
    { title: 'Second', body: 'Two', folder: undefined },
  ])
})

test('the separator is matched loosely, since a recipe may write it differently', () => {
  const combined = '----- cadence note -----\nTitle: A\n\nbody a\n--- CADENCE NOTE ---\nTitle: B\n\nbody b'
  assert.deepEqual(parseImportFile('all.txt', combined).map((n) => n.title), ['A', 'B'])
})

test('JSON from a Get Contents step is read, whatever it calls the fields', () => {
  const json = JSON.stringify([
    { name: 'From name', body: 'body one', folder: 'Work' },
    { title: 'From title', content: 'body two' },
    { subject: 'From subject', text: 'body three' },
  ])
  assert.deepEqual(parseImportFile('notes.json', json), [
    { title: 'From name', body: 'body one', folder: 'Work' },
    { title: 'From title', body: 'body two', folder: undefined },
    { title: 'From subject', body: 'body three', folder: undefined },
  ])
})

test('a single JSON object is as good as an array of one', () => {
  assert.deepEqual(parseImportFile('one.json', '{"name":"Solo","body":"text"}'), [
    { title: 'Solo', body: 'text', folder: undefined },
  ])
})

test('JSON that is not notes is refused rather than imported as noise', () => {
  // Falls through to the plain-text path, which at least keeps the content.
  const notes = parseImportFile('data.json', '{"unrelated":true}')
  assert.equal(notes.length, 1)
  assert.equal(notes[0].title, 'data')
})

test('a note with no title takes its first line, as Apple Notes does', () => {
  const notes = parseImportFile('export.txt', '--- CADENCE NOTE ---\nShopping\n\nMilk\nBread')
  assert.deepEqual(notes, [{ title: 'Shopping', body: 'Milk\nBread', folder: undefined }])
})

test('the title is not repeated as the first line of the body', () => {
  const notes = parseImportFile('Recipe.txt', '# Recipe\n\nFlour\nWater')
  assert.equal(notes[0].title, 'Recipe')
  assert.equal(notes[0].body, 'Flour\nWater')
})

test('a body that merely starts with different words keeps them', () => {
  const notes = parseImportFile('Recipe.txt', 'Flour\nWater')
  assert.equal(notes[0].title, 'Recipe')
  assert.equal(notes[0].body, 'Flour\nWater')
})

test('an empty file contributes nothing', () => {
  assert.deepEqual(parseImportFile('empty.txt', '   \n\n '), [])
})

test('several files come in as several notes, in order', () => {
  const notes = parseImportFiles([
    { name: 'A.txt', text: 'first' },
    { name: 'B.md', text: 'second' },
    { name: 'empty.txt', text: '' },
  ])
  assert.deepEqual(notes.map((n) => n.title), ['A', 'B'])
})
