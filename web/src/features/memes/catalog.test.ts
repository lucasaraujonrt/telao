import { expect, test } from 'vitest'
import { keyFromLink, memeUrl, MEMES, validKey } from './catalog'

test('every built-in meme key is valid and plays from /sounds', () => {
  for (const [key] of MEMES) {
    expect(validKey(key)).toBe(true)
    expect(memeUrl(key)).toBe(`/sounds/${key}.mp3`)
  }
})

test('a custom key is a myinstants slug and plays from myinstants', () => {
  expect(validKey('x:bruh')).toBe(true)
  expect(validKey('x:som-do.zap_2')).toBe(true)
  expect(memeUrl('x:bruh')).toBe('https://www.myinstants.com/media/sounds/bruh.mp3')
})

test.each([
  'x:', 'x:' + 'a'.repeat(81), 'x:../../etc', 'x:a/b', 'x:https://evil.example/a', 'https://evil.example/a.mp3',
  '/sounds/faaah.mp3', 'faaah.mp3', 'nao-existe', '', 'x:a b', 'x:a?b', 42, null, undefined, ['faaah'],
])('%j is not a meme key', key => {
  expect(validKey(key)).toBe(false)
  if (typeof key === 'string') expect(() => memeUrl(key)).toThrow()
})

test('only a myinstants .mp3 link becomes a key', () => {
  expect(keyFromLink(' https://www.myinstants.com/media/sounds/bruh.mp3 ')).toBe('x:bruh')
  expect(keyFromLink('http://myinstants.com/media/sounds/Vine-Boom.MP3')).toBe('x:Vine-Boom')
  expect(keyFromLink('https://www.myinstants.com/pt/instant/bruh/')).toBe(null)
  expect(keyFromLink('https://evil.example/media/sounds/bruh.mp3')).toBe(null)
  expect(keyFromLink('https://www.myinstants.com.evil.example/media/sounds/bruh.mp3')).toBe(null)
  expect(keyFromLink('https://www.myinstants.com/media/sounds/a/b.mp3')).toBe(null)
  expect(keyFromLink('https://www.myinstants.com/media/sounds/bruh.mp3?x=1')).toBe(null)
})
