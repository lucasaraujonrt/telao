# Telão web

The React rewrite of Telão (see `../docs/rewrite-plan.md` and `../docs/design.md`). Production still serves `../public/`.

## Run

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck and bundle into dist/
npm test           # Vitest
npm run test:e2e   # build, then Playwright in Google Chrome against vite preview
npx oxlint src
```

The e2e test (`e2e/room.spec.ts`) puts three people in one room: one shares a screen, one turns on a camera, one joins through an old `/#code` link. Chrome's fake camera and auto-selected screen supply the media. It needs Google Chrome installed (Playwright's `chrome` channel, no browser download) and network access to the PeerJS cloud server, `0.peerjs.com`.

`/api/ice` is a Vercel function, so under `vite dev` the ICE fetch fails and the room falls back to STUN. Rooms still connect on most networks.

## Code map

- `src/room/`, `src/media/`: the framework-free core (`createRoom`, capture, streaming, camera effects).
- `src/router.tsx`: `/` and `/sala/$code`. Old `/#code` and `/#v1.<code>.…` links redirect to the room route.
- `src/ui/room/useRoom.ts`: the one React integration with the core, through `useSyncExternalStore`.
- `src/ui/home/`, `src/ui/room/`: the screens. `src/components/ui/` holds the shadcn primitives on Base UI, restyled through the tokens in `src/index.css`.
- `src/lib/`: formatting helpers and the `localStorage` preferences (same keys as the old app).
