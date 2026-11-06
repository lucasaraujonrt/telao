// Hands the browser the ICE servers. TURN credentials live in Vercel env vars, never in the public repo.
export default function handler(req, res) {
  const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
  // Dashboards often show "host:port" without the scheme, which makes RTCPeerConnection throw.
  const urls = (process.env.TURN_URLS || "").split(",").map(url => url.trim()).filter(Boolean)
    .map(url => /^turns?:/i.test(url) ? url : `turn:${url}`)
    // Also offer TURN over TCP for networks that block UDP.
    .flatMap(url => /[?&]transport=/i.test(url) || /^turns:/i.test(url) ? [url] : [url, `${url}?transport=tcp`]);
  if (urls.length && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
    iceServers.push({ urls, username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL });
  }
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ iceServers });
}
