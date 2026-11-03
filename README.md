# Telão

Static page. Host creates a room (PeerJS id `telao-<code>`), shares the screen with getDisplayMedia, viewers open `/#<code>`. Only a shared browser tab sends audio, so the Discord call never leaks; every tile starts muted and viewers pick whose sound they hear. The sidebar has a 3D Valorant-style range (Three.js r147, loaded on first play, procedural AK-47): a room-wide aim race and a 1x1 duel synced over the data channel. Run locally: `python3 -m http.server 8000 -d public`. Deploy: `vercel deploy --prod`. Mesh WebRTC, so it fits a handful of viewers; the public PeerJS broker is the only server.

Camera and screen can run together in separate tiles. Camera uses video only, without microphone capture. The camera controls offer mirror, black-and-white, VHS, neon and pixel effects; canvas processing applies the effect before transmission. Turning either source off leaves the other running. Camera permission requires localhost or HTTPS.

Cameras dock under the screens and fill the stage when nobody is sharing. `live-updates.js` checks the page every 15 seconds while visible, applies inline CSS changes immediately, and queues code updates until no camera, screen, game or mode is active. It then reloads automatically into the same room. Existing clients need one manual refresh to install the updater.

Aura mode is the fourth sidebar mode, shortcut U. It runs a 15-second energy effect and reveals a room-wide fictional ranking. The initiating peer sends one ranking payload to everyone; `aura-mode.js` renders it using text nodes, cancels its phase timers on stop, and respects reduced motion. It uses the existing normalized aura sound at meme volume.
