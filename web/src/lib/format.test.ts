import { describe, expect, it } from 'vitest'
import type { VideoStats } from '../media/streaming'
import { diagnosticRows, formatElapsed } from './format'

const stats = (patch: Partial<VideoStats> = {}): VideoStats => ({
  id: 'a', timestamp: 1, bytes: 0, sending: false, codec: 'H264', implementation: null, hardware: true,
  fps: 60, width: 1280, height: 720, kbps: 2400, limit: null, ...patch,
})

describe('formatElapsed', () => {
  it('counts minutes and seconds, then hours', () => {
    expect(formatElapsed(0)).toBe('0:00')
    expect(formatElapsed(7_900)).toBe('0:07')
    expect(formatElapsed(724_000)).toBe('12:04')
    expect(formatElapsed(3_729_000)).toBe('1:02:09')
  })
})

describe('diagnosticRows', () => {
  it('describes what a viewer receives without a limit row', () => {
    expect(diagnosticRows([stats()])).toEqual([
      { label: 'Codec', value: 'H264, hardware' },
      { label: 'Resolução', value: '1280×720' },
      { label: 'Quadros', value: '60 fps' },
      { label: 'Taxa', value: '2.400 kbps' },
    ])
  })

  it('sums the rate over every copy you send and names the first limit', () => {
    const rows = diagnosticRows([
      stats({ sending: true, hardware: false, codec: 'VP8', kbps: 1200, limit: 'none' }),
      stats({ sending: true, kbps: 1300, limit: 'bandwidth' }),
    ])
    expect(rows).toContainEqual({ label: 'Codec', value: 'VP8, software' })
    expect(rows).toContainEqual({ label: 'Taxa', value: '2.500 kbps' })
    expect(rows).toContainEqual({ label: 'Limite', value: 'rede' })
  })

  it('says it is still measuring before the second sample', () => {
    const rows = diagnosticRows([stats({ kbps: null, fps: null, width: null, height: null, codec: null })])
    expect(rows?.every(row => row.value === 'medindo…')).toBe(true)
    expect(diagnosticRows([])).toBeNull()
  })
})
