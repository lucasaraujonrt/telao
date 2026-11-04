# Telão

Static page. Open a room and share its link. Anyone with the link joins directly. Screen capture uses getDisplayMedia. Only a shared browser tab sends audio, so the Discord call never leaks; every tile starts muted and viewers pick whose sound they hear. The sidebar has a 3D Valorant-style range (Three.js r147, loaded on first play, procedural AK-47): a room-wide aim race and a 1x1 duel synced over the data channel. Run locally: `python3 -m http.server 8000 -d public`. Deploy: `vercel deploy --prod`. Mesh WebRTC, so it fits a handful of viewers; the public PeerJS broker is the only server.

Camera and screen can run together in separate tiles. Normal camera video uses the original camera track. Selecting an effect starts canvas processing; returning to Normal stops it. The mirror setting affects your local preview. Camera uses video only, without microphone capture. The camera controls offer black-and-white, VHS, neon and pixel effects before transmission. Turning either source off leaves the other running. Camera permission requires localhost or HTTPS.

Cameras dock under the screens and fill the stage when nobody is sharing. `live-updates.js` checks the page every 5 minutes while visible (with browser cache revalidation), applies inline CSS changes immediately, and queues code updates until no camera, screen, game or mode is active. It then reloads automatically into the same room. Clients from older deployments need a manual refresh.

Aura mode is the fourth sidebar mode, shortcut U. It runs a 15-second energy effect and reveals a room-wide fictional ranking. The initiating peer sends one ranking payload to everyone; `aura-mode.js` renders it using text nodes, cancels its phase timers on stop, and respects reduced motion. It uses the existing normalized aura sound at meme volume.


## Hosting and streaming

Vercel serves only `public/` as static files, without Functions or a database. Video, camera, audio and game messages travel over WebRTC between participants, not through Vercel. Vercel can still charge for page/asset requests and downloads according to the account plan; caching reduces repeated asset downloads. No paid relay service is configured by this change.

Choose the transmission profile before sharing: Games requests up to 720p/60 fps, Text up to 1080p/30 fps, and Light up to 720p/30 fps. Games prioritizes motion when bandwidth is constrained. A controller samples native WebRTC statistics every three seconds. Repeated CPU or bandwidth pressure lowers quality, and recovery requires a longer healthy period. In theater or fullscreen mode, secondary screens request thumbnail quality. Hidden tabs request low-frame-rate video while audio stays active. Requested frame rates are targets, not guarantees. Screen video has an aggregate encoding budget of 8 Mbps per sharer allocated by viewer preference, with per-viewer profile ceilings of 4/3/1.5 Mbps respectively. Audio, camera and protocol overhead are additional. Each viewer still requires its own encoding/upload; use this for small groups. Performance depends on the sender's hardware, upload and the viewers' networks.

The public PeerJS broker remains an external dependency. Restrictive networks may need TURN; guaranteed connectivity and larger groups would require a separately budgeted TURN/SFU service outside Vercel.

Deploy from the repository root with `vercel --prod`; `vercel.json` selects `public/`. No build or install is needed. Do not enable paid infrastructure just to host this page.


## Room links

Anyone with the link can join. Rooms have no approval, password, identity verification, or member signatures. Use long room links to avoid accidental collisions. The mesh is intended for a small group, with up to eight participants and four simultaneous screen sharers.

## Automated checks

Run `node --test tests/*.test.cjs` from the repository root. No dependency installation is required. The suites cover direct room entry, stream delivery, connection readiness, participant cleanup, viewer preferences, stream allocation, adaptive quality, sender update ordering, and camera cleanup. Integration tests run the actual room-start code with simulated PeerJS connections. They do not measure real network latency or encoder performance.
