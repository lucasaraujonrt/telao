import type { ScreenProfileName } from '../media/capture'

// Same keys as the old app, so the group's saved name and settings carry over.
const read = (key: string) => { try { return localStorage.getItem(key) } catch { return null } }
const write = (key: string, value: string) => { try { localStorage.setItem(key, value) } catch { /* private mode */ } }
const flag = (key: string) => ({ get: () => read(key) === '1', set: (on: boolean) => write(key, on ? '1' : '0') })

const PROFILES: readonly ScreenProfileName[] = ['game', 'detail', 'light']

export const prefs = {
  nick: { get: () => read('telao-nick') ?? '', set: (name: string) => write('telao-nick', name) },
  away: flag('telao-away'),
  diagnostics: flag('telao-diag'),
  mirror: { get: () => read('telao-mirror') !== '0', set: (on: boolean) => write('telao-mirror', on ? '1' : '0') },
  profile: {
    get: (): ScreenProfileName => { const value = read('telao-profile'); return PROFILES.find(p => p === value) ?? 'game' },
    set: (profile: ScreenProfileName) => write('telao-profile', profile),
  },
}
