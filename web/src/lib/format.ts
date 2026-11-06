import type { VideoStats } from '../media/streaming'

/** "0:07", "12:04", "1:02:09": the tally timer. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600), m = Math.floor(total / 60) % 60, s = total % 60
  const ss = String(s).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

const LIMITS: Record<string, string> = { bandwidth: 'rede', cpu: 'CPU', other: 'outro', none: 'nenhum' }
const number = new Intl.NumberFormat('pt-BR')

export interface DiagnosticRow {
  label: 'Codec' | 'Resolução' | 'Quadros' | 'Taxa' | 'Limite'
  value: string
}

/**
 * Readable lines for one tile. Your own share has one stats entry per receiver: the rate is
 * summed, the first limited sender names the limit, the rest describe the first copy.
 */
export function diagnosticRows(stats: readonly VideoStats[]): DiagnosticRow[] | null {
  const first = stats[0]
  if (!first) return null
  const where = first.hardware === true ? 'hardware' : first.hardware === false ? 'software' : null
  const measured = stats.some(s => s.kbps !== null)
  const kbps = stats.reduce((sum, s) => sum + (s.kbps ?? 0), 0)
  const rows: DiagnosticRow[] = [
    { label: 'Codec', value: first.codec ? (where ? `${first.codec}, ${where}` : first.codec) : 'medindo…' },
    { label: 'Resolução', value: first.width && first.height ? `${first.width}×${first.height}` : 'medindo…' },
    { label: 'Quadros', value: first.fps !== null ? `${first.fps} fps` : 'medindo…' },
    { label: 'Taxa', value: measured ? `${number.format(kbps)} kbps` : 'medindo…' },
  ]
  if (first.sending) {
    const limit = stats.map(s => s.limit).find(value => value && value !== 'none')
    rows.push({ label: 'Limite', value: limit ? LIMITS[limit] ?? 'outro' : 'nenhum' })
  }
  return rows
}
