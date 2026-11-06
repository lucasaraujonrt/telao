import type { TileKey } from '../room/room'

// Effects are transient DOM, drawn straight into the tile's fx layer: a layer above the video and
// below the tile's chips and buttons, clipped to the tile's radius. React never renders into it.

export const layerFor = (key: TileKey) =>
  document.querySelector<HTMLElement>(`[data-tile-key="${CSS.escape(key)}"] > [data-fx]`)

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

export function add(layer: HTMLElement, className: string, text = '') {
  const node = document.createElement('span')
  node.className = className
  node.textContent = text
  layer.append(node)
  return node
}

export const random = (min: number, max: number) => min + Math.random() * (max - min)
export const side = () => Math.random() < 0.5 ? -1 : 1
