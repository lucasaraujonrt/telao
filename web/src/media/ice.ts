const STUN_ONLY: RTCConfiguration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }

// TURN credentials live in Vercel env vars and reach the browser only through /api/ice.
// On any failure fall back to STUN, which covers most networks.
export async function fetchIceConfig(fetcher: typeof fetch = fetch): Promise<RTCConfiguration> {
  try {
    const response = await fetcher('/api/ice', { signal: AbortSignal.timeout(3000) })
    if (!response.ok) return STUN_ONLY
    const { iceServers } = await response.json() as { iceServers?: unknown }
    return Array.isArray(iceServers) && iceServers.length ? { iceServers } : STUN_ONLY
  } catch {
    return STUN_ONLY
  }
}
