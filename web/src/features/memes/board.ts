import { builtInLabel, cleanLabel, isCustom, MEMES, validKey, type Meme, type MemeKey } from './catalog'

// Each person's own board: memes they added, built-ins they hid, and the Q/W/E/R keys. Nothing here
// is shared with the room. Same storage keys as the old app, so a saved board carries over.

export const HOTKEYS = ['q', 'w', 'e', 'r'] as const
export type Hotkey = (typeof HOTKEYS)[number]

export interface Board {
  custom: readonly Meme[]
  hidden: ReadonlySet<MemeKey>
  keys: Readonly<Partial<Record<Hotkey, MemeKey>>>
}

export interface Store {
  get(key: string): string | null
  set(key: string, value: string): void
}

const DEFAULT_KEYS: Board['keys'] = { q: 'faaah', w: 'a-risada-do-kiko', e: 'rojao-super-estourado', r: 'psycho-scream-soundbible' }
export const DEFAULT_BOARD: Board = { custom: [], hidden: new Set(), keys: DEFAULT_KEYS }

function json(store: Store, key: string): unknown {
  try { return JSON.parse(store.get(key) ?? 'null') } catch { return null }
}

export function loadBoard(store: Store): Board {
  const custom = json(store, 'telao-custom'), hidden = json(store, 'telao-hidden'), keys = json(store, 'telao-keys')
  const memes = Array.isArray(custom) ? custom.flatMap((item): Meme[] => {
    if (!Array.isArray(item) || !isCustom(item[0]) || typeof item[1] !== 'string') return []
    const label = cleanLabel(item[1])
    return label ? [[item[0], label]] : []
  }) : []
  const bound: Partial<Record<Hotkey, MemeKey>> = { ...DEFAULT_KEYS }
  if (keys && typeof keys === 'object') {
    for (const hotkey of HOTKEYS) {
      const value = (keys as Record<string, unknown>)[hotkey]
      if (validKey(value)) bound[hotkey] = value
    }
  }
  return {
    custom: memes,
    hidden: new Set(Array.isArray(hidden) ? hidden.filter((key): key is string => typeof key === 'string') : []),
    keys: bound,
  }
}

export function saveBoard(store: Store, board: Board) {
  store.set('telao-custom', JSON.stringify(board.custom))
  store.set('telao-hidden', JSON.stringify([...board.hidden]))
  store.set('telao-keys', JSON.stringify(board.keys))
}

export const allMemes = (board: Board): readonly Meme[] => [...MEMES, ...board.custom]

export function labelOf(board: Board, key: MemeKey): string | undefined {
  return builtInLabel(key) ?? board.custom.find(([custom]) => custom === key)?.[1]
}

export function addMeme(board: Board, key: MemeKey, label: string): Board {
  return { ...board, custom: [...board.custom.filter(([custom]) => custom !== key), [key, label]] }
}

/** A custom meme is deleted; a built-in one is hidden, or shown again if it was hidden. */
export function toggleMeme(board: Board, key: MemeKey): Board {
  if (isCustom(key)) return { ...board, custom: board.custom.filter(([custom]) => custom !== key) }
  const hidden = new Set(board.hidden)
  if (hidden.has(key)) hidden.delete(key); else hidden.add(key)
  return { ...board, hidden }
}

/** Binds a key to a meme, taking it off any other key first. */
export function bindKey(board: Board, hotkey: Hotkey, key: MemeKey): Board {
  const keys = Object.fromEntries(Object.entries(board.keys).filter(([, bound]) => bound !== key))
  return { ...board, keys: { ...keys, [hotkey]: key } }
}

export const hotkeyOf = (board: Board, key: MemeKey) => HOTKEYS.find(hotkey => board.keys[hotkey] === key)

/** "Voltar para os memes padrão": no custom memes, nothing hidden. The keys stay. */
export const resetBoard = (board: Board): Board => ({ ...board, custom: [], hidden: new Set() })
