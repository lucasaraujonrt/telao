import { cleanLabel, LABEL_LENGTH } from '../../room/protocol'

export type MemeKey = string
export type Meme = readonly [key: MemeKey, label: string]

// Built-in sounds live in /sounds, loudness-normalized with ffmpeg so the "estourado" ones are no
// louder than the rest. Custom ones ("x:<slug>") come from myinstants.
export const MEMES: readonly Meme[] = [
  ['faaah', 'FAAAH'], ['voce-nao-tem-aura', 'Você não tem aura'], ['auraa', 'Auraa'],
  ['pou-estourado_zIWCpMy', 'Pou estourado'], ['maldito-traidor', 'Maldito traidor'], ['rela-no-jacare', 'Rela no jacaré'],
  ['ilari-ilari-ilarie-troll', 'Ilariê troll'], ['e-o-pix-nada-ainda', 'E o pix? Nada ainda?'], ['rojao-super-estourado', 'Rojão estourado'],
  ['dom-dom-tava-aqui-no-baile', 'Tava aqui no baile'], ['escreve-e-apaga', 'Escreve e apaga'], ['hee-hee-levanta-pobre', 'Levanta, pobre'],
  ['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-e-lutador', 'AAAA é lutador'], ['hello-moto-estourado', 'Hello Moto'], ['som-do-zap-zap-estourado', 'Zap zap'],
  ['a-risada-do-kiko', 'Risada do Kiko'], ['bom-dia-magnata', 'Bom dia, magnata'], ['abriu-o-audio', 'Abriu o áudio'],
  ['briga-de-gato', 'Briga de gato'], ['dexter-meme', 'Dexter'], ['psycho-scream-soundbible', 'Grito'],
  ['tigrinho-informa', 'Tigrinho informa'], ['tigrinho-vai-te-pegar', 'Tigrinho vai te pegar'],
]
const BUILT_IN = new Map(MEMES)

const SLUG = /^x:[\w.-]{1,80}$/
const MYINSTANTS = /^https?:\/\/(?:www\.)?myinstants\.com\/media\/sounds\/([\w.-]{1,80})\.mp3$/i

export const isBuiltIn = (key: MemeKey) => BUILT_IN.has(key)
export const isCustom = (key: MemeKey) => SLUG.test(key)

/** A built-in key or a myinstants slug. Never an arbitrary URL: a key only ever names a file. */
export const validKey = (key: unknown): key is MemeKey => typeof key === 'string' && (BUILT_IN.has(key) || SLUG.test(key))

export function memeUrl(key: MemeKey): string {
  if (!validKey(key)) throw Error(`Not a meme key: ${key}`)
  return isCustom(key) ? `https://www.myinstants.com/media/sounds/${key.slice(2)}.mp3` : `/sounds/${key}.mp3`
}

/** The key for a myinstants .mp3 link, or null for anything else. */
export function keyFromLink(link: string): MemeKey | null {
  const match = link.trim().match(MYINSTANTS)
  return match ? 'x:' + match[1] : null
}

export const builtInLabel = (key: MemeKey) => BUILT_IN.get(key)
export { cleanLabel, LABEL_LENGTH }
