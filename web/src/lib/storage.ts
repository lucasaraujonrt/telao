import type { ScreenProfileName } from '../media/capture'

// Same keys as the old app, so the group's saved name and settings carry over.
const read = (key: string) => { try { return localStorage.getItem(key) } catch { return null } }
const write = (key: string, value: string) => { try { localStorage.setItem(key, value) } catch { /* private mode */ } }
const remove = (key: string) => { try { localStorage.removeItem(key) } catch { /* private mode */ } }
const flag = (key: string) => ({ get: () => read(key) === '1', set: (on: boolean) => write(key, on ? '1' : '0') })

const LAYOUT = 'telao-layout-'
const layoutKey = (key: string) => LAYOUT + key.replace(/^react-resizable-panels:/, '')
const layoutKeys = () => { try { return Object.keys(localStorage).filter(key => key.startsWith(LAYOUT)) } catch { return [] } }

const PROFILES: readonly ScreenProfileName[] = ['game', 'detail', 'light']

/** Raw access for feature modules that keep their own keys, such as the memes board. */
export const store = { get: read, set: write }

export const prefs = {
  nick: { get: () => read('telao-nick') ?? '', set: (name: string) => write('telao-nick', name) },
  away: flag('telao-away'),
  diagnostics: flag('telao-diag'),
  selfView: flag('telao-self-view'),
  /** Panel sizes, one entry per layout shape, in the storage shape react-resizable-panels expects. */
  layouts: {
    getItem: (key: string) => read(layoutKey(key)),
    setItem: (key: string, value: string) => write(layoutKey(key), value),
    clear: () => layoutKeys().forEach(remove),
  },
  /** The meme volume, 0 to 1, saved as a percent like the old app. */
  memeVolume: {
    get: () => { const value = Number(read('telao-memevol') ?? 40); return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) / 100 : 0.4 },
    set: (level: number) => write('telao-memevol', String(Math.round(level * 100))),
  },
  mirror: { get: () => read('telao-mirror') !== '0', set: (on: boolean) => write('telao-mirror', on ? '1' : '0') },
  profile: {
    get: (): ScreenProfileName => { const value = read('telao-profile'); return PROFILES.find(p => p === value) ?? 'game' },
    set: (profile: ScreenProfileName) => write('telao-profile', profile),
  },
}
