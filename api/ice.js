// Hands the browser the ICE servers. TURN credentials live in Vercel env vars, never in the public repo.
export default function handler(req, res) {
  const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
  const urls = (process.env.TURN_URLS || "").split(",").map(url => url.trim()).filter(Boolean);
  if (urls.length && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
    iceServers.push({ urls, username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL });
  }
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ iceServers });
}
