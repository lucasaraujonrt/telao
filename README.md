# Telão

Static page. Host creates a room (PeerJS id `telao-<code>`), shares the screen with getDisplayMedia, viewers open `/#<code>`. Only a shared browser tab sends audio, so the Discord call never leaks; every tile starts muted and viewers pick whose sound they hear. The sidebar has a 3D aim-training game (Three.js, loaded on first play) that the whole room plays together. Run locally: `python3 -m http.server 8000 -d public`. Deploy: `vercel deploy --prod`. Mesh WebRTC, so it fits a handful of viewers; the public PeerJS broker is the only server.
