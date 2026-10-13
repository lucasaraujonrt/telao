# Telão

Static page. Host creates a room (PeerJS id `telao-<code>`), shares the screen with getDisplayMedia, viewers open `/#<code>`. Audio is opt-in per sharer; viewers unmute each tile. Run locally: `python3 -m http.server 8000 -d public`. Deploy: `vercel deploy --prod`. Mesh WebRTC, so it fits a handful of viewers; the public PeerJS broker is the only server.
