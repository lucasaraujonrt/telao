import { expect, test } from 'vitest'
import { createSounds, type Playable } from './sounds'

function fakeAudio() {
  const made: Array<Playable & { url: string; paused: boolean }> = []
  const createAudio = (url: string) => {
    const audio = { url, volume: 1, paused: false, onended: null, play: async () => {}, pause() { this.paused = true } }
    made.push(audio)
    return audio
  }
  return { made, createAudio }
}

test('sounds start off, and the slider turns them on at the saved level', () => {
  const audio = fakeAudio(), saved: number[] = []
  const sounds = createSounds({ level: 0.4, saveLevel: level => saved.push(level), createAudio: audio.createAudio })
  sounds.play('/sounds/faaah.mp3')
  expect(audio.made).toEqual([])
  expect(sounds.volume()).toBe(0)
  sounds.setLevel(0.7)
  expect(saved).toEqual([0.7])
  expect(sounds.getSnapshot()).toMatchObject({ on: true, level: 0.7 })
  sounds.play('/sounds/faaah.mp3', 0.5)
  expect(audio.made.map(item => [item.url, item.volume])).toEqual([['/sounds/faaah.mp3', 0.35]])
})

test('deafen, away and hush stop the memes playing now', () => {
  const audio = fakeAudio()
  const sounds = createSounds({ level: 0.5, createAudio: audio.createAudio })
  sounds.setOn(true)
  sounds.play('a'); sounds.hush()
  expect(audio.made[0].paused).toBe(true)
  sounds.play('b'); sounds.setDeaf(true)
  expect(audio.made[1].paused).toBe(true)
  sounds.play('c')
  expect(audio.made).toHaveLength(2)
  sounds.setDeaf(false); sounds.play('d'); sounds.setAway(true)
  expect(audio.made[2].paused).toBe(true)
  expect(sounds.volume()).toBe(0)
})
