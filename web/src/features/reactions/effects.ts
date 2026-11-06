import type { TileKey } from '../../room/room'
import { add, layerFor, random, reducedMotion, side } from '../fx'
import type { Reaction } from './reactions'

const MAX_FLOATING = 50

/** The emoji rises from the foot of the tile, swaying, and fades near the top. */
export function floatReaction(key: TileKey, reaction: Reaction) {
  const layer = layerFor(key)
  if (!layer || layer.querySelectorAll('.zo-reaction').length > MAX_FLOATING) return
  const node = add(layer, 'zo-reaction', reaction)
  node.style.left = `${random(5, 90)}%`
  const up = layer.clientHeight * random(0.6, 0.95), sway = random(20, 50), dir = side()
  const frames = reducedMotion()
    ? [{ transform: `translateY(${-up * 0.4}px)`, opacity: 0 }, { transform: `translateY(${-up * 0.4}px)`, opacity: 1, offset: 0.2 }, { transform: `translateY(${-up * 0.4}px)`, opacity: 0 }]
    : [
        { transform: 'translate(0, 0) scale(.6)', opacity: 0 },
        { transform: `translate(${dir * sway}px, ${-up * 0.3}px) scale(1.1)`, opacity: 1, offset: 0.2 },
        { transform: `translate(${-dir * sway}px, ${-up * 0.65}px) scale(1)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${dir * sway * 0.5}px, ${-up}px) scale(.9)`, opacity: 0 },
      ]
  node.animate(frames, { duration: random(2200, 3000), easing: 'ease-out', fill: 'forwards' }).onfinish = () => node.remove()
}
