import type { CameraEffect } from '../media/camera-source'
import type { ScreenProfileName } from '../media/capture'
import type { RoomNotice } from '../room/room'

export const NOTICES: Record<RoomNotice, string> = {
  'share-denied': 'A tela não foi compartilhada. Escolhe uma tela ou aba e clica em Compartilhar.',
  'camera-not-allowed': 'Libera a câmera no navegador pra ligar.',
  'camera-not-found': 'Nenhuma câmera encontrada.',
  'camera-failed': 'Não deu pra ligar a câmera. Vê se outro app tá usando ela.',
  'camera-effect-failed': 'Não deu pra aplicar o efeito. Tenta de novo.',
}

export const AUTOPLAY_BLOCKED = 'Clica em qualquer lugar pra ouvir.'
export const DISCARDED = 'O Chrome descarregou esta aba pra poupar memória. Em chrome://settings/performance, coloca este site em "Sempre manter ativos".'

export const PROFILES: ReadonlyArray<{ value: ScreenProfileName; label: string; hint: string }> = [
  { value: 'game', label: 'Jogos 720p60', hint: 'Pra jogo rápido.' },
  { value: 'detail', label: 'Texto 1080p30', hint: 'Pra ler texto e código.' },
  { value: 'light', label: 'Leve 720p30', hint: 'Pra internet fraca.' },
]

export const EFFECTS: ReadonlyArray<{ value: CameraEffect; label: string }> = [
  { value: 'normal', label: 'Normal' },
  { value: 'mono', label: 'Cinema P&B' },
  { value: 'vhs', label: 'VHS da tropa' },
  { value: 'neon', label: 'Neon' },
  { value: 'pixel', label: 'Pixelado' },
]
