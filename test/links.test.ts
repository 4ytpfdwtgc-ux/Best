import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  faviconURL, isURL, linkHost, linkTitleFromURL, monogramTint, normalizeURL,
} from '../src/lib/links.ts'

test('a bare host is read as https, the way a browser bar reads it', () => {
  assert.equal(normalizeURL('example.com'), 'https://example.com/')
  assert.equal(normalizeURL('example.com/a/b?c=1'), 'https://example.com/a/b?c=1')
  assert.equal(normalizeURL('  https://example.com/x  '), 'https://example.com/x')
  assert.equal(normalizeURL('http://example.com'), 'http://example.com/')
})

test('anything that is not a web address is refused', () => {
  for (const input of [
    '',
    '   ',
    'just some words',
    'a sentence with example.com inside it',
    'localhost',
    'nodots',
    'trailing.dot.',
  ]) {
    assert.equal(normalizeURL(input), null, `expected ${JSON.stringify(input)} to be refused`)
  }
})

test('a scheme that could run code never reaches an href', () => {
  // The whole point of normalising before rendering: these are XSS vectors.
  for (const input of [
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
  ]) {
    assert.equal(normalizeURL(input), null, `expected ${JSON.stringify(input)} to be refused`)
  }
})

test('isURL is what paste-detection asks', () => {
  assert.equal(isURL('https://example.com'), true)
  assert.equal(isURL('Read https://example.com later'), false)
})

test('the site drops the www nobody reads', () => {
  assert.equal(linkHost('https://www.example.com/a'), 'example.com')
  assert.equal(linkHost('https://news.example.co.uk/a'), 'news.example.co.uk')
})

test('a title is guessed from the last meaningful path segment', () => {
  assert.equal(linkTitleFromURL('https://example.com/blog/how-to-fold-a-shirt'), 'How to fold a shirt')
  assert.equal(linkTitleFromURL('https://example.com/docs/getting_started.html'), 'Getting started')
  // Nothing worth reading in the path: fall back to the site itself.
  assert.equal(linkTitleFromURL('https://example.com/'), 'example.com')
  assert.equal(linkTitleFromURL('https://example.com/1234'), 'example.com')
})

test('the favicon is asked of the site itself, not of an icon service', () => {
  assert.equal(faviconURL('https://www.example.com/deep/page?q=1'), 'https://www.example.com/favicon.ico')
})

test('a site keeps the same monogram colour every time', () => {
  const first = monogramTint('https://example.com/a')
  assert.equal(monogramTint('https://www.example.com/b?c=2'), first)
  assert.notEqual(first, undefined)
})
