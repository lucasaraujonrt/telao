import { useEffect, useState, useSyncExternalStore } from 'react'
import { prefs } from '@/lib/storage'
import { createSounds } from './sounds'

/** The room's meme and effect sounds for this visit: off until the viewer turns them on. */
export function useSounds(deaf: boolean, away: boolean) {
  const [sounds] = useState(() => createSounds({ level: prefs.memeVolume.get(), saveLevel: prefs.memeVolume.set }))
  useEffect(() => { sounds.setDeaf(deaf) }, [sounds, deaf])
  useEffect(() => { sounds.setAway(away) }, [sounds, away])
  useEffect(() => () => sounds.hush(), [sounds])
  const state = useSyncExternalStore(sounds.subscribe, sounds.getSnapshot)
  return { sounds, state }
}
