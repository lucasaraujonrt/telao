import { expect, test } from 'vitest'
import { addMeme, bindKey, DEFAULT_BOARD, hotkeyOf, labelOf, loadBoard, resetBoard, saveBoard, toggleMeme, type Store } from './board'

const memory = (entries: Record<string, string> = {}): Store & { data: Record<string, string> } => {
  const data = { ...entries }
  return { data, get: key => data[key] ?? null, set: (key, value) => { data[key] = value } }
}

test('a saved board loads back, and junk in storage is dropped', () => {
  const store = memory({
    'telao-custom': JSON.stringify([['x:bruh', '  Bruh  '], ['https://evil.example/a.mp3', 'Mal'], ['x:ok', 7], ['x:vazio', '   '], 'lixo']),
    'telao-hidden': JSON.stringify(['faaah', 3]),
    'telao-keys': JSON.stringify({ q: 'x:bruh', w: 'https://evil.example/a.mp3', z: 'faaah' }),
  })
  const board = loadBoard(store)
  expect(board.custom).toEqual([['x:bruh', 'Bruh']])
  expect([...board.hidden]).toEqual(['faaah'])
  expect(board.keys).toEqual({ ...DEFAULT_BOARD.keys, q: 'x:bruh' })
  expect(loadBoard(memory({ 'telao-custom': '{nope', 'telao-keys': 'null' }))).toEqual(DEFAULT_BOARD)
  saveBoard(store, board)
  expect(loadBoard(store)).toEqual(board)
})

test('editing the board adds, deletes, hides, binds and resets', () => {
  let board = addMeme(DEFAULT_BOARD, 'x:bruh', 'Bruh')
  board = addMeme(board, 'x:bruh', 'Bruh 2')
  expect(board.custom).toEqual([['x:bruh', 'Bruh 2']])
  expect(labelOf(board, 'x:bruh')).toBe('Bruh 2')
  expect(labelOf(board, 'faaah')).toBe('FAAAH')
  board = toggleMeme(toggleMeme(board, 'faaah'), 'dexter-meme')
  expect([...board.hidden]).toEqual(['faaah', 'dexter-meme'])
  board = toggleMeme(board, 'faaah')
  expect([...board.hidden]).toEqual(['dexter-meme'])
  board = bindKey(board, 'w', 'faaah')
  expect(hotkeyOf(board, 'faaah')).toBe('w')
  expect(board.keys.q).toBe(undefined)
  board = resetBoard(toggleMeme(board, 'x:bruh'))
  expect(board.custom).toEqual([])
  expect(board.hidden.size).toBe(0)
  expect(board.keys.w).toBe('faaah')
})
