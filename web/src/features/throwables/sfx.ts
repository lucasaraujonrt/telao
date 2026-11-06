import type { Item } from './throwables'

// Synthesized, so they need no files. They follow the meme volume, which is zero while sounds are
// off, deafened or away.

let context: AudioContext | undefined

export function sfx(kind: Item | 'whoosh', volume: number) {
  if (volume === 0) return
  try { context ??= new AudioContext() } catch { return }
  const ac = context
  if (ac.state === 'suspended') void ac.resume()
  const t0 = ac.currentTime, out = ac.createGain()
  out.gain.value = volume
  out.connect(ac.destination)
  const noise = (duration: number, type: BiquadFilterType, frequency: number, gain: number, at = 0) => {
    const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * duration), ac.sampleRate), data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2
    const source = ac.createBufferSource(), filter = ac.createBiquadFilter(), level = ac.createGain()
    source.buffer = buffer; filter.type = type; filter.frequency.value = frequency; level.gain.value = gain
    source.connect(filter).connect(level).connect(out); source.start(t0 + at)
  }
  const thump = (from: number, to: number, duration: number, gain: number) => {
    const oscillator = ac.createOscillator(), level = ac.createGain()
    oscillator.frequency.setValueAtTime(from, t0); oscillator.frequency.exponentialRampToValueAtTime(to, t0 + duration)
    level.gain.setValueAtTime(gain, t0); level.gain.exponentialRampToValueAtTime(0.001, t0 + duration)
    oscillator.connect(level).connect(out); oscillator.start(t0); oscillator.stop(t0 + duration)
  }
  if (kind === 'whoosh') noise(0.35, 'bandpass', 600, 0.25)
  else if (kind === 'tomate') { noise(0.4, 'lowpass', 900, 1.3); thump(170, 45, 0.28, 0.9) }
  else if (kind === 'ovo') { [0, 0.025, 0.06].forEach(at => noise(0.03, 'highpass', 2600, 0.9, at)); noise(0.3, 'lowpass', 1300, 0.8, 0.07) }
  else { noise(0.1, 'highpass', 1100, 1.8); thump(240, 80, 0.09, 0.7) }
}
