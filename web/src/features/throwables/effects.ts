import type { TileKey } from '../../room/room'
import { add, layerFor, random, reducedMotion, side } from '../fx'
import { sfx } from './sfx'
import { EMOJI, type Item } from './throwables'

const FLIGHT_MS = 420
const MAX_SPLATS = 30
const SLAPS = ['Plaft!', 'Pá!', 'Toma!', 'Tapão!']

/** The item flies in from below, spins onto the point, and splats or slaps there. */
export function landThrow(key: TileKey, item: Item, x: number, y: number, volume: () => number) {
  const layer = layerFor(key)
  if (!layer) return
  const left = `${x * 100}%`, top = `${y * 100}%`
  sfx('whoosh', volume())
  if (reducedMotion()) { impact(layer, item, left, top, volume); return }
  const projectile = add(layer, 'zo-projectile', EMOJI[item])
  Object.assign(projectile.style, { left, top })
  const dx = side() * layer.clientWidth * random(0.3, 0.7), dy = layer.clientHeight * random(0.7, 1)
  projectile.animate(
    [{ transform: `translate(${dx}px, ${dy}px) rotate(0) scale(2.4)` }, { transform: `translate(0, 0) rotate(${side() * 540}deg) scale(1)` }],
    { duration: FLIGHT_MS, easing: 'cubic-bezier(.35,.1,.75,1)' },
  ).onfinish = () => { projectile.remove(); impact(layer, item, left, top, volume) }
}

function impact(layer: HTMLElement, item: Item, left: string, top: string, volume: () => number) {
  if (!layer.isConnected) return
  sfx(item, volume())
  const tile = layer.parentElement
  if (tile && !reducedMotion()) {
    const shake = item === 'chinelo'
      ? [{}, { translate: '-22px 0', rotate: '-2deg', offset: 0.1 }, { translate: '16px 4px', rotate: '1.5deg', offset: 0.3 }, { translate: '-9px -3px', offset: 0.5 }, { translate: '5px 2px', offset: 0.7 }, {}]
      : [{}, { translate: '-6px 3px', offset: 0.2 }, { translate: '5px -4px', offset: 0.4 }, { translate: '-3px -2px', offset: 0.6 }, { translate: '2px 3px', offset: 0.8 }, {}]
    tile.animate(shake, { duration: item === 'chinelo' ? 500 : 350 })
  }
  if (item === 'chinelo') {
    const slap = add(layer, 'zo-slap')
    Object.assign(slap.style, { left, top })
    add(slap, 'zo-slap-item', EMOJI.chinelo)
    add(slap, 'zo-slap-word', SLAPS[Math.floor(Math.random() * SLAPS.length)])
    slap.animate(
      [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.2)', opacity: 1, offset: 0.2 }, { transform: 'scale(1)', opacity: 1, offset: 0.75 }, { transform: 'scale(1)', opacity: 0 }],
      { duration: 1300 },
    ).onfinish = () => slap.remove()
    return
  }
  const splat = add(layer, `zo-splat zo-${item}`)
  Object.assign(splat.style, { left, top, rotate: `${random(0, 360)}deg` })
  const radius = () => `${random(30, 70)}%`
  const blob = add(splat, 'zo-blob')
  blob.style.borderRadius = `${radius()} ${radius()} ${radius()} ${radius()} / ${radius()} ${radius()} ${radius()} ${radius()}`
  if (item === 'ovo') add(splat, 'zo-yolk')
  for (let i = 0; i < 7; i++) {
    const angle = random(0, Math.PI * 2), distance = random(42, 60), size = `${random(5, 14)}%`
    Object.assign(add(splat, 'zo-drop').style, { left: `${50 + Math.cos(angle) * distance}%`, top: `${50 + Math.sin(angle) * distance}%`, width: size, height: size })
  }
  if (item === 'tomate') for (let i = 0; i < 5; i++) {
    Object.assign(add(splat, 'zo-seed').style, { left: `${random(30, 70)}%`, top: `${random(30, 70)}%`, rotate: `${random(0, 180)}deg` })
  }
  for (let i = 0; i < 2; i++) {
    const drip = add(splat, 'zo-drip')
    Object.assign(drip.style, { left: `${random(30, 65)}%`, animationDelay: `${random(0, 1.5)}s` })
  }
  if (!reducedMotion()) splat.animate([{ transform: 'scale(.2)' }, { transform: 'scale(1.15)', offset: 0.5 }, { transform: 'scale(1)' }], { duration: 220 })
  const splats = layer.querySelectorAll('.zo-splat')
  if (splats.length > MAX_SPLATS) splats[0].remove()
  setTimeout(() => splat.classList.add('zo-fade'), 9000)
  setTimeout(() => splat.remove(), 10_000)
}
