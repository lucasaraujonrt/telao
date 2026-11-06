import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router'
import { parseRoomCode, parseRoomLink } from './room/link'
import { HomePage, Root, RoomPage } from './ui/pages'

const rootRoute = createRootRoute({
  // Old links are /#code and /#v1.<code>.…; they open the room route. An invalid one stays on the
  // home, which says so.
  beforeLoad: ({ location }) => {
    if (location.pathname !== '/') return
    const link = parseRoomLink(location.hash)
    if (link.kind === 'room') throw redirect({ to: '/sala/$code', params: { code: link.code }, hash: '', replace: true })
  },
  component: Root,
})

const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomePage })

const roomRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sala/$code',
  beforeLoad: ({ params }) => {
    if (!parseRoomCode(params.code)) throw redirect({ to: '/', hash: params.code, replace: true })
  },
  component: () => <RoomPage code={roomRoute.useParams().code} />,
})

export const router = createRouter({ routeTree: rootRoute.addChildren([homeRoute, roomRoute]) })

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
