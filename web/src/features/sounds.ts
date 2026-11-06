// The room's own sounds: memes and the throwable effects. They start off on every visit, because the
// browser blocks audio until the viewer clicks, and each person turns them on when they want.
// Deafen all and away silence them; neither touches the screen shares.

export interface Playable {
  volume: number
  onended: ((event: Event) => void) | null
  play(): Promise<void>
  pause(): void
}

export interface SoundState {
  on: boolean
  /** The meme volume chosen on the slider, 0 to 1, kept between visits. */
  level: number
  deaf: boolean
  away: boolean
}

export interface Sounds {
  getSnapshot(): SoundState
  subscribe(listener: () => void): () => void
  /** The volume in effect: zero while sounds are off, deafened or away. */
  volume(): number
  setOn(on: boolean): void
  /** Moving the slider turns sounds on, as in the old app. */
  setLevel(level: number): void
  setDeaf(deaf: boolean): void
  setAway(away: boolean): void
  play(url: string, gain?: number): void
  /** Stops every meme playing now. */
  hush(): void
}

export function createSounds(options: {
  level: number
  saveLevel?: (level: number) => void
  createAudio?: (url: string) => Playable
}): Sounds {
  const { saveLevel = () => {}, createAudio = url => new Audio(url) } = options
  let state: SoundState = { on: false, level: clamp(options.level), deaf: false, away: false }
  const playing = new Set<Playable>(), listeners = new Set<() => void>()

  const volume = () => state.on && !state.deaf && !state.away ? state.level : 0
  function update(next: Partial<SoundState>) {
    state = { ...state, ...next }
    const level = volume()
    if (level === 0) hush()
    else playing.forEach(audio => { audio.volume = level })
    listeners.forEach(listener => listener())
  }
  function hush() {
    playing.forEach(audio => audio.pause())
    playing.clear()
  }

  return {
    getSnapshot: () => state,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener) } },
    volume,
    setOn: on => update({ on }),
    setLevel(level) { const next = clamp(level); saveLevel(next); update({ level: next, on: true }) },
    setDeaf: deaf => update({ deaf }),
    setAway: away => update({ away }),
    play(url, gain = 1) {
      const level = volume()
      if (level === 0) return
      const audio = createAudio(url)
      audio.volume = Math.min(1, level * gain)
      playing.add(audio)
      audio.onended = () => { playing.delete(audio) }
      audio.play().catch(() => { playing.delete(audio) })
    },
    hush,
  }
}

const clamp = (level: number) => Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0.4
