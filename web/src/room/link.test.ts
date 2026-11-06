import { describe, expect, test } from 'vitest'
import { newRoomCode, parseRoomLink } from './link'

describe('parseRoomLink', () => {
  test.each([
    ['#abc123', 'abc123'],
    ['abc123', 'abc123'],
    ['#v1.abc123.extra.parts', 'abc123'],
    ['#v1.abc123', 'abc123'],
    ['#A-b_C9zzzz', 'A-b_C9zzzz'],
    ['#' + 'a'.repeat(100), 'a'.repeat(100)],
  ])('%s opens room %s', (hash, code) => {
    expect(parseRoomLink(hash)).toEqual({ kind: 'room', code })
  })

  test.each(['', '#'])('%j has no room', hash => {
    expect(parseRoomLink(hash)).toEqual({ kind: 'none' })
  })

  test.each(['#abc12', '#' + 'a'.repeat(101), '#abc 123', '#abc.123', '#v1.', '#v1.abc', '#v1..abc123', '#sala/123456'])('%s is invalid', hash => {
    expect(parseRoomLink(hash)).toEqual({ kind: 'invalid' })
  })
})

test('new room codes are 24 characters and parse as links', () => {
  const code = newRoomCode()
  expect(code).toMatch(/^[a-z2-9]{24}$/)
  expect(parseRoomLink('#' + code)).toEqual({ kind: 'room', code })
})
