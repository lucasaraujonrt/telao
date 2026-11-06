# Telão rewrite plan

Goal: turn the single-file prototype (`public/index.html`, about 2,900 lines) into a typed, tested React app worth showing in a portfolio. The friend group keeps using the current site every night, so production stays on `public/` until the new app reaches parity.

## Decisions

- Vite, React, TypeScript, and TanStack Router. The app runs entirely in the browser: the room is peer to peer and nothing needs server rendering. It still deploys as static files on Vercel, plus the existing `api/ice.js` function.
- The new app lives in `web/` beside the old site. `vercel.json` keeps serving `public/` until the switch.
- The UI is in Portuguese. The README and code are in English.
- Redesign with shadcn/ui on Base UI and a look of its own, after parity. The shell first ships with plain styling.

## Constraints that must survive the port

1. The Discord voice must never leak. Capture keeps `systemAudio: "exclude"` and `windowAudio: "window"`, and drops audio from `monitor` surfaces. A unit test asserts these options.
2. No secrets in the repo. TURN credentials stay in Vercel env vars and reach the browser only through `/api/ice`.
3. Old links keep working. A room link is `/#code`, including the `v1.` prefix. The root route redirects the hash form to the new room route.
4. The fixes from November 2026 stay:
   - hub election with the `unavailable-id` step-down;
   - delayed signalling reconnect;
   - the `peers` merge that keeps open connections;
   - a 15 s ICE grace period;
   - `/api/ice`;
   - media-call retry;
   - `preferH264`;
   - the adaptive stream controller.

## Architecture

- `web/src/room/` holds a framework-free TypeScript core: signalling, hub election, member mesh, and media calls. Every data channel message is a discriminated union validated at the boundary.
- `web/src/media/` holds capture, the stream controller, camera effects, and stats reading.
- `web/src/features/` holds the fun features, each self-contained: memes, combos, throwables, reactions, pranks, modes, aura, and the game.
- `web/src/ui/` holds React components that subscribe to the core through one store.

## Phases

Each phase ends deployable and verified.

1. **Core.** Scaffold `web/`. Port the room and media core to TypeScript. Port `tests/room-integration.test.cjs` and the streaming and camera tests to Vitest, all green. Nothing user-facing yet.
2. **Shell.** Home, room route, people sidebar, tiles, theater and fullscreen, share and camera controls, audio mute and volume, away mode, quality profile, diagnostics. Multi-tab Playwright test with Chrome fake media. A preview deploy that the group can try.
3. **Zoeira.** Memes, combos, throwables, reactions, pranks, the four modes (pod, 4:20, tiger, aura), and notifications.
4. **Game.** Mira da Tropa and the 1x1 duel, with Three.js loaded lazily as its own chunk.
5. **Design.** The redesign pass.
6. **Switch and polish.**
   - Point Vercel at the `web/` build and delete `public/`.
   - English README with an architecture diagram and a demo GIF.
   - GitHub Actions CI running typecheck, unit tests, and e2e tests.

## Parity checklist

Sections of `public/index.html`:

- [ ] Home poster and nickname entry
- [ ] Room: hub, mesh, rejoin, capacity of 8, at most 4 sharers
- [ ] Screen share with quality profiles, H.264 preference, and adaptive quality
- [ ] Camera with effects and mirroring
- [ ] Audio: per-tile mute and volume, deafen all
- [ ] Members list, rename, "ao vivo" badge, notifications
- [x] Memes (myinstants). Combos were dropped
- [x] Throwables and reactions
- [ ] Pranks on whoever is live
- [ ] Modes: pod, 4:20, tiger receipt, aura
- [ ] Theater and fullscreen, viewer preferences
- [ ] Mira da Tropa, crosshair editor, 1x1 duel
- [ ] Diagnostics overlay
- [ ] Away mode
